import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "repomind-inventory-process-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}

async function runInventory(repositoryPath: string) {
  const cliPath = path.resolve("src/cli/inventory.ts");

  return await new Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", cliPath, repositoryPath],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("inventory CLI process", () => {
  it("emits stable JSON only and never runs repository scripts or exposes secrets", async () => {
    const root = await makeTemporaryDirectory();
    const secretValue = "PROCESS_TEST_SECRET_VALUE";
    const markerPath = path.join(root, "script-was-run");
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src", "main.ts"), "export {};\n");
    await writeFile(path.join(root, ".env"), secretValue);
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        scripts: { preinstall: `touch ${markerPath}` },
      }),
    );

    const firstRun = await runInventory(root);
    const secondRun = await runInventory(root);
    const report = JSON.parse(firstRun.stdout) as {
      files: Array<{ path: string; sizeBytes: number }>;
      directories: string[];
    };

    expect(firstRun.exitCode).toBe(0);
    expect(firstRun.stderr).toBe("");
    expect(firstRun.stdout.endsWith("\n")).toBe(true);
    expect(firstRun.stdout).toBe(secondRun.stdout);
    expect(secondRun.exitCode).toBe(0);
    expect(secondRun.stderr).toBe("");
    expect(firstRun.stdout).not.toContain(root);
    expect(firstRun.stdout).not.toContain(secretValue);
    expect(report.directories).toEqual(["src"]);
    expect(report.files.map((file) => file.path)).toEqual([
      "package.json",
      "src/main.ts",
    ]);
    await expect(readFile(markerPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("returns an error on stderr, a nonzero exit, and no JSON for a missing root", async () => {
    const parent = await makeTemporaryDirectory();
    const result = await runInventory(path.join(parent, "missing"));

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "Repository path does not exist or is inaccessible.",
    );
  });
});
