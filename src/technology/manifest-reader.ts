import { constants } from "node:fs";
import { lstat, open, realpath, stat } from "node:fs/promises";
import path from "node:path";

export const MANIFEST_READ_LIMITS = {
  maxFileBytes: 1_048_576,
  maxManifests: 100,
  maxTotalBytes: 10n * 1024n * 1024n,
} as const;

export type ManifestWarningCode =
  | "manifest-malformed"
  | "manifest-unreadable"
  | "manifest-oversized"
  | "manifest-count-limit"
  | "manifest-total-size-limit";

export interface ManifestWarning {
  code: ManifestWarningCode;
  path?: string;
}

export interface InventoryFileInput {
  path: string;
  sizeBytes: number;
}

export interface PackageJsonManifest {
  kind: "package-json";
  path: string;
  packageManager?: string;
  dependencies: string[];
  devDependencies: string[];
  optionalDependencies: string[];
  peerDependencies: string[];
}

export interface GemfileManifest {
  kind: "gemfile";
  path: string;
  gemDeclarations: string[];
}

export type TechnologyManifest = PackageJsonManifest | GemfileManifest;

export interface ManifestReaderOptions {
  limits?: Partial<{
    maxFileBytes: number;
    maxManifests: number;
    maxTotalBytes: bigint;
  }>;
}

export interface ManifestReaderResult {
  manifests: TechnologyManifest[];
  warnings: ManifestWarning[];
}

export class ManifestReaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestReaderError";
  }
}

interface Candidate {
  path: string;
  kind: "package-json" | "gemfile";
  inventorySizeBytes: number;
}

interface Limits {
  maxFileBytes: number;
  maxManifests: number;
  maxTotalBytes: bigint;
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

function isSafeRelativePath(relativePath: string): boolean {
  if (
    relativePath === "" ||
    relativePath.includes("\\") ||
    path.isAbsolute(relativePath) ||
    path.posix.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath) ||
    /^[A-Za-z]:/.test(relativePath)
  ) {
    return false;
  }
  const segments = relativePath.split("/");
  return segments.every(
    (segment) => segment !== "" && segment !== "." && segment !== "..",
  );
}

function collectCandidates(
  files: readonly InventoryFileInput[],
  warnings: Map<string, ManifestWarning>,
): Candidate[] {
  const candidates = new Map<string, Candidate>();

  for (const file of files) {
    const basename = file.path.slice(file.path.lastIndexOf("/") + 1);
    const kind =
      basename === "package.json"
        ? "package-json"
        : basename === "Gemfile"
          ? "gemfile"
          : undefined;
    if (kind === undefined) continue;
    if (!isSafeRelativePath(file.path)) {
      addWarning(warnings, { code: "manifest-unreadable" });
      continue;
    }
    if (!Number.isSafeInteger(file.sizeBytes) || file.sizeBytes < 0) {
      addWarning(warnings, {
        code: "manifest-unreadable",
        path: file.path,
      });
      continue;
    }

    candidates.set(file.path, {
      path: file.path,
      kind,
      inventorySizeBytes: file.sizeBytes,
    });
  }

  return [...candidates.values()].sort((left, right) =>
    compareCodePointOrder(left.path, right.path),
  );
}

function addWarning(
  warnings: Map<string, ManifestWarning>,
  warning: ManifestWarning,
): void {
  const key = `${warning.code}\0${warning.path ?? ""}`;
  warnings.set(key, warning);
}

function sortedWarnings(
  warnings: Map<string, ManifestWarning>,
): ManifestWarning[] {
  return [...warnings.values()].sort((left, right) => {
    const pathOrder = compareCodePointOrder(left.path ?? "", right.path ?? "");
    return pathOrder || compareCodePointOrder(left.code, right.code);
  });
}

function readPackageNames(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([name]) => name)
    .sort(compareCodePointOrder);
}

function parsePackageJson(pathname: string, text: string): PackageJsonManifest {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new SyntaxError("Malformed manifest.");
  }

  const data = parsed as Record<string, unknown>;
  const packageManager =
    typeof data.packageManager === "string" ? data.packageManager : undefined;
  const result: PackageJsonManifest = {
    kind: "package-json",
    path: pathname,
    dependencies: readPackageNames(data.dependencies),
    devDependencies: readPackageNames(data.devDependencies),
    optionalDependencies: readPackageNames(data.optionalDependencies),
    peerDependencies: readPackageNames(data.peerDependencies),
  };

  if (packageManager !== undefined) result.packageManager = packageManager;
  return result;
}

