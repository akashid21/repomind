import { describe, expect, it } from "vitest";
import {
  detectLanguagesAndPackageManagers,
  type DetectedTechnology,
} from "../src/technology/detect-languages-and-package-managers.js";
import type {
  InventoryFileInput,
  ManifestReaderResult,
} from "../src/technology/manifest-reader.js";

function detect(
  paths: string[],
  manifests: ManifestReaderResult["manifests"] = [],
): DetectedTechnology[] {
  const files: InventoryFileInput[] = paths.map((path) => ({
    path,
    sizeBytes: 10,
  }));
  return detectLanguagesAndPackageManagers(files, { manifests, warnings: [] });
}

describe("language and package-manager detection", () => {
  it("preserves multiple language signals and cites extension paths", () => {
    expect(
      detect(["app/models/order.rb", "src/main.ts", "web/view.jsx"]),
    ).toEqual([
      {
        category: "language",
        name: "JavaScript",
        confidence: "high",
        evidence: [{ path: "web/view.jsx", method: "file-extension" }],
      },
      {
        category: "language",
        name: "Ruby",
        confidence: "high",
        evidence: [{ path: "app/models/order.rb", method: "file-extension" }],
      },
      {
        category: "language",
        name: "TypeScript",
        confidence: "high",
        evidence: [{ path: "src/main.ts", method: "file-extension" }],
      },
    ]);
  });

  it("detects exact lockfile signals and allowlisted packageManager declarations", () => {
    expect(
      detect(
        ["package-lock.json", "frontend/yarn.lock", "Gemfile.lock"],
        [
          {
            kind: "package-json",
            path: "package.json",
            packageManager: "pnpm@9.0.0",
            dependencies: [],
            devDependencies: [],
            optionalDependencies: [],
            peerDependencies: [],
          },
        ],
      ),
    ).toEqual([
      {
        category: "packageManager",
        name: "Bundler",
        confidence: "high",
        evidence: [{ path: "Gemfile.lock", method: "lockfile-name" }],
      },
      {
        category: "packageManager",
        name: "Yarn",
        confidence: "high",
        evidence: [{ path: "frontend/yarn.lock", method: "lockfile-name" }],
      },
      {
        category: "packageManager",
        name: "npm",
        confidence: "high",
        evidence: [{ path: "package-lock.json", method: "lockfile-name" }],
      },
      {
        category: "packageManager",
        name: "pnpm",
        confidence: "high",
        evidence: [{ path: "package.json", method: "manifest-declaration" }],
      },
    ]);
  });

  it("merges duplicate signals and sorts evidence deterministically", () => {
    expect(detect(["z/src/a.ts", "a/src/b.ts", "a/src/b.ts"])).toEqual([
      {
        category: "language",
        name: "TypeScript",
        confidence: "high",
        evidence: [
          { path: "a/src/b.ts", method: "file-extension" },
          { path: "z/src/a.ts", method: "file-extension" },
        ],
      },
    ]);
  });

  it("emits no language or manager claim when evidence is absent or ambiguous", () => {
    expect(
      detect(
        ["package.json", "README.md", "src/no-extension"],
        [
          {
            kind: "package-json",
            path: "package.json",
            packageManager: "custom-manager@1.0.0",
            dependencies: [],
            devDependencies: [],
            optionalDependencies: [],
            peerDependencies: [],
          },
        ],
      ),
    ).toEqual([]);
  });

  it("does not infer npm from package.json alone or from a generic lock filename", () => {
    expect(detect(["package.json", "lockfile", "yarn.lock.backup"])).toEqual(
      [],
    );
  });
});
