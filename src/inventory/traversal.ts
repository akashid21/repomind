import { lstat, opendir, realpath } from "node:fs/promises";
import path from "node:path";

export const INVENTORY_LIMITS = {
  maxDepth: 50,
  maxFileBytes: 20 * 1024 * 1024,
  maxFiles: 200_000,
  maxDirectories: 200_000,
  maxTotalBytes: 2n * 1024n ** 3n,
} as const;

const COUNT_KEYS = [
  "generated",
  "dependency",
  "secretOrLocalConfig",
  "binary",
  "symlink",
  "oversized",
  "tooDeep",
  "unreadable",
  "unsupported",
] as const;

export type ExclusionCategory = (typeof COUNT_KEYS)[number];
export type EntryKind = "directory" | "file";

export type ExclusionCounts = Record<ExclusionCategory, number>;

export interface InventoryTraversalResult {
  directories: string[];
  files: Array<{ path: string; sizeBytes: number }>;
  inventoryBytes: number;
  excludedEntryCounts: ExclusionCounts;
}

export interface InventoryTraversalOptions {
  limits?: Partial<{
    maxDepth: number;
    maxFileBytes: number;
    maxFiles: number;
    maxDirectories: number;
    maxTotalBytes: bigint;
  }>;
  classifyExclusion?: (
    relativePath: string,
    kind: EntryKind,
  ) => ExclusionCategory | undefined;
}

export class InventoryTraversalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryTraversalError";
  }
}

export class InventoryLimitError extends InventoryTraversalError {
  constructor(message: string) {
    super(message);
    this.name = "InventoryLimitError";
  }
}

interface ResolvedLimits {
  maxDepth: number;
  maxFileBytes: number;
  maxFiles: number;
  maxDirectories: number;
  maxTotalBytes: bigint;
}

function createCounts(): ExclusionCounts {
  return Object.fromEntries(
    COUNT_KEYS.map((key) => [key, 0]),
  ) as ExclusionCounts;
}

function compareCodePointOrder(left: string, right: string): number {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0)!);
  const rightPoints = Array.from(right, (character) =>
    character.codePointAt(0)!,
  );
  const sharedLength = Math.min(leftPoints.length, rightPoints.length);

  for (let index = 0; index < sharedLength; index += 1) {
    const difference = leftPoints[index]! - rightPoints[index]!;
    if (difference !== 0) return difference;
  }

  return leftPoints.length - rightPoints.length;
}

function isWithinRoot(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate);
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

function isRecoverableChildError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return ["EACCES", "EPERM", "ENOENT", "ENOTDIR"].includes(String(error.code));
}

function increment(counts: ExclusionCounts, key: ExclusionCategory): void {
  counts[key] += 1;
}

export async function traverseRepository(
  repositoryPath: string,
  options: InventoryTraversalOptions = {},
): Promise<InventoryTraversalResult> {
  const limits: ResolvedLimits = { ...INVENTORY_LIMITS, ...options.limits };
  let root: string;

  try {
    root = await realpath(repositoryPath);
    const rootInfo = await lstat(root);
    if (!rootInfo.isDirectory()) {
      throw new InventoryTraversalError("Repository path must be a directory.");
    }
  } catch (error) {
    if (error instanceof InventoryTraversalError) throw error;
    throw new InventoryTraversalError(
      "Repository path does not exist or is inaccessible.",
    );
  }

  const result: InventoryTraversalResult = {
    directories: [],
    files: [],
    inventoryBytes: 0,
    excludedEntryCounts: createCounts(),
  };
  let includedBytes = 0n;
  let includedFileCount = 0;
  let includedDirectoryCount = 0;

  const walkDirectory = async (
    absoluteDirectory: string,
    relativeDirectory: string,
    directoryDepth: number,
  ): Promise<void> => {
    let directory;
    try {
      directory = await opendir(absoluteDirectory);
    } catch (error) {
      if (relativeDirectory !== "" && isRecoverableChildError(error)) {
        increment(result.excludedEntryCounts, "unreadable");
        return;
      }
      throw new InventoryTraversalError("Repository traversal failed.");
    }

    if (relativeDirectory !== "") {
      if (includedDirectoryCount + 1 > limits.maxDirectories) {
        try {
          await directory.close();
        } catch {
          // Preserve the limit error if closing the directory also fails.
        }
        throw new InventoryLimitError(
          "Repository exceeds the maximum included directory count.",
        );
      }
      includedDirectoryCount += 1;
      result.directories.push(relativeDirectory);
    }

    for await (const child of directory) {
      const childName = child.name;
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${childName}`
        : childName;
      const absolutePath = path.join(absoluteDirectory, childName);
      let entryInfo;

      try {
        entryInfo = await lstat(absolutePath, { bigint: true });
      } catch (error) {
        if (isRecoverableChildError(error)) {
          increment(result.excludedEntryCounts, "unreadable");
          continue;
        }
        throw new InventoryTraversalError("Repository traversal failed.");
      }

      if (entryInfo.isSymbolicLink()) {
        increment(result.excludedEntryCounts, "symlink");
        continue;
      }

      let canonicalEntryPath: string;
      try {
        canonicalEntryPath = await realpath(absolutePath);
      } catch (error) {
        if (isRecoverableChildError(error)) {
          increment(result.excludedEntryCounts, "unreadable");
          continue;
        }
        throw new InventoryTraversalError("Repository traversal failed.");
      }

      if (!isWithinRoot(root, canonicalEntryPath)) {
        throw new InventoryTraversalError(
          "Repository traversal escaped the selected root.",
        );
      }

      const kind: EntryKind | undefined = entryInfo.isDirectory()
        ? "directory"
        : entryInfo.isFile()
          ? "file"
          : undefined;

      if (kind === undefined) {
        increment(result.excludedEntryCounts, "unsupported");
        continue;
      }

      const exclusionCategory = options.classifyExclusion?.(relativePath, kind);
      if (exclusionCategory !== undefined) {
        increment(result.excludedEntryCounts, exclusionCategory);
        continue;
      }

      const depth = directoryDepth + 1;
      if (depth > limits.maxDepth) {
        increment(result.excludedEntryCounts, "tooDeep");
        continue;
      }

      if (kind === "directory") {
        await walkDirectory(canonicalEntryPath, relativePath, depth);
        continue;
      }

      if (entryInfo.size > BigInt(limits.maxFileBytes)) {
        increment(result.excludedEntryCounts, "oversized");
        continue;
      }

      if (includedFileCount + 1 > limits.maxFiles) {
        throw new InventoryLimitError(
          "Repository exceeds the maximum included file count.",
        );
      }

      const nextTotalBytes = includedBytes + entryInfo.size;
      if (nextTotalBytes > limits.maxTotalBytes) {
        throw new InventoryLimitError(
          "Repository exceeds the maximum included total size.",
        );
      }

      const sizeBytes = Number(entryInfo.size);
      result.files.push({ path: relativePath, sizeBytes });
      includedFileCount += 1;
      includedBytes = nextTotalBytes;
      result.inventoryBytes += sizeBytes;
    }
  };

  await walkDirectory(root, "", 0);
  result.directories.sort(compareCodePointOrder);
  result.files.sort((left, right) =>
    compareCodePointOrder(left.path, right.path),
  );
  return result;
}
