import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  AnalyzerInputError,
  AnalyzerRegistry,
  AnalyzerRegistryConfigurationError,
} from "../src/analyzers/registry.js";
import type {
  AnalyzerInput,
  AnalyzerResult,
  LanguageAnalyzer,
} from "../src/analyzers/types.js";

function makeInput(
  filePath = "src/example.ts",
  content = "const answer = 42;",
): AnalyzerInput {
  return {
    language: "typescript",
    filePath,
    snapshotId: "snapshot-123",
    contentHash: createHash("sha256").update(content, "utf8").digest("hex"),
    content,
  };
}

function makeResult(input: AnalyzerInput): AnalyzerResult {
  return {
    schemaVersion: 1,
    analyzerId: "typescript-test",
    analyzerVersion: "1.0.0",
    language: input.language,
    filePath: input.filePath,
    snapshotId: input.snapshotId,
    contentHash: input.contentHash,
    status: "complete",
    symbols: [
      {
        id: "symbol-answer",
        kind: "constant",
        name: "answer",
        range: {
          startLine: 1,
          startColumn: 7,
          endLine: 1,
          endColumn: 13,
        },
      },
    ],
    imports: [],
    exports: [],
    routes: [],
    references: [],
    diagnostics: [],
  };
}

function makeAnalyzer(
  analyze: LanguageAnalyzer["analyze"] = async (input) => makeResult(input),
  overrides: Partial<LanguageAnalyzer> = {},
): LanguageAnalyzer {
  return {
    id: "typescript-test",
    version: "1.0.0",
    language: "typescript",
    supportedExtensions: [".ts", ".tsx"],
    analyze,
    ...overrides,
  };
}

