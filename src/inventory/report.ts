import { classifyInventoryExclusion } from "./exclusions.js";
import { traverseRepository, type ExclusionCounts } from "./traversal.js";

export interface InventoryReport {
  schemaVersion: 1;
  directories: string[];
  files: Array<{ path: string; sizeBytes: number }>;
  summary: {
    directoryCount: number;
    fileCount: number;
    inventoryBytes: number;
    excludedEntryCounts: ExclusionCounts;
  };
}

export async function createInventoryReport(
  repositoryRoot: string,
): Promise<InventoryReport> {
  const traversal = await traverseRepository(repositoryRoot, {
    classifyExclusion: classifyInventoryExclusion,
  });

  return {
    schemaVersion: 1,
    directories: traversal.directories,
    files: traversal.files,
    summary: {
      directoryCount: traversal.directories.length,
      fileCount: traversal.files.length,
      inventoryBytes: traversal.inventoryBytes,
      excludedEntryCounts: traversal.excludedEntryCounts,
    },
  };
}

export function serializeInventoryReport(report: InventoryReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
