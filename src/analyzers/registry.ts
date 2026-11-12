import { createHash } from "node:crypto";
import path from "node:path";
import type {
  AnalysisStatus,
  AnalyzerBatchResult,
  AnalysisDiagnostic,
  AnalyzerInput,
  AnalyzerResult,
  CodeSymbol,
  ExportReference,
  ImportReference,
  LanguageAnalyzer,
  LanguageCoverage,
  RouteDeclaration,
  SourceRange,
  SupportedLanguage,
  SymbolReference,
} from "./types.js";

const REGISTRY_ID = "repomind.analyzer-registry";
const REGISTRY_VERSION = "1";
const SUPPORTED_LANGUAGES = new Set<SupportedLanguage>([
  "ruby",
  "javascript",
  "typescript",
  "python",
]);
const RESULT_ARRAYS = [
  "symbols",
  "imports",
  "exports",
  "routes",
  "references",
] as const;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export class AnalyzerRegistryConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalyzerRegistryConfigurationError";
  }
}

export class AnalyzerInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalyzerInputError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isKnownOptionalSymbolId(
  value: unknown,
  ids: ReadonlySet<string>,
): boolean {
  return value === undefined || (typeof value === "string" && ids.has(value));
}

function isSafeRepositoryPath(filePath: unknown): filePath is string {
  if (
    typeof filePath !== "string" ||
    filePath.length === 0 ||
    filePath.includes("\0") ||
    filePath.includes("\\") ||
    path.posix.isAbsolute(filePath) ||
    path.win32.isAbsolute(filePath) ||
    /^[A-Za-z]:/.test(filePath)
  ) {
    return false;
  }

  return filePath
    .split("/")
    .every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function validateInput(input: AnalyzerInput): void {
  if (!isRecord(input)) throw new AnalyzerInputError("Invalid analyzer input.");
  if (!isSafeRepositoryPath(input.filePath)) {
    throw new AnalyzerInputError(
      "Analyzer file path must be repository-relative.",
    );
  }
  if (
    !isNonEmptyString(input.language) ||
    input.language !== input.language.toLowerCase()
  ) {
    throw new AnalyzerInputError(
      "Analyzer language must be a canonical identifier.",
    );
  }
  if (!isNonEmptyString(input.snapshotId) || input.snapshotId.includes("\0")) {
    throw new AnalyzerInputError("Analyzer snapshot identity is invalid.");
  }
  if (typeof input.content !== "string") {
    throw new AnalyzerInputError("Analyzer content must be text.");
  }
  if (
    typeof input.contentHash !== "string" ||
    !SHA256_PATTERN.test(input.contentHash)
  ) {
    throw new AnalyzerInputError(
      "Analyzer content hash must be a lowercase SHA-256 digest.",
    );
  }

  const actualHash = createHash("sha256")
    .update(input.content, "utf8")
    .digest("hex");
  if (actualHash !== input.contentHash) {
    throw new AnalyzerInputError(
      "Analyzer content hash does not match supplied content.",
    );
  }
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareRange(left: SourceRange, right: SourceRange): number {
  return (
    left.startLine - right.startLine ||
    left.startColumn - right.startColumn ||
    left.endLine - right.endLine ||
    left.endColumn - right.endColumn
  );
}

function sourceLines(content: string): string[] {
  return content.split(/\r\n|\n|\r/);
}

function isValidRange(
  value: unknown,
  lines: readonly string[],
): value is SourceRange {
  if (!isRecord(value)) return false;
  const { startLine, startColumn, endLine, endColumn } = value;
  if (
    !Number.isInteger(startLine) ||
    !Number.isInteger(startColumn) ||
    !Number.isInteger(endLine) ||
    !Number.isInteger(endColumn) ||
    (startLine as number) < 1 ||
    (startColumn as number) < 1 ||
    (endLine as number) < 1 ||
    (endColumn as number) < 1 ||
    (startLine as number) > lines.length ||
    (endLine as number) > lines.length
  ) {
    return false;
  }

  const startText = lines[(startLine as number) - 1]!;
  const endText = lines[(endLine as number) - 1]!;
  if (
    (startColumn as number) > startText.length + 1 ||
    (endColumn as number) > endText.length + 1
  ) {
    return false;
  }

  return (
    (startLine as number) < (endLine as number) ||
    ((startLine as number) === (endLine as number) &&
      (startColumn as number) <= (endColumn as number))
  );
}

function isValidDiagnostic(
  value: unknown,
  lines: readonly string[],
  content: string,
): value is AnalysisDiagnostic {
  if (!isRecord(value)) return false;
  if (
    typeof value.code !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value.code) ||
    (value.severity !== "info" &&
      value.severity !== "warning" &&
      value.severity !== "error") ||
    !isNonEmptyString(value.message)
  ) {
    return false;
  }

  // A diagnostic must not echo the full source text supplied to an adapter.
  if (content.length >= 4 && value.message.includes(content)) {
    return false;
  }
  return value.range === undefined || isValidRange(value.range, lines);
}

function validateSymbols(
  value: unknown,
  lines: readonly string[],
): value is CodeSymbol[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  for (const symbol of value) {
    if (
      !isRecord(symbol) ||
      !isNonEmptyString(symbol.id) ||
      ids.has(symbol.id) ||
      !isNonEmptyString(symbol.kind) ||
      !isNonEmptyString(symbol.name) ||
      (symbol.qualifiedName !== undefined &&
        typeof symbol.qualifiedName !== "string") ||
      (symbol.exported !== undefined && typeof symbol.exported !== "boolean") ||
      !isValidRange(symbol.range, lines)
    ) {
      return false;
    }
    ids.add(symbol.id);
  }
  return true;
}

function validateImports(
  value: unknown,
  lines: readonly string[],
  ids: ReadonlySet<string>,
): value is ImportReference[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        isNonEmptyString(entry.specifier) &&
        Array.isArray(entry.bindings) &&
        entry.bindings.every((binding) => typeof binding === "string") &&
        isKnownOptionalSymbolId(entry.containingSymbolId, ids) &&
        isValidRange(entry.range, lines),
    )
  );
}

