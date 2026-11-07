import type { EntryKind, ExclusionCategory } from "./traversal.js";

const GENERATED_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  "coverage",
  "dist",
  "build",
  "out",
  "target",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".parcel-cache",
  ".vite",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  "pods",
  "deriveddata",
  "tmp",
  "log",
]);

const DEPENDENCY_DIRECTORIES = new Set([
  "node_modules",
  "bower_components",
  "vendor",
]);

const SECRET_DIRECTORIES = new Set([".ssh", ".aws", "credentials", "secrets"]);

const SECRET_FILE_NAMES = new Set([
  ".npmrc",
  ".pypirc",
  ".netrc",
  "id_rsa",
  "id_ed25519",
]);

const SECRET_FILE_EXTENSIONS = [".pem", ".key", ".p12", ".pfx", ".jks"];

const BINARY_FILE_EXTENSIONS = [
  ".7z",
  ".a",
  ".apk",
  ".avi",
  ".bin",
  ".bmp",
  ".class",
  ".dll",
  ".dmg",
  ".doc",
  ".docx",
  ".eot",
  ".exe",
  ".gif",
  ".gz",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".mp3",
  ".mp4",
  ".o",
  ".otf",
  ".pdf",
  ".png",
  ".ppt",
  ".pptx",
  ".psd",
  ".pyc",
  ".so",
  ".tar",
  ".tif",
  ".tiff",
  ".ttf",
  ".wasm",
  ".wav",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
  ".xls",
  ".xlsx",
  ".zip",
];

function asciiLower(value: string): string {
  return value.replace(/[A-Z]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) + 32),
  );
}

function hasAnySuffix(value: string, suffixes: readonly string[]): boolean {
  return suffixes.some((suffix) => value.endsWith(suffix));
}

function isSecretEnvironmentFile(fileName: string): boolean {
  if (fileName !== ".env" && !fileName.startsWith(".env.")) return false;

  return ![".example", ".sample", ".template"].some((suffix) =>
    fileName.endsWith(suffix),
  );
}

export function classifyInventoryExclusion(
  relativePath: string,
  kind: EntryKind,
): ExclusionCategory | undefined {
  const segments = relativePath.split("/");
  const baseName = asciiLower(segments.at(-1) ?? "");

  if (kind === "directory") {
    if (GENERATED_DIRECTORIES.has(baseName)) return "generated";
    if (DEPENDENCY_DIRECTORIES.has(baseName)) return "dependency";
    if (SECRET_DIRECTORIES.has(baseName)) return "secretOrLocalConfig";
    return undefined;
  }

  if (
    isSecretEnvironmentFile(baseName) ||
    SECRET_FILE_NAMES.has(baseName) ||
    hasAnySuffix(baseName, SECRET_FILE_EXTENSIONS)
  ) {
    return "secretOrLocalConfig";
  }

  if (
    baseName.endsWith(".min.js") ||
    baseName.endsWith(".min.css") ||
    baseName.endsWith(".map")
  ) {
    return "generated";
  }

  if (hasAnySuffix(baseName, BINARY_FILE_EXTENSIONS)) return "binary";
  return undefined;
}
