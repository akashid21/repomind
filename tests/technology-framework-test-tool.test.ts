import { describe, expect, it } from "vitest";
import { detectFrameworksAndTestTools } from "../src/technology/detect-frameworks-and-test-tools.js";
import type {
  InventoryFileInput,
  TechnologyManifest,
} from "../src/technology/manifest-reader.js";

function detect(paths: string[], manifests: TechnologyManifest[] = []) {
  const files: InventoryFileInput[] = paths.map((path) => ({
    path,
    sizeBytes: 10,
  }));
  return detectFrameworksAndTestTools(files, manifests);
}

describe("framework and test-tool detection", () => {
  it("detects Ruby and JavaScript declarations without conflating the stacks", () => {
    expect(
      detect(
        ["Gemfile", "package.json"],
        [
          {
            kind: "gemfile",
            path: "Gemfile",
            gemDeclarations: ["rails", "rspec", "minitest"],
          },
          {
            kind: "package-json",
            path: "web/package.json",
            dependencies: [
              "react",
              "express",
              "@nestjs/core",
              "next",
              "@angular/core",
              "vue",
              "svelte",
              "jest",
            ],
            devDependencies: ["vitest", "@playwright/test", "cypress"],
            optionalDependencies: [],
            peerDependencies: [],
          },
        ],
      ),
    ).toEqual([
      {
        category: "framework",
        name: "Angular",
        confidence: "high",
        evidence: [
          { path: "web/package.json", method: "manifest-declaration" },
        ],
      },
      {
        category: "framework",
        name: "Express",
        confidence: "high",
        evidence: [
          { path: "web/package.json", method: "manifest-declaration" },
        ],
      },
      {
        category: "framework",
        name: "NestJS",
        confidence: "high",
        evidence: [
          { path: "web/package.json", method: "manifest-declaration" },
        ],
      },
      {
        category: "framework",
        name: "Next.js",
        confidence: "high",
        evidence: [
          { path: "web/package.json", method: "manifest-declaration" },
        ],
      },
      {
        category: "framework",
        name: "Rails",
        confidence: "high",
        evidence: [{ path: "Gemfile", method: "manifest-declaration" }],
      },
      {
        category: "framework",
        name: "React",
        confidence: "high",
        evidence: [
          { path: "web/package.json", method: "manifest-declaration" },
        ],
      },
      {
        category: "framework",
        name: "Svelte",
        confidence: "high",
        evidence: [
          { path: "web/package.json", method: "manifest-declaration" },
        ],
      },
      {
        category: "framework",
        name: "Vue",
        confidence: "high",
        evidence: [
          { path: "web/package.json", method: "manifest-declaration" },
        ],
      },
      {
        category: "testTool",
        name: "Cypress",
        confidence: "high",
        evidence: [
          { path: "web/package.json", method: "manifest-declaration" },
        ],
      },
      {
        category: "testTool",
        name: "Jest",
        confidence: "high",
        evidence: [
          { path: "web/package.json", method: "manifest-declaration" },
        ],
      },
      {
        category: "testTool",
        name: "Minitest",
        confidence: "high",
        evidence: [{ path: "Gemfile", method: "manifest-declaration" }],
      },
      {
        category: "testTool",
        name: "Playwright",
        confidence: "high",
        evidence: [
          { path: "web/package.json", method: "manifest-declaration" },
        ],
      },
      {
        category: "testTool",
        name: "RSpec",
        confidence: "high",
        evidence: [{ path: "Gemfile", method: "manifest-declaration" }],
      },
      {
        category: "testTool",
        name: "Vitest",
        confidence: "high",
        evidence: [
          { path: "web/package.json", method: "manifest-declaration" },
        ],
      },
    ]);
  });

  it("detects exact configuration paths as medium-confidence hints", () => {
    expect(
      detect([
        "backend/manage.py",
        "legacy/artisan",
        "tests/vitest.config.ts",
        "ui/cypress.config.ts",
      ]),
    ).toEqual([
      {
        category: "framework",
        name: "Django",
        confidence: "medium",
        evidence: [{ path: "backend/manage.py", method: "configuration-path" }],
      },
      {
        category: "framework",
        name: "Laravel",
        confidence: "medium",
        evidence: [{ path: "legacy/artisan", method: "configuration-path" }],
      },
      {
        category: "testTool",
        name: "Cypress",
        confidence: "medium",
        evidence: [
          { path: "ui/cypress.config.ts", method: "configuration-path" },
        ],
      },
      {
        category: "testTool",
        name: "Vitest",
        confidence: "medium",
        evidence: [
          { path: "tests/vitest.config.ts", method: "configuration-path" },
        ],
      },
    ]);
  });

  it("upgrades a configuration hint when a direct declaration also exists", () => {
    const result = detect(
      ["vitest.config.ts"],
      [
        {
          kind: "package-json",
          path: "package.json",
          dependencies: [],
          devDependencies: ["vitest"],
          optionalDependencies: [],
          peerDependencies: [],
        },
      ],
    );
    expect(result).toEqual([
      {
        category: "testTool",
        name: "Vitest",
        confidence: "high",
        evidence: [
          { path: "package.json", method: "manifest-declaration" },
          { path: "vitest.config.ts", method: "configuration-path" },
        ],
      },
    ]);
  });

  it("ignores unsupported dependencies and generic filenames", () => {
    expect(
      detect(
        ["package.json", "application.properties", "Program.cs"],
        [
          {
            kind: "package-json",
            path: "package.json",
            dependencies: ["my-custom-framework"],
            devDependencies: [],
            optionalDependencies: [],
            peerDependencies: [],
          },
        ],
      ),
    ).toEqual([]);
  });
});
