import { describe, expect, it } from "vitest";
import { detectDatabaseAndInfrastructure } from "../src/technology/detect-database-and-infrastructure.js";
import type {
  InventoryFileInput,
  TechnologyManifest,
} from "../src/technology/manifest-reader.js";

function detect(paths: string[], manifests: TechnologyManifest[] = []) {
  const files: InventoryFileInput[] = paths.map((path) => ({
    path,
    sizeBytes: 10,
  }));
  return detectDatabaseAndInfrastructure(files, manifests);
}

describe("database and infrastructure detection", () => {
  it("detects database clients from supported Ruby and JavaScript declarations", () => {
    expect(
      detect(
        ["Gemfile", "api/package.json"],
        [
          {
            kind: "gemfile",
            path: "Gemfile",
            gemDeclarations: ["pg", "redis", "mysql2", "sqlite3", "mongoid"],
          },
          {
            kind: "package-json",
            path: "api/package.json",
            dependencies: [
              "mongoose",
              "better-sqlite3",
              "pg",
              "mysql",
              "mongodb",
              "redis",
              "ioredis",
              "sqlite3",
            ],
            devDependencies: [],
            optionalDependencies: [],
            peerDependencies: [],
          },
        ],
      ),
    ).toEqual([
      {
        category: "database",
        name: "MongoDB",
        confidence: "high",
        evidence: [
          { path: "Gemfile", method: "manifest-declaration" },
          { path: "api/package.json", method: "manifest-declaration" },
        ],
      },
      {
        category: "database",
        name: "MySQL",
        confidence: "high",
        evidence: [
          { path: "Gemfile", method: "manifest-declaration" },
          { path: "api/package.json", method: "manifest-declaration" },
        ],
      },
      {
        category: "database",
        name: "PostgreSQL",
        confidence: "high",
        evidence: [
          { path: "Gemfile", method: "manifest-declaration" },
          { path: "api/package.json", method: "manifest-declaration" },
        ],
      },
      {
        category: "database",
        name: "Redis",
        confidence: "high",
        evidence: [
          { path: "Gemfile", method: "manifest-declaration" },
          { path: "api/package.json", method: "manifest-declaration" },
        ],
      },
      {
        category: "database",
        name: "SQLite",
        confidence: "high",
        evidence: [
          { path: "Gemfile", method: "manifest-declaration" },
          { path: "api/package.json", method: "manifest-declaration" },
        ],
      },
    ]);
  });

  it("detects documented infrastructure paths across common deployment tools", () => {
    expect(
      detect([
        "Dockerfile",
        "services/api/Dockerfile.dev",
        "services/api/.dockerignore",
        "compose.yaml",
        "compose.yml",
        "docker/docker-compose.yaml",
        "docker/docker-compose.yml",
        "ops/terraform/main.tf",
        "ops/terraform/vars.tf.json",
        "ops/terraform/terraform.lock.hcl",
        "deploy/k8s/kustomization.yaml",
        "deploy/legacy/kustomization.yml",
        "charts/store/Chart.yaml",
        "infra/cdk.json",
        "deploy/serverless.yml",
        "deploy/legacy/serverless.yaml",
      ]),
    ).toEqual([
      {
        category: "infrastructure",
        name: "AWS CDK",
        confidence: "medium",
        evidence: [{ path: "infra/cdk.json", method: "configuration-path" }],
      },
      {
        category: "infrastructure",
        name: "Docker",
        confidence: "medium",
        evidence: [
          { path: "Dockerfile", method: "configuration-path" },
          { path: "services/api/.dockerignore", method: "configuration-path" },
          { path: "services/api/Dockerfile.dev", method: "configuration-path" },
        ],
      },
      {
        category: "infrastructure",
        name: "Docker Compose",
        confidence: "medium",
        evidence: [
          { path: "compose.yaml", method: "configuration-path" },
          { path: "compose.yml", method: "configuration-path" },
          {
            path: "docker/docker-compose.yaml",
            method: "configuration-path",
          },
          {
            path: "docker/docker-compose.yml",
            method: "configuration-path",
          },
        ],
      },
      {
        category: "infrastructure",
        name: "Helm",
        confidence: "medium",
        evidence: [
          { path: "charts/store/Chart.yaml", method: "configuration-path" },
        ],
      },
      {
        category: "infrastructure",
        name: "Kubernetes",
        confidence: "medium",
        evidence: [
          {
            path: "deploy/k8s/kustomization.yaml",
            method: "configuration-path",
          },
          {
            path: "deploy/legacy/kustomization.yml",
            method: "configuration-path",
          },
        ],
      },
      {
        category: "infrastructure",
        name: "Serverless Framework",
        confidence: "medium",
        evidence: [
          {
            path: "deploy/legacy/serverless.yaml",
            method: "configuration-path",
          },
          { path: "deploy/serverless.yml", method: "configuration-path" },
        ],
      },
      {
        category: "infrastructure",
        name: "Terraform",
        confidence: "high",
        evidence: [
          { path: "ops/terraform/main.tf", method: "configuration-path" },
          { path: "ops/terraform/terraform.lock.hcl", method: "lockfile-name" },
          {
            path: "ops/terraform/vars.tf.json",
            method: "configuration-path",
          },
        ],
      },
    ]);
  });

  it("reports generic database configuration without guessing a vendor", () => {
    expect(detect(["config/database.yml"])).toEqual([
      {
        category: "database",
        name: "Database configuration",
        confidence: "medium",
        evidence: [
          { path: "config/database.yml", method: "configuration-path" },
        ],
      },
    ]);
  });

  it("ignores generic filenames, unsupported dependencies, and secret-like paths", () => {
    expect(
      detect(
        [
          "Dockerfilex",
          "deployment.yaml",
          "main.tfvars.example",
          "application.properties",
          ".env",
          "secrets/cloud.json",
        ],
        [
          {
            kind: "package-json",
            path: "package.json",
            dependencies: ["custom-db-client", "my-terraform-helper"],
            devDependencies: [],
            optionalDependencies: [],
            peerDependencies: [],
          },
        ],
      ),
    ).toEqual([]);
  });

  it("deduplicates evidence and sorts output consistently", () => {
    expect(
      detect(
        ["z/Dockerfile", "a/Dockerfile", "a/Dockerfile"],
        [
          { kind: "gemfile", path: "z/Gemfile", gemDeclarations: ["pg"] },
          { kind: "gemfile", path: "a/Gemfile", gemDeclarations: ["pg"] },
        ],
      ),
    ).toEqual([
      {
        category: "database",
        name: "PostgreSQL",
        confidence: "high",
        evidence: [
          { path: "a/Gemfile", method: "manifest-declaration" },
          { path: "z/Gemfile", method: "manifest-declaration" },
        ],
      },
      {
        category: "infrastructure",
        name: "Docker",
        confidence: "medium",
        evidence: [
          { path: "a/Dockerfile", method: "configuration-path" },
          { path: "z/Dockerfile", method: "configuration-path" },
        ],
      },
    ]);
  });
});
