import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AnalyzerRegistry } from "../src/analyzers/registry.js";
import { rubyAnalyzer } from "../src/analyzers/ruby.js";
import type { AnalyzerInput } from "../src/analyzers/types.js";

function makeInput(
  content: string,
  filePath = "app/models/order.rb",
): AnalyzerInput {
  return {
    language: "ruby",
    filePath,
    snapshotId: "ruby-fixture-snapshot",
    contentHash: createHash("sha256").update(content, "utf8").digest("hex"),
    content,
  };
}

describe("Ruby analyzer", () => {
  it("extracts nested definitions, methods, inheritance, constants, requires, and literal Rails routes", async () => {
    const input = makeInput(
      [
        'require "active_record"',
        'require_relative "../support/base"',
        "module Shop",
        "  class Order < BaseRecord",
        "    STATUS = :open",
        "    def close",
        "      persist!",
        "    end",
        "  end",
        "end",
        'get "/health"',
        'post "/orders"',
        'match "/custom", via: :get',
        'get "/overridden", via: :post',
        "get dynamic_path",
      ].join("\n"),
    );
    const registry = new AnalyzerRegistry([rubyAnalyzer]);

    const result = await registry.analyzeFile(input);

    expect(result.status).toBe("complete");
    expect(
      result.symbols.map(({ kind, qualifiedName }) => [kind, qualifiedName]),
    ).toEqual([
      ["module", "Shop"],
      ["class", "Shop::Order"],
      ["constant", "Shop::Order::STATUS"],
      ["method", "Shop::Order::close"],
    ]);
    expect(result.imports.map(({ specifier }) => specifier)).toEqual([
      "active_record",
      "../support/base",
    ]);
    expect(result.exports.map(({ name }) => name)).toEqual([
      "Shop",
      "Shop::Order::STATUS",
    ]);
    expect(result.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "inheritance",
          targetName: "BaseRecord",
        }),
        expect.objectContaining({ kind: "call", targetName: "persist!" }),
      ]),
    );
    expect(result.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "GET", path: "/health" }),
        expect.objectContaining({ method: "POST", path: "/orders" }),
        expect.objectContaining({ path: "/custom" }),
      ]),
    );
    expect(
      result.routes.find(({ path }) => path === "/custom"),
    ).not.toHaveProperty("method");
    expect(JSON.stringify(result)).not.toContain(input.content);
  });

  it("normalizes parser byte locations to one-based UTF-16 source ranges", async () => {
    const input = makeInput('label = "😀"; def café; end\n');
    const result = await new AnalyzerRegistry([rubyAnalyzer]).analyzeFile(
      input,
    );
    const method = result.symbols.find(({ name }) => name === "café");

    expect(method?.range).toEqual({
      startLine: 1,
      startColumn: 19,
      endLine: 1,
      endColumn: 23,
    });
  });

  it("returns partial structural output with safe diagnostics for malformed Ruby", async () => {
    const input = makeInput(
      "class Existing\nend\ndef unfinished(\n  secret_value\n",
    );
    const result = await new AnalyzerRegistry([rubyAnalyzer]).analyzeFile(
      input,
    );

    expect(result.status).toBe("partial");
    expect(result.symbols).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Existing" })]),
    );
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(
      result.diagnostics.every(
        ({ code, message }) =>
          code.startsWith("ruby-") && !message.includes("secret_value"),
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain("secret_value");
  });

  it("omits dynamic require targets and nonliteral routes rather than guessing", async () => {
    const input = makeInput(
      "require dependency_name\nget route_path\n",
      "config/routes.rb",
    );
    const result = await new AnalyzerRegistry([rubyAnalyzer]).analyzeFile(
      input,
    );

    expect(result.status).toBe("complete");
    expect(result.imports).toEqual([]);
    expect(result.routes).toEqual([]);
  });

  it("produces deterministic output for identical snapshot input", async () => {
    const input = makeInput(
      "module Stable\n  def self.call; worker.run; end\nend\n",
    );
    const registry = new AnalyzerRegistry([rubyAnalyzer]);
    const first = await registry.analyzeFile(input);
    const second = await registry.analyzeFile(input);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
