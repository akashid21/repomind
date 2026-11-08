import {
  DATABASE_CONFIGURATION_RULES,
  DATABASE_DECLARATION_RULES,
  INFRASTRUCTURE_PATH_RULES,
} from "./detector-rules.js";
import type {
  DetectedTechnology,
  TechnologyConfidence,
  TechnologyEvidenceMethod,
} from "./detect-languages-and-package-managers.js";
import type {
  InventoryFileInput,
  TechnologyManifest,
} from "./manifest-reader.js";

function compare(left: string, right: string): number {
  const a = Array.from(left, (character) => character.codePointAt(0)!);
  const b = Array.from(right, (character) => character.codePointAt(0)!);
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return a[index]! - b[index]!;
  }
  return a.length - b.length;
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * Detect database and infrastructure hints from existing bounded manifest
 * output and inventoried paths. It never opens configuration files or
 * contacts databases, cloud providers, or other external services.
 */
export function detectDatabaseAndInfrastructure(
  files: readonly InventoryFileInput[],
  manifests: readonly TechnologyManifest[],
): DetectedTechnology[] {
  const claims = new Map<string, DetectedTechnology>();

  const addEvidence = (
    category: "database" | "infrastructure",
    name: string,
    path: string,
    method: TechnologyEvidenceMethod,
    confidence: TechnologyConfidence,
  ): void => {
    const key = `${category}\0${name}`;
    let claim = claims.get(key);
    if (claim === undefined) {
      claim = { category, name, confidence, evidence: [] };
      claims.set(key, claim);
    } else if (confidence === "high") {
      claim.confidence = "high";
    }
    if (
      !claim.evidence.some(
        (item) => item.path === path && item.method === method,
      )
    ) {
      claim.evidence.push({ path, method });
    }
  };

  for (const manifest of manifests) {
    const dependencies =
      manifest.kind === "gemfile"
        ? manifest.gemDeclarations
        : [
            ...manifest.dependencies,
            ...manifest.devDependencies,
            ...manifest.optionalDependencies,
            ...manifest.peerDependencies,
          ];
    for (const rule of DATABASE_DECLARATION_RULES) {
      if (
        rule.source === manifest.kind &&
        rule.dependencies.some((dependency) =>
          dependencies.includes(dependency),
        )
      ) {
        addEvidence(
          "database",
          rule.name,
          manifest.path,
          "manifest-declaration",
          "high",
        );
      }
    }
  }

  for (const file of files) {
    const name = basename(file.path);
    for (const rule of DATABASE_CONFIGURATION_RULES) {
      if ((rule.filenames as readonly string[]).includes(name)) {
        addEvidence(
          "database",
          rule.name,
          file.path,
          "configuration-path",
          "medium",
        );
      }
    }

    for (const rule of INFRASTRUCTURE_PATH_RULES) {
      const filenameMatch =
        "filenames" in rule &&
        (rule.filenames as readonly string[]).includes(name);
      const prefixMatch =
        "filenamePrefixes" in rule &&
        (rule.filenamePrefixes as readonly string[]).some((prefix) =>
          name.startsWith(prefix),
        );
      const extensionMatch =
        "extensions" in rule &&
        (rule.extensions as readonly string[]).some((suffix) =>
          name.endsWith(suffix),
        );
      if (filenameMatch || prefixMatch || extensionMatch) {
        const method = "method" in rule ? rule.method : "configuration-path";
        addEvidence(
          "infrastructure",
          rule.name,
          file.path,
          method,
          method === "lockfile-name" ? "high" : "medium",
        );
      }
    }
  }

  return [...claims.values()]
    .map((claim) => ({
      ...claim,
      evidence: claim.evidence.sort(
        (left, right) =>
          compare(left.path, right.path) || compare(left.method, right.method),
      ),
    }))
    .sort(
      (left, right) =>
        compare(left.category, right.category) ||
        compare(left.name, right.name),
    );
}
