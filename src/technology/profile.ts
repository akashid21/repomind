import { detectDatabaseAndInfrastructure } from "./detect-database-and-infrastructure.js";
import { detectFrameworksAndTestTools } from "./detect-frameworks-and-test-tools.js";
import { detectLanguagesAndPackageManagers } from "./detect-languages-and-package-managers.js";
import type {
  DetectedTechnology,
  TechnologyConfidence,
} from "./detect-languages-and-package-managers.js";
import type {
  InventoryFileInput,
  ManifestReaderResult,
  ManifestWarning,
} from "./manifest-reader.js";

export interface TechnologyProfile {
  schemaVersion: 1;
  status: "complete" | "partial";
  technologies: DetectedTechnology[];
  warnings: ManifestWarning[];
}

function compare(left: string, right: string): number {
  const a = Array.from(left, (character) => character.codePointAt(0)!);
  const b = Array.from(right, (character) => character.codePointAt(0)!);
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return a[index]! - b[index]!;
  }
  return a.length - b.length;
}

const CONFIDENCE_RANK: Record<TechnologyConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function combineTechnologies(
  technologies: readonly DetectedTechnology[],
): DetectedTechnology[] {
  const combined = new Map<string, DetectedTechnology>();

  for (const technology of technologies) {
    const key = `${technology.category}\0${technology.name}`;
    const existing = combined.get(key);
    if (existing === undefined) {
      combined.set(key, {
        ...technology,
        evidence: [...technology.evidence],
      });
      continue;
    }

    if (
      CONFIDENCE_RANK[technology.confidence] >
      CONFIDENCE_RANK[existing.confidence]
    ) {
      existing.confidence = technology.confidence;
    }
    for (const evidence of technology.evidence) {
      if (
        !existing.evidence.some(
          (item) =>
            item.path === evidence.path && item.method === evidence.method,
        )
      ) {
        existing.evidence.push(evidence);
      }
    }
  }

  return [...combined.values()]
    .map((technology) => ({
      ...technology,
      evidence: technology.evidence.sort(
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

function sortWarnings(warnings: readonly ManifestWarning[]): ManifestWarning[] {
  const unique = new Map<string, ManifestWarning>();
  for (const warning of warnings) {
    unique.set(`${warning.code}\0${warning.path ?? ""}`, { ...warning });
  }
  return [...unique.values()].sort(
    (left, right) =>
      compare(left.path ?? "", right.path ?? "") ||
      compare(left.code, right.code),
  );
}

/** Assemble a schema-v1 profile from completed inventory and bounded reads. */
export function assembleTechnologyProfile(
  files: readonly InventoryFileInput[],
  manifestResult: ManifestReaderResult,
): TechnologyProfile {
  const technologies = combineTechnologies([
    ...detectLanguagesAndPackageManagers(files, manifestResult),
    ...detectFrameworksAndTestTools(files, manifestResult.manifests),
    ...detectDatabaseAndInfrastructure(files, manifestResult.manifests),
  ]);
  const warnings = sortWarnings(manifestResult.warnings);

  return {
    schemaVersion: 1,
    status: warnings.length === 0 ? "complete" : "partial",
    technologies,
    warnings,
  };
}

export function serializeTechnologyProfile(profile: TechnologyProfile): string {
  return `${JSON.stringify(profile, null, 2)}\n`;
}
