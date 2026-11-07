import {
  mkdtemp,
  mkdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  InventoryCliError,
  parseInventoryArgs,
  resolveInventoryRoot,
} from "../src/cli/inventory.js";

const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "repomind-inventory-cli-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true })),
  );
});

describe("inventory CLI arguments", () => {
  it("accepts exactly one non-empty path", () => {
    expect(parseInventoryArgs(["./repo"])).toBe("./repo");
  });

  it.each([
    { args: [], name: "no path" },
    { args: [""], name: "empty path" },
    { args: ["repo", "another-repo"], name: "multiple paths" },
  ])("rejects $name", ({ args }) => {
    expect(() => parseInventoryArgs(args)).toThrow(InventoryCliError);
    expect(() => parseInventoryArgs(args)).toThrow(
      "Usage: npm run inventory -- <repository-path>",
    );
  });
});

describe("inventory root validation", () => {
  it("returns the canonical path of an existing directory", async () => {
    const directory = await makeTemporaryDirectory();
    expect(await resolveInventoryRoot(directory)).toBe(
      await realpath(directory),
    );
  });

  it("rejects missing paths", async () => {
    const parent = await makeTemporaryDirectory();
    await expect(
      resolveInventoryRoot(path.join(parent, "missing")),
    ).rejects.toThrow("does not exist or is inaccessible");
  });

  it("rejects regular files", async () => {
    const directory = await makeTemporaryDirectory();
    const file = path.join(directory, "file.txt");
    await writeFile(file, "not a directory");
    await expect(resolveInventoryRoot(file)).rejects.toThrow(
      "must be a directory",
    );
  });

  it("accepts a root supplied through a symlink and resolves it", async () => {
    const directory = await makeTemporaryDirectory();
    const link = path.join(directory, "root-link");
    const target = path.join(directory, "target");
    await mkdir(target);
    await symlink(target, link, "dir");
    expect(await resolveInventoryRoot(link)).toBe(await realpath(target));
  });
});
