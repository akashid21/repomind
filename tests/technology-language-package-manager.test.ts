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

  it("detects the cross-stack language extension baseline", () => {
    expect(
      detect([
        "backend/api.py",
        "backend/api.pyi",
        "service/Main.java",
        "worker/main.go",
        "web/index.php",
        "web/template.phtml",
        "api/Program.cs",
        "tools/Script.csx",
      ]),
    ).toEqual([
      {
        category: "language",
        name: "C#",
        confidence: "high",
        evidence: [
          { path: "api/Program.cs", method: "file-extension" },
          { path: "tools/Script.csx", method: "file-extension" },
        ],
      },
      {
        category: "language",
        name: "Go",
        confidence: "high",
        evidence: [{ path: "worker/main.go", method: "file-extension" }],
      },
      {
        category: "language",
        name: "Java",
        confidence: "high",
        evidence: [{ path: "service/Main.java", method: "file-extension" }],
      },
      {
        category: "language",
        name: "PHP",
        confidence: "high",
        evidence: [
          { path: "web/index.php", method: "file-extension" },
          { path: "web/template.phtml", method: "file-extension" },
        ],
      },
      {
        category: "language",
        name: "Python",
        confidence: "high",
        evidence: [
          { path: "backend/api.py", method: "file-extension" },
          { path: "backend/api.pyi", method: "file-extension" },
        ],
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

  it("detects documented package-manager manifests and lockfiles across ecosystems", () => {
    expect(
      detect([
        "requirements.txt",
        "Pipfile",
        "Pipfile.lock",
        "poetry.lock",
        "uv.lock",
        "pom.xml",
        "service/build.gradle.kts",
        "service/gradle.lockfile",
        "go.mod",
        "go.sum",
        "composer.json",
        "composer.lock",
        "dotnet/packages.lock.json",
        "dotnet/App.csproj",
      ]),
    ).toEqual([
      {
        category: "packageManager",
        name: "Composer",
        confidence: "high",
        evidence: [
          { path: "composer.json", method: "manifest-name" },
          { path: "composer.lock", method: "lockfile-name" },
        ],
      },
      {
        category: "packageManager",
        name: "Go Modules",
        confidence: "high",
        evidence: [
          { path: "go.mod", method: "manifest-name" },
          { path: "go.sum", method: "lockfile-name" },
        ],
      },
      {
        category: "packageManager",
        name: "Gradle",
        confidence: "high",
        evidence: [
          { path: "service/build.gradle.kts", method: "manifest-name" },
          { path: "service/gradle.lockfile", method: "lockfile-name" },
        ],
      },
      {
        category: "packageManager",
        name: "Maven",
        confidence: "high",
        evidence: [{ path: "pom.xml", method: "manifest-name" }],
      },
      {
        category: "packageManager",
        name: "NuGet",
        confidence: "high",
        evidence: [
          { path: "dotnet/App.csproj", method: "manifest-name" },
          { path: "dotnet/packages.lock.json", method: "lockfile-name" },
        ],
      },
      {
        category: "packageManager",
        name: "Pipenv",
        confidence: "high",
        evidence: [
          { path: "Pipfile", method: "manifest-name" },
          { path: "Pipfile.lock", method: "lockfile-name" },
        ],
      },
      {
        category: "packageManager",
        name: "Poetry",
        confidence: "high",
        evidence: [{ path: "poetry.lock", method: "lockfile-name" }],
      },
      {
        category: "packageManager",
        name: "pip",
        confidence: "high",
        evidence: [{ path: "requirements.txt", method: "manifest-name" }],
      },
      {
        category: "packageManager",
        name: "uv",
        confidence: "high",
        evidence: [{ path: "uv.lock", method: "lockfile-name" }],
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

  it("does not treat arbitrary build or project files as manager evidence", () => {
    expect(
      detect([
        "pom.xml.backup",
        "my-build.gradle",
        "Project.csproj.backup",
        "requirements-dev.in",
        "composer.json.example",
      ]),
    ).toEqual([]);
  });
});
