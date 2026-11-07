import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  InventoryLimitError,
  InventoryTraversalError,
  traverseRepository,
} from "../src/inventory/traversal.js";

const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "repomind-traversal-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("repository traversal", () => {
  it("returns normalized relative paths and metadata in stable order", async () => {
    const root = await makeTemporaryDirectory();
    await mkdir(path.join(root, "z-dir"));
    await writeFile(path.join(root, "z-dir", "b.txt"), "123");
    await writeFile(path.join(root, "Alpha.txt"), "12");
    await writeFile(path.join(root, "beta.txt"), "1");

    const result = await traverseRepository(root);

    expect(result.directories).toEqual(["z-dir"]);
    expect(result.files).toEqual([
      { path: "Alpha.txt", sizeBytes: 2 },
      { path: "beta.txt", sizeBytes: 1 },
      { path: "z-dir/b.txt", sizeBytes: 3 },
    ]);
    expect(result.inventoryBytes).toBe(6);
  });

  it("uses Unicode code-point ordering for paths", async () => {
    const root = await makeTemporaryDirectory();
    await writeFile(path.join(root, "\uE000.txt"), "private use");
    await writeFile(path.join(root, "😀.txt"), "emoji");

    const result = await traverseRepository(root);

    expect(result.files.map((file) => file.path)).toEqual([
      "\uE000.txt",
      "😀.txt",
    ]);
  });

  it("skips symlinks without following internal or external targets", async () => {
    const root = await makeTemporaryDirectory();
    const outside = await makeTemporaryDirectory();
    await writeFile(path.join(root, "inside.txt"), "inside");
    await writeFile(path.join(outside, "outside.txt"), "outside");
    await symlink(
      path.join(root, "inside.txt"),
      path.join(root, "internal-link"),
    );
    await symlink(outside, path.join(root, "external-link"), "dir");

    const result = await traverseRepository(root);

    expect(result.files.map((file) => file.path)).toEqual(["inside.txt"]);
    expect(result.excludedEntryCounts.symlink).toBe(2);
  });

  it("accepts a symlink as the selected root and resolves it before walking", async () => {
    const parent = await makeTemporaryDirectory();
    const root = path.join(parent, "root");
    const rootLink = path.join(parent, "root-link");
    await mkdir(root);
    await writeFile(path.join(root, "file.txt"), "ok");
    await symlink(root, rootLink, "dir");

    const result = await traverseRepository(rootLink);

    expect(result.files.map((file) => file.path)).toEqual(["file.txt"]);
  });

  it("skips a directory subtree once it exceeds the depth limit", async () => {
    const root = await makeTemporaryDirectory();
    await mkdir(path.join(root, "one", "two", "three"), { recursive: true });
    await writeFile(
      path.join(root, "one", "two", "three", "file.txt"),
      "ignored",
    );
    await writeFile(path.join(root, "one", "file.txt"), "included");

    const result = await traverseRepository(root, {
      limits: { maxDepth: 2 },
    });

    expect(result.directories).toEqual(["one", "one/two"]);
    expect(result.files.map((file) => file.path)).toEqual(["one/file.txt"]);
    expect(result.excludedEntryCounts.tooDeep).toBe(1);
  });

  it("skips files larger than the per-file limit", async () => {
    const root = await makeTemporaryDirectory();
    const file = path.join(root, "large.txt");
    await writeFile(file, "");
    await truncate(file, 6);

    const result = await traverseRepository(root, {
      limits: { maxFileBytes: 5 },
    });

    expect(result.files).toEqual([]);
    expect(result.excludedEntryCounts.oversized).toBe(1);
  });

  it("does not exceed the included-file count", async () => {
    const root = await makeTemporaryDirectory();
    await writeFile(path.join(root, "one.txt"), "1");
    await writeFile(path.join(root, "two.txt"), "2");

    await expect(
      traverseRepository(root, { limits: { maxFiles: 1 } }),
    ).rejects.toBeInstanceOf(InventoryLimitError);
  });

  it("does not exceed the included-directory count", async () => {
    const root = await makeTemporaryDirectory();
    await mkdir(path.join(root, "one"));
    await mkdir(path.join(root, "two"));

    await expect(
      traverseRepository(root, { limits: { maxDirectories: 1 } }),
    ).rejects.toThrow("maximum included directory count");
  });

  it("does not exceed the included total-byte limit", async () => {
    const root = await makeTemporaryDirectory();
    await writeFile(path.join(root, "one.txt"), "123");
    await writeFile(path.join(root, "two.txt"), "45");

    await expect(
      traverseRepository(root, { limits: { maxTotalBytes: 4n } }),
    ).rejects.toThrow("maximum included total size");
  });

  it("prunes entries classified as excluded before walking them", async () => {
    const root = await makeTemporaryDirectory();
    await mkdir(path.join(root, "private"));
    await writeFile(path.join(root, "private", "secret.txt"), "not read");
    await writeFile(path.join(root, "visible.txt"), "visible");

    const result = await traverseRepository(root, {
      classifyExclusion: (relativePath, kind) =>
        relativePath === "private" && kind === "directory"
          ? "secretOrLocalConfig"
          : undefined,
    });

    expect(result.directories).toEqual([]);
    expect(result.files.map((file) => file.path)).toEqual(["visible.txt"]);
    expect(result.excludedEntryCounts.secretOrLocalConfig).toBe(1);
  });

  it("rejects a non-directory traversal root", async () => {
    const parent = await makeTemporaryDirectory();
    const file = path.join(parent, "file.txt");
    await writeFile(file, "file");

    await expect(traverseRepository(file)).rejects.toBeInstanceOf(
      InventoryTraversalError,
    );
  });
});