function validateExports(
  value: unknown,
  lines: readonly string[],
  ids: ReadonlySet<string>,
): value is ExportReference[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        isNonEmptyString(entry.name) &&
        isKnownOptionalSymbolId(entry.symbolId, ids) &&
        isValidRange(entry.range, lines),
    )
  );
}

function validateRoutes(
  value: unknown,
  lines: readonly string[],
  ids: ReadonlySet<string>,
): value is RouteDeclaration[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        (entry.path === undefined || typeof entry.path === "string") &&
        (entry.method === undefined || typeof entry.method === "string") &&
        isKnownOptionalSymbolId(entry.handlerSymbolId, ids) &&
        isValidRange(entry.range, lines),
    )
  );
}

function validateReferences(
  value: unknown,
  lines: readonly string[],
  ids: ReadonlySet<string>,
): value is SymbolReference[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        (entry.kind === "call" ||
          entry.kind === "inheritance" ||
          entry.kind === "implementation" ||
          entry.kind === "reference") &&
        isNonEmptyString(entry.targetName) &&
        isKnownOptionalSymbolId(entry.sourceSymbolId, ids) &&
        isValidRange(entry.range, lines),
    )
  );
}

function canonicalize(result: AnalyzerResult): AnalyzerResult {
  const compareOptionalText = (left?: string, right?: string) =>
    compareText(left ?? "", right ?? "");
  return {
    ...result,
    symbols: [...result.symbols].sort(
      (left, right) =>
        compareRange(left.range, right.range) ||
        compareText(left.kind, right.kind) ||
        compareText(left.name, right.name) ||
        compareText(left.id, right.id),
    ),
    imports: result.imports
      .map((item) => ({
        ...item,
        bindings: [...item.bindings].sort(compareText),
      }))
      .sort(
        (left, right) =>
          compareRange(left.range, right.range) ||
          compareText(left.specifier, right.specifier) ||
          compareText(left.bindings.join("\0"), right.bindings.join("\0")) ||
          compareOptionalText(
            left.containingSymbolId,
            right.containingSymbolId,
          ),
      ),
    exports: [...result.exports].sort(
      (left, right) =>
        compareRange(left.range, right.range) ||
        compareText(left.name, right.name) ||
        compareOptionalText(left.symbolId, right.symbolId),
    ),
    routes: [...result.routes].sort(
      (left, right) =>
        compareRange(left.range, right.range) ||
        compareOptionalText(left.path, right.path) ||
        compareOptionalText(left.method, right.method) ||
        compareOptionalText(left.handlerSymbolId, right.handlerSymbolId),
    ),
    references: [...result.references].sort(
      (left, right) =>
        compareRange(left.range, right.range) ||
        compareText(left.kind, right.kind) ||
        compareText(left.targetName, right.targetName) ||
        compareOptionalText(left.sourceSymbolId, right.sourceSymbolId),
    ),
    diagnostics: [...result.diagnostics].sort(
      (left, right) =>
        compareRange(left.range ?? ZERO_RANGE, right.range ?? ZERO_RANGE) ||
        compareText(left.code, right.code) ||
        compareText(left.message, right.message),
    ),
  };
}