const LITERAL_GEM_DECLARATION =
  /^\s*gem\s*(?:\(\s*)?(['"])([A-Za-z0-9][A-Za-z0-9_.-]*)\1(?=\s*(?:,|\)|#|$))/;

function parseGemfile(pathname: string, text: string): GemfileManifest {
  const gemDeclarations = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const match = LITERAL_GEM_DECLARATION.exec(line);
    if (match?.[2] !== undefined) gemDeclarations.add(match[2]);
  }

  return {
    kind: "gemfile",
    path: pathname,
    gemDeclarations: [...gemDeclarations].sort(compareCodePointOrder),
  };
}

async function assertSafeFile(
  root: string,
  absolutePath: string,
  relativePath: string,
): Promise<{ device: bigint; inode: bigint; size: bigint }> {
  let currentPath = root;
  const segments = relativePath.split("/");
  for (let index = 0; index < segments.length; index += 1) {
    currentPath = path.join(currentPath, segments[index]!);
    const info = await lstat(currentPath, { bigint: true });
    if (info.isSymbolicLink()) throw new Error("Unsafe manifest path.");
    if (index < segments.length - 1 && !info.isDirectory()) {
      throw new Error("Unsafe manifest path.");
    }
    if (index === segments.length - 1 && !info.isFile()) {
      throw new Error("Unsupported manifest entry.");
    }
  }

  const canonicalPath = await realpath(absolutePath);
  if (!isWithinRoot(root, canonicalPath)) throw new Error("Path escaped root.");
  const info = await lstat(absolutePath, { bigint: true });
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new Error("Unsupported manifest entry.");
  }

  return { device: info.dev, inode: info.ino, size: info.size };
}

async function readManifestBytes(
  root: string,
  candidate: Candidate,
  maxFileBytes: number,
  remainingBytes: bigint,
): Promise<
  | { kind: "read"; bytes: Buffer }
  | { kind: "oversized" }
  | { kind: "total-limit" }
> {
  const absolutePath = path.join(root, ...candidate.path.split("/"));
  const initial = await assertSafeFile(root, absolutePath, candidate.path);
  if (initial.size !== BigInt(candidate.inventorySizeBytes)) {
    throw new Error("Manifest changed after inventory.");
  }
  if (initial.size > BigInt(maxFileBytes)) return { kind: "oversized" };
  if (initial.size > remainingBytes) return { kind: "total-limit" };

  const handle = await open(
    absolutePath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const openedInfo = await handle.stat({ bigint: true });
    const openedPath = await realpath(absolutePath);
    if (
      !isWithinRoot(root, openedPath) ||
      openedInfo.dev !== initial.device ||
      openedInfo.ino !== initial.inode ||
      openedInfo.size !== initial.size
    ) {
      throw new Error("Manifest changed during read.");
    }
    if (openedInfo.size > BigInt(maxFileBytes)) return { kind: "oversized" };
    if (openedInfo.size > remainingBytes) return { kind: "total-limit" };

    const bytes = Buffer.alloc(Number(openedInfo.size));
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (bytesRead === 0) break;
      offset += bytesRead;
    }

    const finalInfo = await handle.stat({ bigint: true });
    if (
      offset !== bytes.length ||
      finalInfo.size !== openedInfo.size ||
      finalInfo.mtimeNs !== openedInfo.mtimeNs ||
      finalInfo.ctimeNs !== openedInfo.ctimeNs
    ) {
      throw new Error("Manifest changed during read.");
    }

    return { kind: "read", bytes };
  } finally {
    await handle.close();
  }
}

function decodeUtf8(bytes: Buffer): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function readTechnologyManifests(
  repositoryRoot: string,
  inventoryFiles: readonly InventoryFileInput[],
  options: ManifestReaderOptions = {},
): Promise<ManifestReaderResult> {
  const limits: Limits = { ...MANIFEST_READ_LIMITS, ...options.limits };
  let root: string;
  try {
    root = await realpath(repositoryRoot);
    const rootInfo = await stat(root);
    if (!rootInfo.isDirectory()) throw new Error("Root is not a directory.");
  } catch {
    throw new ManifestReaderError(
      "Repository path is invalid or inaccessible.",
    );
  }

  const warnings = new Map<string, ManifestWarning>();
  const manifests: TechnologyManifest[] = [];
  const candidates = collectCandidates(inventoryFiles, warnings);
  const selectedCandidates = candidates.slice(0, limits.maxManifests);
  if (candidates.length > limits.maxManifests) {
    addWarning(warnings, { code: "manifest-count-limit" });
  }

  let totalBytesRead = 0n;
  for (const candidate of selectedCandidates) {
    if (candidate.inventorySizeBytes > limits.maxFileBytes) {
      addWarning(warnings, {
        code: "manifest-oversized",
        path: candidate.path,
      });
      continue;
    }

    const remainingBytes = limits.maxTotalBytes - totalBytesRead;
    if (
      remainingBytes < 0n ||
      (remainingBytes === 0n && candidate.inventorySizeBytes > 0)
    ) {
      addWarning(warnings, { code: "manifest-total-size-limit" });
      break;
    }

    try {
      const readResult = await readManifestBytes(
        root,
        candidate,
        limits.maxFileBytes,
        remainingBytes,
      );
      if (readResult.kind === "oversized") {
        addWarning(warnings, {
          code: "manifest-oversized",
          path: candidate.path,
        });
        continue;
      }
      if (readResult.kind === "total-limit") {
        addWarning(warnings, { code: "manifest-total-size-limit" });
        break;
      }

      totalBytesRead += BigInt(readResult.bytes.length);
      const text = decodeUtf8(readResult.bytes);
      manifests.push(
        candidate.kind === "package-json"
          ? parsePackageJson(candidate.path, text)
          : parseGemfile(candidate.path, text),
      );
    } catch (error) {
      addWarning(warnings, {
        code:
          error instanceof SyntaxError || error instanceof TypeError
            ? "manifest-malformed"
            : "manifest-unreadable",
        path: candidate.path,
      });
    }
  }

  return { manifests, warnings: sortedWarnings(warnings) };
}
