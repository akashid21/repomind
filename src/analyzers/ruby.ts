import {
  CallNode,
  ClassNode,
  ConstantPathNode,
  ConstantReadNode,
  ConstantWriteNode,
  DefNode,
  loadPrism,
  ModuleNode,
  type Node,
  StringNode,
} from "@ruby/prism";
import type {
  AnalysisDiagnostic,
  AnalyzerInput,
  AnalyzerResult,
  CodeSymbol,
  ExportReference,
  ImportReference,
  LanguageAnalyzer,
  RouteDeclaration,
  SourceRange,
  SymbolReference,
} from "./types.js";

export const RUBY_ANALYZER_ID = "repomind.ruby-prism";
export const RUBY_ANALYZER_VERSION = "1.0.0";

const parse = loadPrism();
const ROUTE_METHODS: Readonly<Record<string, string>> = {
  get: "GET",
  post: "POST",
  put: "PUT",
  patch: "PATCH",
  delete: "DELETE",
};

function rangeOf(location: {
  startLine(): number;
  endLine(): number;
  startCodeUnitsColumn(encoding?: "utf-8" | "utf-16" | "utf-32"): number;
  endCodeUnitsColumn(encoding?: "utf-8" | "utf-16" | "utf-32"): number;
}): SourceRange {
  return {
    startLine: location.startLine(),
    startColumn: location.startCodeUnitsColumn("utf-16") + 1,
    endLine: location.endLine(),
    endColumn: location.endCodeUnitsColumn("utf-16") + 1,
  };
}

function symbolId(kind: string, startOffset: number, name: string): string {
  return `ruby:${kind}:${startOffset}:${name}`;
}

function stringArgument(node: Node | undefined): string | undefined {
  if (!(node instanceof StringNode)) return undefined;
  // Keep the literal text as written. Decoding escapes would imply runtime semantics.
  return node.contentLoc.slice();
}

function argumentsOf(node: CallNode): Node[] {
  return node.arguments_?.arguments_ ?? [];
}

function isConstantPath(
  node: Node,
): node is ConstantReadNode | ConstantPathNode {
  return node instanceof ConstantReadNode || node instanceof ConstantPathNode;
}

function declarationName(
  name: string,
  constantPath: Node,
  scopes: readonly string[],
): string {
  const explicitPath = constantPath.location.slice();
  if (explicitPath.includes("::")) return explicitPath.replace(/^::/, "");
  return [...scopes, name].join("::");
}

function makeDiagnostic(
  code: string,
  severity: AnalysisDiagnostic["severity"],
  message: string,
  range?: SourceRange,
): AnalysisDiagnostic {
  return range === undefined
    ? { code, severity, message }
    : { code, severity, message, range };
}

