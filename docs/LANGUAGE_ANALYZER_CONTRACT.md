# Language Analyzer Contract

**Version:** 1.0
**Status:** Normative design contract for Milestone 3

## 1. Purpose and boundaries

Language analyzers extract structural facts from an already selected, bounded source file. They are replaceable adapters behind a language-neutral registry. They do not own repository traversal, file selection, technology detection, project-wide resolution, persistence, or review policy.

The initial analyzer targets are Ruby, JavaScript, TypeScript, and Python. A detected language does not imply that an analyzer supports every file or syntax version in that language. Unsupported and partially parsed files remain visible in analysis coverage.

## 2. Host responsibilities

The indexing host, not an analyzer, must:

- Select files from the safe repository inventory and enforce path, file-size, aggregate-size, and concurrency limits.
- Reject excluded, binary, secret, symlinked, or out-of-root inputs before reading content.
- Read a file only from the immutable repository snapshot being analyzed.
- Supply repository-relative normalized paths and a snapshot identity.
- Compute and supply a SHA-256 content digest for the exact UTF-8 text passed to the adapter.
- Persist results and resolve cross-file references after per-file analysis.
- Keep source text out of logs and avoid returning it in analyzer results.

Analyzers must not access the filesystem, spawn processes, install packages, execute repository code, make network calls, read environment variables, or send content to an AI provider.

## 3. Adapter interface

The following TypeScript shape is normative at the conceptual level; implementation types may refine it without changing the contract semantics.

```ts
export type SupportedLanguage = "ruby" | "javascript" | "typescript" | "python";
export type AnalysisStatus = "complete" | "partial" | "unsupported" | "failed";

export interface LanguageAnalyzer {
  readonly id: string;
  readonly version: string;
  readonly language: SupportedLanguage;
  readonly supportedExtensions: readonly string[];

  analyze(input: AnalyzerInput): Promise<AnalyzerResult>;
}

export interface AnalyzerInput {
  readonly language: string;       // canonical detected language ID
  readonly filePath: string;       // normalized, repository-relative POSIX path
  readonly snapshotId: string;     // immutable identity of the full analyzed snapshot
  readonly contentHash: string;    // SHA-256 of the exact UTF-8 content supplied
  readonly content: string;        // already bounded source text; never returned in results
}

export interface AnalyzerResult {
  readonly schemaVersion: 1;
  readonly analyzerId: string;
  readonly analyzerVersion: string;
  readonly language: string; // canonical detected language ID, including unsupported languages
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
```

The registry selects an adapter deterministically from the detected language and supported extension. It must not choose between conflicting adapters based on filesystem order. If no adapter claims a file, the host emits an `unsupported` result with empty structural collections and a diagnostic; this is a normal coverage outcome, not an indexing failure.

## 4. Structural result records

Every extracted item belongs to exactly the input `filePath`, `snapshotId`, and `contentHash`.

```ts
export interface SourceRange {
  readonly startLine: number;   // one-based, inclusive
  readonly startColumn: number; // one-based UTF-16 code-unit column, inclusive
  readonly endLine: number;     // one-based
  readonly endColumn: number;   // UTF-16 code-unit column, exclusive
}

export interface CodeSymbol {
  readonly id: string;          // deterministic and unique within this file result
  readonly kind: string;        // e.g. class, module, function, method, type, constant
  readonly name: string;
  readonly qualifiedName?: string;
  readonly range: SourceRange;
  readonly exported?: boolean;
}

export interface ImportReference {
  readonly specifier: string;    // literal module/path text as written in source
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
  readonly message: string; // concise and safe; must not contain source excerpts
  readonly range?: SourceRange;
}
```

All collections must be deterministically ordered by source range, then by stable name/kind tie-breakers. IDs are stable only within one result for one file snapshot; they are not finding IDs and are not promised to survive edits. Cross-file target resolution is performed later by the indexer and must preserve unresolved references rather than inventing links.

Ranges use one-based lines and columns; start positions are inclusive and end positions are exclusive. Columns count UTF-16 code units. Adapters using parsers with different offset conventions must normalize positions before returning results. A location must refer to the exact input text and must not exceed its line/column bounds.

