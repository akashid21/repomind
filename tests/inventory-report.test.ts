import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { classifyInventoryExclusion } from "../src/inventory/exclusions.js";
import {
  createInventoryReport,
  serializeInventoryReport,
} from "../src/inventory/report.js";

const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "repomind-report-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeFixtureFile(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("inventory exclusions", () => {
  it.each([
    [".GIT", "directory", "generated"],
    ["Dist", "directory", "generated"],
    ["NODE_MODULES", "directory", "dependency"],
    ["Vendor", "directory", "dependency"],
    [".AWS", "directory", "secretOrLocalConfig"],
    [".ENV.production", "file", "secretOrLocalConfig"],
    ["id_ed25519", "file", "secretOrLocalConfig"],
    ["server.PEM", "file", "secretOrLocalConfig"],
    ["bundle.MIN.JS", "file", "generated"],
    ["styles.min.css", "file", "generated"],
    ["source.MAP", "file", "generated"],
    ["image.PnG", "file", "binary"],
  ] as const)("classifies %s (%s) as %s", (entryName, kind, category) => {
    expect(classifyInventoryExclusion(entryName, kind)).toBe(category);
  });

  it.each([".env.example", ".env.sample", ".env.template"])(
    "retains environment example %s",
    (entryName) => {
      expect(classifyInventoryExclusion(entryName, "file")).toBeUndefined();
    },
  );

  it.each([
    ["package.json", "file"],
    ["pnpm-lock.yaml", "file"],
    ["app/db/migrate/001_create.sql", "file"],
    ["test", "directory"],
    [".github/workflows", "directory"],
    ["Dockerfile", "file"],
    ["schema.graphql", "file"],
  ] as const)(
    "keeps important project input %s eligible",
    (entryPath, kind) => {
      expect(classifyInventoryExclusion(entryPath, kind)).toBeUndefined();
    },
  );
});

describe("inventory report", () => {
  it("omits excluded paths and secret values, and produces a stable report", async () => {
    const root = await makeTemporaryDirectory();
    await writeFixtureFile(root, ".env", "SECRET_VALUE_DO_NOT_REPORT");
    await writeFixtureFile(root, ".env.sample", "EXAMPLE_VALUE");
    await writeFixtureFile(root, "package.json", "{}");
    await writeFixtureFile(root, "pnpm-lock.yaml", "lock data");
    await writeFixtureFile(root, "README.md", "read me");
    await writeFixtureFile(root, "app/models/order.rb", "class Order; end");
    await writeFixtureFile(root, "test/order_test.rb", "test");
    await writeFixtureFile(root, "Dockerfile", "FROM node");
    await writeFixtureFile(root, "dist/bundle.js", "generated");
    await writeFixtureFile(root, "node_modules/pkg/index.js", "dependency");
    await writeFixtureFile(root, "config/secrets/api.key", "credential");
    await writeFixtureFile(root, "assets/logo.PNG", "binary fixture");
    await writeFixtureFile(root, "assets/app.min.js", "minified");
    await writeFixtureFile(root, "assets/app.js.map", "source map");

    const firstReport = await createInventoryReport(root);
    const secondReport = await createInventoryReport(root);
    const serialized = serializeInventoryReport(firstReport);
    const filePaths = firstReport.files.map((file) => file.path);

    expect(serialized).toBe(serializeInventoryReport(secondReport));
    expect(serialized.endsWith("\n")).toBe(true);
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("SECRET_VALUE_DO_NOT_REPORT");
    expect(filePaths).toContain(".env.sample");
    expect(filePaths).toContain("package.json");
    expect(filePaths).toContain("pnpm-lock.yaml");
    expect(filePaths).toContain("app/models/order.rb");
    expect(filePaths).not.toContain(".env");
    expect(filePaths).not.toContain("dist/bundle.js");
    expect(filePaths).not.toContain("node_modules/pkg/index.js");
    expect(firstReport.directories).not.toContain("config/secrets");
    expect(firstReport.summary.excludedEntryCounts).toEqual({
      generated: 3,
      dependency: 1,
      secretOrLocalConfig: 2,
      binary: 1,
      symlink: 0,
      oversized: 0,
      tooDeep: 0,
      unreadable: 0,
      unsupported: 0,
    });
    expect(firstReport.summary.directoryCount).toBe(
      firstReport.directories.length,
    );
    expect(firstReport.summary.fileCount).toBe(firstReport.files.length);
    expect(firstReport.summary.inventoryBytes).toBe(
      firstReport.files.reduce((total, file) => total + file.sizeBytes, 0),
    );

    const parsedReport = JSON.parse(serialized) as Record<string, unknown>;
    expect(Object.keys(parsedReport)).toEqual([
      "schemaVersion",
      "directories",
      "files",
      "summary",
    ]);
    expect(
      Object.keys(parsedReport.summary as Record<string, unknown>),
    ).toEqual([
      "directoryCount",
      "fileCount",
      "inventoryBytes",
      "excludedEntryCounts",
    ]);
  });
});