describe("AnalyzerRegistry", () => {
  it("dispatches by canonical language and case-insensitive extension", async () => {
    const analyze = vi.fn(async (input: AnalyzerInput) => makeResult(input));
    const registry = new AnalyzerRegistry([makeAnalyzer(analyze)]);

    const result = await registry.analyzeFile(makeInput("src/Example.TS"));

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("complete");
    expect(result.filePath).toBe("src/Example.TS");
  });

  it("returns an explicit unsupported result when no adapter matches", async () => {
    const registry = new AnalyzerRegistry([]);

    const result = await registry.analyzeFile({
      ...makeInput("src/main.java"),
      language: "java",
    });

    expect(result).toMatchObject({
      status: "unsupported",
      language: "java",
      analyzerId: "repomind.analyzer-registry",
      diagnostics: [{ code: "analyzer-unavailable" }],
      symbols: [],
    });
  });

  it("rejects duplicate adapter claims and malformed registrations", () => {
    expect(
      () =>
        new AnalyzerRegistry([
          makeAnalyzer(undefined, { id: "a", supportedExtensions: [".ts"] }),
          makeAnalyzer(undefined, { id: "b", supportedExtensions: [".TS"] }),
        ]),
    ).toThrow(AnalyzerRegistryConfigurationError);
    expect(
      () =>
        new AnalyzerRegistry([
          makeAnalyzer(undefined, { supportedExtensions: ["../ts"] }),
        ]),
    ).toThrow(AnalyzerRegistryConfigurationError);
  });

  it("rejects unsafe paths and a content digest that does not match input", async () => {
    const analyze = vi.fn(async (input: AnalyzerInput) => makeResult(input));
    const registry = new AnalyzerRegistry([makeAnalyzer(analyze)]);

    await expect(
      registry.analyzeFile(makeInput("../outside.ts")),
    ).rejects.toBeInstanceOf(AnalyzerInputError);
    await expect(
      registry.analyzeFile({
        ...makeInput(),
        filePath: 42,
      } as unknown as AnalyzerInput),
    ).rejects.toBeInstanceOf(AnalyzerInputError);
    const input = makeInput();
    await expect(
      registry.analyzeFile({ ...input, contentHash: "0".repeat(64) }),
    ).rejects.toBeInstanceOf(AnalyzerInputError);
    expect(analyze).not.toHaveBeenCalled();
  });

  it("rejects stale provenance and malformed or out-of-bounds ranges", async () => {
    const mismatchedResults = [
      makeAnalyzer(async (input) => ({
        ...makeResult(input),
        filePath: "other.ts",
      })),
      makeAnalyzer(async (input) => ({
        ...makeResult(input),
        snapshotId: "stale-snapshot",
      })),
      makeAnalyzer(async (input) => ({
        ...makeResult(input),
        contentHash: "0".repeat(64),
      })),
    ];
    const invalidRange = makeAnalyzer(async (input) => ({
      ...makeResult(input),
      symbols: [
        {
          ...makeResult(input).symbols[0]!,
          range: { startLine: 3, startColumn: 1, endLine: 3, endColumn: 2 },
        },
      ],
    }));

    const provenanceResults = await Promise.all(
      mismatchedResults.map((analyzer) =>
        new AnalyzerRegistry([analyzer]).analyzeFile(makeInput()),
      ),
    );
    const rangeResult = await new AnalyzerRegistry([invalidRange]).analyzeFile(
      makeInput(),
    );

    expect(provenanceResults).toHaveLength(3);
    for (const result of provenanceResults) {
      expect(result).toMatchObject({
        status: "failed",
        diagnostics: [{ code: "analyzer-invalid-result" }],
        symbols: [],
      });
    }
    expect(rangeResult.status).toBe("failed");
  });

  it("contains parser exceptions without exposing error text and continues the batch", async () => {
    const calls: string[] = [];
    const analyzer = makeAnalyzer(async (input) => {
      calls.push(input.filePath);
      if (input.filePath.endsWith("a.ts")) {
        throw new Error("PRIVATE_SOURCE_VALUE");
      }
      return makeResult(input);
    });
    const registry = new AnalyzerRegistry([analyzer]);

    const results = await registry.analyzeFiles([
      makeInput("src/b.ts"),
      { ...makeInput("src/z.java"), language: "java" },
      makeInput("src/a.ts"),
    ]);

    expect(calls).toEqual(["src/a.ts", "src/b.ts"]);
    expect(results.results.map((result) => result.status)).toEqual([
      "failed",
      "complete",
      "unsupported",
    ]);
    expect(results.coverage).toEqual([
      {
        language: "java",
        totalFiles: 1,
        counts: { complete: 0, partial: 0, unsupported: 1, failed: 0 },
      },
      {
        language: "typescript",
        totalFiles: 2,
        counts: { complete: 1, partial: 0, unsupported: 0, failed: 1 },
      },
    ]);
    expect(JSON.stringify(results)).not.toContain("PRIVATE_SOURCE_VALUE");
  });

  it("rejects an adapter diagnostic that echoes the complete source", async () => {
    const analyzer = makeAnalyzer(async (input) => ({
      ...makeResult(input),
      diagnostics: [
        {
          code: "parser-warning",
          severity: "warning",
          message: input.content,
        },
      ],
    }));

    const result = await new AnalyzerRegistry([analyzer]).analyzeFile(
      makeInput(),
    );

    expect(result).toMatchObject({
      status: "failed",
      diagnostics: [{ code: "analyzer-invalid-result" }],
    });
  });

  it("canonicalizes result collections and nested binding order", async () => {
    const analyzer = makeAnalyzer(async (input) => ({
      ...makeResult(input),
      imports: [
        {
          specifier: "z-module",
          bindings: ["z", "a"],
          range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
        },
        {
          specifier: "a-module",
          bindings: ["b", "a"],
          range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
        },
      ],
    }));

    const result = await new AnalyzerRegistry([analyzer]).analyzeFile(
      makeInput(),
    );

    expect(result.imports.map((entry) => entry.specifier)).toEqual([
      "a-module",
      "z-module",
    ]);
    expect(result.imports[0]?.bindings).toEqual(["a", "b"]);
    expect(result.imports[1]?.bindings).toEqual(["a", "z"]);
  });
});