const ZERO_RANGE: SourceRange = {
  startLine: 0,
  startColumn: 0,
  endLine: 0,
  endColumn: 0,
};

function emptyCollections(result: AnalyzerResult): boolean {
  return RESULT_ARRAYS.every((key) => result[key].length === 0);
}

function makeResult(
  input: AnalyzerInput,
  status: AnalyzerResult["status"],
  analyzerId: string,
  analyzerVersion: string,
  diagnostic: AnalysisDiagnostic,
): AnalyzerResult {
  return {
    schemaVersion: 1,
    analyzerId,
    analyzerVersion,
    language: input.language,
    filePath: input.filePath,
    snapshotId: input.snapshotId,
    contentHash: input.contentHash,
    status,
    symbols: [],
    imports: [],
    exports: [],
    routes: [],
    references: [],
    diagnostics: [diagnostic],
  };
}

function resultIsValid(
  value: unknown,
  input: AnalyzerInput,
  analyzer: LanguageAnalyzer,
): value is AnalyzerResult {
  if (!isRecord(value)) return false;
  const result = value as unknown as AnalyzerResult;
  if (
    result.schemaVersion !== 1 ||
    result.analyzerId !== analyzer.id ||
    result.analyzerVersion !== analyzer.version ||
    result.language !== input.language ||
    result.filePath !== input.filePath ||
    result.snapshotId !== input.snapshotId ||
    result.contentHash !== input.contentHash ||
    (result.status !== "complete" &&
      result.status !== "partial" &&
      result.status !== "unsupported" &&
      result.status !== "failed") ||
    !Array.isArray(result.symbols) ||
    !Array.isArray(result.imports) ||
    !Array.isArray(result.exports) ||
    !Array.isArray(result.routes) ||
    !Array.isArray(result.references) ||
    !Array.isArray(result.diagnostics)
  ) {
    return false;
  }

  const lines = sourceLines(input.content);
  if (!validateSymbols(result.symbols, lines)) return false;
  const symbolIds = new Set(result.symbols.map((symbol) => symbol.id));
  if (
    !validateImports(result.imports, lines, symbolIds) ||
    !validateExports(result.exports, lines, symbolIds) ||
    !validateRoutes(result.routes, lines, symbolIds) ||
    !validateReferences(result.references, lines, symbolIds) ||
    !result.diagnostics.every((diagnostic) =>
      isValidDiagnostic(diagnostic, lines, input.content),
    )
  ) {
    return false;
  }

  if (
    (result.status === "unsupported" || result.status === "failed") &&
    (!emptyCollections(result) || result.diagnostics.length === 0)
  ) {
    return false;
  }
  return true;
}

