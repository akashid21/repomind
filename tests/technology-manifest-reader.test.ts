import {
  access,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ManifestReaderError,
  readTechnologyManifests,
  type InventoryFileInput,
} from "../src/technology/manifest-reader.js";

const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "repomind-manifest-reader-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}

async function writeFixtureFile(
  root: string,
  relativePath: string,
  contents: string,
): Promise<InventoryFileInput> {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);
  return { path: relativePath, sizeBytes: Buffer.byteLength(contents) };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("bounded technology manifest reader", () => {
  it("reads only approved fields and simple literal Gemfile declarations", async () => {
    const root = await makeTemporaryDirectory();
    const scriptMarker = path.join(root, "script-was-run");
    const packageJson = JSON.stringify({
      name: "sample-app",
      packageManager: "pnpm@9.0.0",
      dependencies: {
        react: "^19.0.0",
        secretPackage: "DO_NOT_RETURN_VERSION",
      },
      devDependencies: { vitest: "^4.0.0" },
      scripts: { preinstall: `touch ${scriptMarker}` },
    });
    const gemfile = [
      "source 'https://rubygems.org'",
      "gem 'rails', '~> 8.0'",
      'gem("pg")',
      "gem name_from_variable",
      "# gem 'commented-out'",
      "gem 'rails', path: eval('unsafe')",
    ].join("\n");
    const inventoryFiles = [
      await writeFixtureFile(root, "package.json", packageJson),
      await writeFixtureFile(root, "Gemfile", gemfile),
      await writeFixtureFile(root, "nested/README.md", "ignored"),
    ];

    const result = await readTechnologyManifests(root, inventoryFiles);

    expect(result.warnings).toEqual([]);
    expect(result.manifests).toEqual([
      {
        kind: "gemfile",
        path: "Gemfile",
        gemDeclarations: ["pg", "rails"],
      },
      {
        kind: "package-json",
        path: "package.json",
        packageManager: "pnpm@9.0.0",
        dependencies: ["react", "secretPackage"],
        devDependencies: ["vitest"],
        optionalDependencies: [],
        peerDependencies: [],
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("DO_NOT_RETURN_VERSION");
    await expect(access(scriptMarker)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("ignores supported-looking files absent from the completed inventory", async () => {
    const root = await makeTemporaryDirectory();
    await writeFixtureFile(root, "package.json", '{"dependencies":{"x":"1"}}');

    const result = await readTechnologyManifests(root, []);

    expect(result).toEqual({ manifests: [], warnings: [] });
  });

  it("reports malformed JSON without including parser text or manifest values", async () => {
    const root = await makeTemporaryDirectory();
    const file = await writeFixtureFile(
      root,
      "package.json",
      '{"token":"PRIVATE_VALUE",',
    );

    const result = await readTechnologyManifests(root, [file]);

    expect(result.manifests).toEqual([]);
    expect(result.warnings).toEqual([
      { code: "manifest-malformed", path: "package.json" },
    ]);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_VALUE");
  });

  it("reports missing, changed, symlinked, and escaping manifest paths safely", async () => {
    const root = await makeTemporaryDirectory();
    const outside = await makeTemporaryDirectory();
    const outsideFile = await writeFixtureFile(
      outside,
      "package.json",
      '{"dependencies":{"external":"1"}}',
    );
    await symlink(
      path.join(outside, "package.json"),
      path.join(root, "linked-package.json"),
    );
    const missing = { path: "missing/package.json", sizeBytes: 2 };
    const linked = { path: "linked-package.json/package.json", sizeBytes: 2 };
    const escaping = {
      path: `../${path.basename(outside)}/package.json`,
      sizeBytes: outsideFile.sizeBytes,
    };
    await writeFixtureFile(root, "changed/package.json", "{}");
    const changed = { path: "changed/package.json", sizeBytes: 1 };

    const result = await readTechnologyManifests(root, [
      missing,
      linked,
      escaping,
      changed,
    ]);

    expect(result.manifests).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "manifest-unreadable",
      "manifest-unreadable",
      "manifest-unreadable",
      "manifest-unreadable",
    ]);
    expect(JSON.stringify(result)).not.toContain(outside);
  });

  it("skips a manifest over its configured byte limit", async () => {
    const root = await makeTemporaryDirectory();
    const file = await writeFixtureFile(root, "package.json", '{"x":1}');

    const result = await readTechnologyManifests(root, [file], {
      limits: { maxFileBytes: 5 },
    });

    expect(result.manifests).toEqual([]);
    expect(result.warnings).toEqual([
      { code: "manifest-oversized", path: "package.json" },
    ]);
  });

  it("enforces candidate-count and aggregate-byte limits deterministically", async () => {
    const root = await makeTemporaryDirectory();
    const files = [
      await writeFixtureFile(root, "a/package.json", "{}"),
      await writeFixtureFile(root, "b/package.json", "{}"),
    ];

    const countLimited = await readTechnologyManifests(root, files, {
      limits: { maxManifests: 1 },
    });
    expect(countLimited.manifests).toHaveLength(1);
    expect(countLimited.manifests[0]?.path).toBe("a/package.json");
    expect(countLimited.warnings).toEqual([{ code: "manifest-count-limit" }]);

    const byteLimited = await readTechnologyManifests(root, files, {
      limits: { maxTotalBytes: 3n },
    });
    expect(byteLimited.manifests).toHaveLength(1);
    expect(byteLimited.manifests[0]?.path).toBe("a/package.json");
    expect(byteLimited.warnings).toEqual([
      { code: "manifest-total-size-limit" },
    ]);
  });

  it("rejects an invalid repository root", async () => {
    await expect(
      readTechnologyManifests("/path/that/does/not/exist", []),
    ).rejects.toBeInstanceOf(ManifestReaderError);
  });
});