## 5. Status and error behavior

- `complete`: parsing succeeded and the adapter emitted all supported structural categories it recognizes for this file. This does not claim semantic completeness.
- `partial`: parsing recovered some structure, but syntax errors or unsupported constructs may have omitted data; include diagnostics.
- `unsupported`: the adapter cannot analyze this file type or language version; structural collections are empty and a diagnostic explains the coverage gap.
- `failed`: an unexpected adapter failure prevented reliable extraction. Return no structural claims and include a safe diagnostic; the registry continues with other files.

Malformed source must not crash repository indexing. Parser exceptions are contained at the adapter boundary and must not expose raw source in error messages. Missing or inaccessible files are handled by the host before invoking an analyzer. A `failed` result must never be interpreted as “no symbols exist.”

The shared registry validates request paths and content digests, result provenance, collection shapes, symbol references, and source ranges against the supplied text. It replaces thrown exceptions or invalid results with a safe `failed` result and continues analyzing other valid files. `unsupported` and `failed` results require at least one diagnostic and no structural claims.

## 6. Determinism and provenance

For identical analyzer version, input language, file path, snapshot ID, content hash, and configuration, results must be byte-for-byte stable after canonical serialization. Results must identify the analyzer and schema version. Do not include absolute paths, timestamps, source excerpts, credentials, or environment values.

The host must reject a result whose `filePath`, `snapshotId`, or `contentHash` differs from the request. Persisted symbols and relationships must be scoped to the repository snapshot. When a file changes, its prior result is superseded for the new snapshot; historical snapshot records remain attributable to their original content.

## 7. Initial extraction expectations and limits

The initial cross-language result model supports symbols, imports, exports, routes, source ranges, and direct syntactic references. Each adapter documents which kinds it actually extracts. Dynamic dispatch, reflection, generated code, runtime behavior, and complete call graphs are not implied. Route declarations are emitted only when a supported syntax pattern gives a direct, file-backed declaration.

The registry must report per-file status and aggregate coverage by language and outcome. Batch results and coverage entries are ordered deterministically by repository-relative path and language, respectively. Files without analyzer support remain inventoried and do not prevent analysis of supported files.

### Ruby adapter coverage (Prism)

The Ruby adapter uses the official `@ruby/prism` parser and analyzes only the UTF-8 source string supplied by the host. It does not load Ruby, gems, project configuration, or repository files. Parser byte locations are normalized to the contract's one-based UTF-16 source ranges.

The initial extraction set is:

- Class and module declarations, including nested qualified names; instance and singleton method declarations; and constant assignments.
- File-defined class/module declarations and constants as export-like declarations. Ruby has no general file-level export syntax, so this is structural metadata and does not assert public visibility or runtime loading.
- Literal `require` and `require_relative` string arguments as imports. Dynamic arguments are omitted. Import bindings are empty because Ruby's require mechanism does not name imported bindings.
- Direct call names and class superclass expressions as syntactic references. These are unresolved names, not proof of runtime dispatch or target identity.
- Literal string route paths for receiver-less, one-argument Rails-style `get`, `post`, `put`, `patch`, and `delete` calls, and receiver-less `root` as `GET /`. A literal receiver-less `match` path is emitted without a method because its `via` options are not interpreted. Calls with options that may change the method, resources, dynamic paths, receiver calls, and other DSL constructs are omitted; the adapter does not infer route expansion or associate handlers.

Prism parse errors produce `partial` results with generic, source-safe diagnostics; recovered nodes may still be reported. Parser warnings produce informational diagnostics. The parser's raw messages are not copied into results. The adapter does not implement Ruby semantic analysis, metaprogramming, runtime route evaluation, dynamic require/load tracing, arbitrary call resolution, or complete syntax coverage across Ruby versions. A file without parse errors may have `complete` status while still being subject to these documented extraction limits.

## 8. Milestone 3 implementation sequence

The contract is implemented incrementally through the M3 tickets in [`MILESTONE_TICKETS.md`](MILESTONE_TICKETS.md). Parser selection and dependencies are decided in the language-specific analyzer tickets; adding a parser must not change the shared result semantics above.
