import {
  LANGUAGE_EXTENSION_RULES,
  PACKAGE_MANAGER_DECLARATION_RULES,
  PACKAGE_MANAGER_LOCKFILE_RULES,
} from "./detector-rules.js";
import type {
  InventoryFileInput,
  ManifestReaderResult,
} from "./manifest-reader.js";

export type TechnologyCategory = "language" | "packageManager";
export type TechnologyConfidence = "high" | "medium" | "low";
export type TechnologyEvidenceMethod =
  | "file-extension"
  | "manifest-name"
  | "lockfile-name"
  | "manifest-declaration"
  | "configuration-path";

export interface TechnologyEvidence {
  path: string;
  method: TechnologyEvidenceMethod;
}

export interface DetectedTechnology {
  category: TechnologyCategory;
  name: string;
  confidence: TechnologyConfidence;
  evidence: TechnologyEvidence[];
}

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

function extension(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot).toLowerCase();
}

/**
 * Detect language and package-manager evidence from the completed M1 inventory
 * and M2-02's bounded manifest reader output. This reports repository signals,
 * not runtime usage.
 */
export function detectLanguagesAndPackageManagers(
  files: readonly InventoryFileInput[],
  manifestResult: ManifestReaderResult,
): DetectedTechnology[] {
  const claims = new Map<string, DetectedTechnology>();

  const addEvidence = (
    category: TechnologyCategory,
    name: string,
    path: string,
    method: TechnologyEvidenceMethod,
  ): void => {
    const key = `${category}\0${name}`;
    let claim = claims.get(key);
    if (claim === undefined) {
      claim = { category, name, confidence: "high", evidence: [] };
      claims.set(key, claim);
    }
    if (
      !claim.evidence.some(
        (item) => item.path === path && item.method === method,
      )
    ) {
      claim.evidence.push({ path, method });
    }
  };

  for (const file of files) {
    const ext = extension(file.path);
    for (const rule of LANGUAGE_EXTENSION_RULES) {
      if ((rule.extensions as readonly string[]).includes(ext)) {
        addEvidence("language", rule.name, file.path, "file-extension");
      }
    }
    const name = basename(file.path);
    for (const rule of PACKAGE_MANAGER_LOCKFILE_RULES) {
      if ((rule.filenames as readonly string[]).includes(name)) {
        addEvidence("packageManager", rule.name, file.path, "lockfile-name");
      }
    }
  }

  for (const manifest of manifestResult.manifests) {
    if (
      manifest.kind !== "package-json" ||
      manifest.packageManager === undefined
    ) {
      continue;
    }
    const prefix = /^([A-Za-z][A-Za-z0-9_-]*)(?:@|$)/
      .exec(manifest.packageManager)?.[1]
      ?.toLowerCase();
    const rule = PACKAGE_MANAGER_DECLARATION_RULES.find(
      (candidate) => candidate.prefix === prefix,
    );
    if (rule !== undefined) {
      addEvidence(
        "packageManager",
        rule.name,
        manifest.path,
        "manifest-declaration",
      );
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