function validateAnalyzer(analyzer: LanguageAnalyzer): string[] {
  if (
    !isRecord(analyzer) ||
    !isNonEmptyString(analyzer.id) ||
    !isNonEmptyString(analyzer.version) ||
    !SUPPORTED_LANGUAGES.has(analyzer.language) ||
    typeof analyzer.analyze !== "function" ||
    !Array.isArray(analyzer.supportedExtensions) ||
    analyzer.supportedExtensions.length === 0
  ) {
    throw new AnalyzerRegistryConfigurationError(
      "Analyzer registration is invalid.",
    );
  }

  const extensions = analyzer.supportedExtensions.map((extension) => {
    if (typeof extension !== "string" || !/^\.[a-z0-9]+$/i.test(extension)) {
      throw new AnalyzerRegistryConfigurationError(
        "Analyzer extensions must be simple dot-prefixed suffixes.",
      );
    }
    return extension.toLowerCase();
  });

  if (new Set(extensions).size !== extensions.length) {
    throw new AnalyzerRegistryConfigurationError(
      "An analyzer cannot register the same extension more than once.",
    );
  }
  return extensions;
}

export class AnalyzerRegistry {
  private readonly adapters = new Map<string, LanguageAnalyzer>();

  constructor(analyzers: readonly LanguageAnalyzer[]) {
    const ids = new Set<string>();
    for (const analyzer of analyzers) {
      const extensions = validateAnalyzer(analyzer);
      if (ids.has(analyzer.id)) {
        throw new AnalyzerRegistryConfigurationError(
          "Analyzer IDs must be unique.",
        );
      }
      ids.add(analyzer.id);

      for (const extension of extensions) {
        const key = this.adapterKey(analyzer.language, extension);
        if (this.adapters.has(key)) {
          throw new AnalyzerRegistryConfigurationError(
            "Multiple analyzers claim the same language and extension.",
          );
        }
        this.adapters.set(key, analyzer);
      }
    }
  }

  async analyzeFile(input: AnalyzerInput): Promise<AnalyzerResult> {
    validateInput(input);
    const extension = path.posix.extname(input.filePath).toLowerCase();
    const analyzer = this.adapters.get(
      this.adapterKey(input.language, extension),
    );

    if (analyzer === undefined) {
      return makeResult(input, "unsupported", REGISTRY_ID, REGISTRY_VERSION, {
        code: "analyzer-unavailable",
        severity: "warning",
        message:
          "No registered analyzer supports this language and file extension.",
      });
    }

    try {
      const candidate: unknown = await analyzer.analyze(input);
      if (!resultIsValid(candidate, input, analyzer)) {
        return makeResult(input, "failed", analyzer.id, analyzer.version, {
          code: "analyzer-invalid-result",
          severity: "error",
          message:
            "The analyzer returned a result that failed contract validation.",
        });
      }
      return canonicalize(candidate);
    } catch {
      return makeResult(input, "failed", analyzer.id, analyzer.version, {
        code: "analyzer-failed",
        severity: "error",
        message: "The analyzer failed; no structural claims were recorded.",
      });
    }
  }

  async analyzeFiles(
    inputs: readonly AnalyzerInput[],
  ): Promise<AnalyzerBatchResult> {
    const ordered = [...inputs].sort((left, right) =>
      compareText(left.filePath, right.filePath),
    );
    const results: AnalyzerResult[] = [];
    for (const input of ordered) {
      results.push(await this.analyzeFile(input));
    }
    const coverageByLanguage = new Map<
      string,
      Record<AnalysisStatus, number>
    >();
    for (const result of results) {
      let counts = coverageByLanguage.get(result.language);
      if (counts === undefined) {
        counts = { complete: 0, partial: 0, unsupported: 0, failed: 0 };
        coverageByLanguage.set(result.language, counts);
      }
      counts[result.status] += 1;
    }

    const coverage: LanguageCoverage[] = [...coverageByLanguage.entries()]
      .sort(([left], [right]) => compareText(left, right))
      .map(([language, counts]) => ({
        language,
        totalFiles: Object.values(counts).reduce(
          (total, count) => total + count,
          0,
        ),
        counts,
      }));

    return { results, coverage };
  }

  private adapterKey(language: string, extension: string): string {
    return `${language}\0${extension}`;
  }
}
