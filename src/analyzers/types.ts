export type SupportedLanguage = "ruby" | "javascript" | "typescript" | "python";

export interface AnalyzerInput {
  readonly language: string;
  readonly filePath: string;
  readonly snapshotId: string;
  readonly contentHash: string;
  readonly content: string;
}

export interface SourceRange {
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
}

export interface CodeSymbol {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly qualifiedName?: string;
  readonly range: SourceRange;
  readonly exported?: boolean;
}

export interface ImportReference {
  readonly specifier: string;
  readonly bindings: readonly string[];
  readonly range: SourceRange;
  readonly containingSymbolId?: string;
}

export interface ExportReference {
  readonly name: string;
  readonly range: SourceRange;
  readonly symbolId?: string;
}

export interface RouteDeclaration {
  readonly path?: string;
  readonly method?: string;
  readonly handlerSymbolId?: string;
  readonly range: SourceRange;
}

export interface SymbolReference {
  readonly kind: "call" | "inheritance" | "implementation" | "reference";
  readonly targetName: string;
  readonly sourceSymbolId?: string;
  readonly range: SourceRange;
}

export interface AnalysisDiagnostic {
  readonly code: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  readonly range?: SourceRange;
}

export type AnalysisStatus = "complete" | "partial" | "unsupported" | "failed";

export interface AnalyzerResult {
  readonly schemaVersion: 1;
  readonly analyzerId: string;
  readonly analyzerVersion: string;
  readonly language: string;
  readonly filePath: string;
  readonly snapshotId: string;
  readonly contentHash: string;
  readonly status: AnalysisStatus;
  readonly symbols: readonly CodeSymbol[];
  readonly imports: readonly ImportReference[];
  readonly exports: readonly ExportReference[];
  readonly routes: readonly RouteDeclaration[];
  readonly references: readonly SymbolReference[];
  readonly diagnostics: readonly AnalysisDiagnostic[];
}

export interface LanguageCoverage {
  readonly language: string;
  readonly totalFiles: number;
  readonly counts: Readonly<Record<AnalysisStatus, number>>;
}

export interface AnalyzerBatchResult {
  readonly results: readonly AnalyzerResult[];
  readonly coverage: readonly LanguageCoverage[];
}

export interface LanguageAnalyzer {
  readonly id: string;
  readonly version: string;
  readonly language: SupportedLanguage;
  readonly supportedExtensions: readonly string[];
  analyze(input: AnalyzerInput): Promise<AnalyzerResult>;
}
