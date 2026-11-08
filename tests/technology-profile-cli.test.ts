import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "repomind-technology-profile-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}

async function writeFixtureFile(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

async function runProfile(args: readonly string[] = []) {
  const cliPath = path.resolve("src/cli/technology-profile.ts");
  return await new Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", cliPath, ...args],
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

describe("technology profile CLI", () => {
  it("emits deterministic evidence for the Rails + React pilot without running scripts or exposing secrets", async () => {
    const root = await makeTemporaryDirectory();
    const secret = "PROFILE_FIXTURE_SECRET_VALUE";
    const markerPath = path.join(root, "script-was-run");
    await writeFixtureFile(
      root,
      "Gemfile",
      "source 'https://rubygems.org'\ngem 'rails'\ngem 'pg'\ngem 'rspec'\n",
    );
    await writeFixtureFile(root, "app/models/order.rb", "class Order; end\n");
    await writeFixtureFile(
      root,
      "web/package.json",
      JSON.stringify({
        packageManager: "pnpm@9.0.0",
        dependencies: { react: "18.0.0", vitest: "2.0.0" },
        devDependencies: { "@playwright/test": "1.0.0" },
        scripts: { preinstall: `touch ${markerPath}`, secret: secret },
      }),
    );
    await writeFixtureFile(
      root,
      "web/src/App.tsx",
      "export function App() {}\n",
    );
    await writeFixtureFile(root, ".env", secret);
    await writeFixtureFile(root, "Dockerfile", "FROM node:22\n");
    await writeFixtureFile(root, "compose.yaml", "services: {}\n");
    await writeFixtureFile(root, "infra/main.tf", "# fixture\n");
    await writeFixtureFile(root, "config/database.yml", "production: {}\n");
    await writeFixtureFile(
      root,
      "deploy/kustomization.yaml",
      "resources: []\n",
    );

    const firstRun = await runProfile([root]);
    const secondRun = await runProfile([root]);
    expect(firstRun.exitCode).toBe(0);
    expect(firstRun.stderr).toBe("");
    expect(firstRun.stdout.endsWith("\n")).toBe(true);
    expect(firstRun.stdout).toBe(secondRun.stdout);
    expect(secondRun.exitCode).toBe(0);
    expect(secondRun.stderr).toBe("");
    expect(firstRun.stdout).not.toContain(root);
    expect(firstRun.stdout).not.toContain(secret);
    await expect(readFile(markerPath)).rejects.toMatchObject({
      code: "ENOENT",
    });

    const profile = JSON.parse(firstRun.stdout) as {
      schemaVersion: number;
      status: string;
      technologies: Array<{
        category: string;
        name: string;
        evidence: Array<{ path: string }>;
      }>;
      warnings: unknown[];
    };
    expect(profile.schemaVersion).toBe(1);
    expect(profile.status).toBe("complete");
    expect(profile.warnings).toEqual([]);
    expect(
      profile.technologies.map(({ category, name }) => `${category}:${name}`),
    ).toEqual([
      "database:Database configuration",
      "database:PostgreSQL",
      "framework:Rails",
      "framework:React",
      "infrastructure:Docker",
      "infrastructure:Docker Compose",
      "infrastructure:Kubernetes",
      "infrastructure:Terraform",
      "language:Ruby",
      "language:TypeScript",
      "packageManager:pnpm",
      "testTool:Playwright",
      "testTool:RSpec",
      "testTool:Vitest",
    ]);
    for (const technology of profile.technologies) {
      expect(technology.evidence.length).toBeGreaterThan(0);
      for (const evidence of technology.evidence) {
        expect(path.isAbsolute(evidence.path)).toBe(false);
      }
    }
  });

  it("validates a non-pilot Node + Express + React repository and ignores unknown signals", async () => {
    const root = await makeTemporaryDirectory();
    await writeFixtureFile(
      root,
      "package.json",
      JSON.stringify({
        dependencies: { express: "5.0.0", react: "18.0.0", pg: "8.0.0" },
        devDependencies: { jest: "30.0.0" },
      }),
    );
    await writeFixtureFile(root, "package-lock.json", "{}\n");
    await writeFixtureFile(root, "src/server.ts", "export {};\n");
    await writeFixtureFile(root, "src/client.jsx", "export default 1;\n");
    await writeFixtureFile(
      root,
      "README.md",
      "Uses an unknown stack marker.\n",
    );
    await writeFixtureFile(root, "custom.lock", "not a recognized lockfile\n");

    const result = await runProfile([root]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const profile = JSON.parse(result.stdout) as {
      status: string;
      technologies: Array<{ category: string; name: string }>;
    };
    expect(profile.status).toBe("complete");
    expect(
      profile.technologies.map(({ category, name }) => `${category}:${name}`),
    ).toEqual([
      "database:PostgreSQL",
      "framework:Express",
      "framework:React",
      "language:JavaScript",
      "language:TypeScript",
      "packageManager:npm",
      "testTool:Jest",
    ]);
  });

  it("returns a partial profile with a stable warning for malformed manifests", async () => {
    const root = await makeTemporaryDirectory();
    await writeFixtureFile(root, "package.json", "{ not valid json\n");
    await writeFixtureFile(root, "src/index.ts", "export {};\n");
    await writeFixtureFile(root, "Dockerfile", "FROM scratch\n");

    const result = await runProfile([root]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: 1,
      status: "partial",
      technologies: [
        {
          category: "infrastructure",
          name: "Docker",
          confidence: "medium",
          evidence: [{ path: "Dockerfile", method: "configuration-path" }],
        },
        {
          category: "language",
          name: "TypeScript",
          confidence: "high",
          evidence: [{ path: "src/index.ts", method: "file-extension" }],
        },
      ],
      warnings: [{ code: "manifest-malformed", path: "package.json" }],
    });
    expect(result.stdout).not.toContain(root);
    expect(result.stdout).not.toContain("not valid json");
  });

  it("writes no JSON for invalid arguments or a missing repository", async () => {
    const noArguments = await runProfile();
    expect(noArguments.exitCode).not.toBe(0);
    expect(noArguments.stdout).toBe("");
    expect(noArguments.stderr).toContain(
      "Usage: npm run --silent technology-profile",
    );

    const multipleArguments = await runProfile(["one", "two"]);
    expect(multipleArguments.exitCode).not.toBe(0);
    expect(multipleArguments.stdout).toBe("");
    expect(multipleArguments.stderr).toContain(
      "Provide exactly one repository path.",
    );

    const parent = await makeTemporaryDirectory();
    const missingRoot = await runProfile([path.join(parent, "missing")]);
    expect(missingRoot.exitCode).not.toBe(0);
    expect(missingRoot.stdout).toBe("");
    expect(missingRoot.stderr).toContain(
      "Repository path does not exist or is inaccessible.",
    );
  });
});
