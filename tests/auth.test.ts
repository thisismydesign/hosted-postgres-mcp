import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { Request } from "express";
import { getDatabaseUrl } from "../src/auth.js";

describe("getDatabaseUrl", () => {
  const createMockRequest = (headers: Record<string, string> = {}): Request =>
    ({ headers } as Request);

  afterEach(() => {
    delete process.env.AUTH_TOKENS;
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_USER;
    delete process.env.DATABASE_PASSWORD;
    delete process.env.DATABASE_HOST;
    delete process.env.DATABASE_PORT;
    delete process.env.DATABASE_NAME;
  });

  it("returns URL and extracts user from bearer token", () => {
    process.env.AUTH_TOKENS = JSON.stringify({
      "test-token": "postgresql://tokenuser:pass@host:5432/db",
    });

    const req = createMockRequest({
      authorization: "Bearer test-token",
    });
    const result = getDatabaseUrl(req);
    assert.deepStrictEqual(result, {
      databaseUrl: "postgresql://tokenuser:pass@host:5432/db",
      user: "tokenuser",
    });
  });

  it("returns URL and extracts user from x-database-url header", () => {
    const req = createMockRequest({
      "x-database-url": "postgresql://urluser:pass@host:5432/db",
    });
    const result = getDatabaseUrl(req);
    assert.deepStrictEqual(result, {
      databaseUrl: "postgresql://urluser:pass@host:5432/db",
      user: "urluser",
    });
  });

  it("returns URL and extracts user from DATABASE_URL env var", () => {
    process.env.DATABASE_URL = "postgresql://envuser:pass@host:5432/db";

    const req = createMockRequest();
    const result = getDatabaseUrl(req);
    assert.deepStrictEqual(result, {
      databaseUrl: "postgresql://envuser:pass@host:5432/db",
      user: "envuser",
    });
  });

  it("constructs URL and extracts user from credential headers", () => {
    const req = createMockRequest({
      "x-database-user": "creduser",
      "x-database-password": "pass",
      "x-database-host": "localhost",
      "x-database-port": "5432",
      "x-database-name": "testdb",
    });
    const result = getDatabaseUrl(req);
    assert.deepStrictEqual(result, {
      databaseUrl: "postgresql://creduser:pass@localhost:5432/testdb",
      user: "creduser",
    });
  });

  it("constructs URL and extracts user from credential env vars", () => {
    process.env.DATABASE_USER = "envcreduser";
    process.env.DATABASE_PASSWORD = "pass";
    process.env.DATABASE_HOST = "envhost";
    process.env.DATABASE_PORT = "5433";
    process.env.DATABASE_NAME = "envdb";

    const req = createMockRequest();
    const result = getDatabaseUrl(req);
    assert.deepStrictEqual(result, {
      databaseUrl: "postgresql://envcreduser:pass@envhost:5433/envdb",
      user: "envcreduser",
    });
  });

  it("throws when no auth provided", () => {
    const req = createMockRequest();
    assert.throws(
      () => getDatabaseUrl(req),
      /Missing authentication: provide Bearer token, DB URL, or DB credentials/
    );
  });
});
