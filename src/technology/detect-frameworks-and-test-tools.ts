import {
  CONFIGURATION_TECHNOLOGY_RULES,
  DECLARED_TECHNOLOGY_RULES,
} from "./detector-rules.js";
import type {
  DetectedTechnology,
  TechnologyCategory,
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
 * Detect framework and test-tool hints from bounded manifest declarations and
 * exact configuration basenames. These are repository signals, not proof of
 * runtime use.
 */
export function detectFrameworksAndTestTools(
  files: readonly InventoryFileInput[],
  manifests: readonly TechnologyManifest[],
): DetectedTechnology[] {
  const claims = new Map<string, DetectedTechnology>();

  const addEvidence = (
    category: TechnologyCategory,
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
    const source = manifest.kind;
    const dependencies =
      manifest.kind === "gemfile"
        ? manifest.gemDeclarations
        : [
            ...manifest.dependencies,
            ...manifest.devDependencies,
            ...manifest.optionalDependencies,
            ...manifest.peerDependencies,
          ];
    for (const rule of DECLARED_TECHNOLOGY_RULES) {
      if (
        rule.source === source &&
        rule.dependencies.some((name) => dependencies.includes(name))
      ) {
        addEvidence(
          rule.category,
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
    for (const rule of CONFIGURATION_TECHNOLOGY_RULES) {
      if ((rule.filenames as readonly string[]).includes(name)) {
        addEvidence(
          rule.category,
          rule.name,
          file.path,
          "configuration-path",
          "medium",
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
