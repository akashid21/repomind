import { describe, expect, it } from "vitest";
import { parseEnvironment } from "../src/config/env.js";

describe("parseEnvironment", () => {
  it("applies safe defaults and accepts a PostgreSQL URL", () => {
    expect(
      parseEnvironment({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      }),
    ).toEqual({
      NODE_ENV: "development",
      LOG_LEVEL: "info",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    });
  });

  it("rejects missing and non-PostgreSQL database URLs", () => {
    expect(() => parseEnvironment({})).toThrow();
    expect(() =>
      parseEnvironment({ DATABASE_URL: "https://example.com" }),
    ).toThrow();
  });

  it("rejects unsupported runtime modes and log levels", () => {
    expect(() =>
      parseEnvironment({
        DATABASE_URL: "postgres://localhost/db",
        NODE_ENV: "staging",
      }),
    ).toThrow();
    expect(() =>
      parseEnvironment({
        DATABASE_URL: "postgres://localhost/db",
        LOG_LEVEL: "verbose",
      }),
    ).toThrow();
  });
});