export const rubyAnalyzer: LanguageAnalyzer = {
  id: RUBY_ANALYZER_ID,
  version: RUBY_ANALYZER_VERSION,
  language: "ruby",
  supportedExtensions: [".rb", ".rake", ".gemspec"],

  async analyze(input: AnalyzerInput): Promise<AnalyzerResult> {
    const parseRuby = await parse;
    const parsed = parseRuby(new TextEncoder().encode(input.content));
    const symbols: CodeSymbol[] = [];
    const imports: ImportReference[] = [];
    const exports: ExportReference[] = [];
    const routes: RouteDeclaration[] = [];
    const references: SymbolReference[] = [];
    const diagnostics: AnalysisDiagnostic[] = [];

    const visit = (
      node: Node,
      scopes: readonly string[] = [],
      containingSymbolId?: string,
    ): void => {
      let childScopes = scopes;
      let childSymbolId = containingSymbolId;

      if (node instanceof ModuleNode || node instanceof ClassNode) {
        const kind = node instanceof ModuleNode ? "module" : "class";
        const constantPath = node.constantPath;
        const qualifiedName = declarationName(node.name, constantPath, scopes);
        const id = symbolId(kind, node.location.startOffset, qualifiedName);
        symbols.push({
          id,
          kind,
          name: node.name,
          qualifiedName,
          range: rangeOf(node.constantPath.location),
        });
        // Ruby has no file-level export declaration; this marks a top-level definition only.
        if (scopes.length === 0) {
          exports.push({
            name: qualifiedName,
            symbolId: id,
            range: rangeOf(node.constantPath.location),
          });
        }
        if (
          node instanceof ClassNode &&
          node.superclass !== null &&
          isConstantPath(node.superclass)
        ) {
          references.push({
            kind: "inheritance",
            targetName: node.superclass.location.slice(),
            sourceSymbolId: id,
            range: rangeOf(node.superclass.location),
          });
        }
        childScopes = qualifiedName.split("::");
        childSymbolId = id;
      } else if (node instanceof DefNode) {
        const kind = node.receiver === null ? "method" : "singleton_method";
        const qualifiedName = [...scopes, node.name].join("::");
        const id = symbolId(kind, node.location.startOffset, qualifiedName);
        symbols.push({
          id,
          kind,
          name: node.name,
          qualifiedName,
          range: rangeOf(node.nameLoc),
        });
        childSymbolId = id;
      } else if (node instanceof ConstantWriteNode) {
        const qualifiedName = [...scopes, node.name].join("::");
        const id = symbolId(
          "constant",
          node.location.startOffset,
          qualifiedName,
        );
        symbols.push({
          id,
          kind: "constant",
          name: node.name,
          qualifiedName,
          range: rangeOf(node.nameLoc),
        });
        exports.push({
          name: qualifiedName,
          symbolId: id,
          range: rangeOf(node.nameLoc),
        });
      } else if (node instanceof CallNode) {
        const args = argumentsOf(node);
        const firstString = stringArgument(args[0]);
        const callRange = rangeOf(node.location);

        if (
          node.receiver === null &&
          (node.name === "require" || node.name === "require_relative") &&
          firstString !== undefined
        ) {
          const item: ImportReference = {
            specifier: firstString,
            bindings: [],
            range: callRange,
          };
          imports.push(
            containingSymbolId === undefined
              ? item
              : { ...item, containingSymbolId },
          );
        }

        const routeMethod = ROUTE_METHODS[node.name];
        const isDefaultMethodRoute =
          routeMethod !== undefined && args.length === 1;
        const isRootRoute = node.name === "root" && args.length > 0;
        const isMatchRoute = node.name === "match" && args.length > 0;
        if (
          node.receiver === null &&
          (isDefaultMethodRoute || isRootRoute || isMatchRoute)
        ) {
          const routePath = node.name === "root" ? "/" : firstString;
          if (routePath !== undefined) {
            routes.push({
              path: routePath,
              ...(routeMethod === undefined && node.name !== "root"
                ? {}
                : { method: routeMethod ?? "GET" }),
              range: callRange,
            });
          }
        }

        references.push({
          kind: "call",
          targetName: node.name,
          ...(containingSymbolId === undefined
            ? {}
            : { sourceSymbolId: containingSymbolId }),
          range:
            node.messageLoc === null ? callRange : rangeOf(node.messageLoc),
        });
      }

      for (const child of node.childNodes()) {
        if (child !== null) visit(child, childScopes, childSymbolId);
      }
    };

    visit(parsed.value);
    for (const error of parsed.errors) {
      diagnostics.push(
        makeDiagnostic(
          "ruby-parse-error",
          "warning",
          "Ruby syntax errors were reported; extracted structure may be incomplete.",
          rangeOf(error.location),
        ),
      );
    }
    for (const warning of parsed.warnings) {
      diagnostics.push(
        makeDiagnostic(
          "ruby-parse-warning",
          "info",
          "The Ruby parser reported a warning for this file.",
          rangeOf(warning.location),
        ),
      );
    }

    return {
      schemaVersion: 1,
      analyzerId: this.id,
      analyzerVersion: this.version,
      language: input.language,
      filePath: input.filePath,
      snapshotId: input.snapshotId,
      contentHash: input.contentHash,
      status: parsed.errors.length > 0 ? "partial" : "complete",
      symbols,
      imports,
      exports,
      routes,
      references,
      diagnostics,
    };
  },
};
