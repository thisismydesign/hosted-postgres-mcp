import { Request } from "express";
import { AsyncLocalStorage } from "async_hooks";

type TokenMap = Record<string, string>;

export type RequestContext = {
  user: string;
};

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getCurrentUser(): string {
  const user = requestContext.getStore()?.user;
  if (!user) {
    throw new Error("No user in request context");
  }
  return user;
}

function getTokenMap(): TokenMap {
  const tokensJson = process.env.AUTH_TOKENS;
  if (!tokensJson) {
    return {};
  }
  try {
    return JSON.parse(tokensJson);
  } catch (error) {
    console.error("Failed to parse AUTH_TOKENS env var:", error);
    return {};
  }
}

function getDatabaseUrlFromToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice("Bearer ".length);
  const tokenMap = getTokenMap();
  const databaseUrl = tokenMap[token];
  if (!databaseUrl) {
    throw new Error("Invalid or unknown bearer token");
  }
  return databaseUrl;
}

function getDatabaseUrlFromFullUrl(req: Request): string | null {
  return (req.headers["x-database-url"] as string) || process.env.DATABASE_URL || null;
}

function getDatabaseUrlFromCredentials(req: Request): string | null {
  const user = (req.headers["x-database-user"] as string) || process.env.DATABASE_USER;
  const password = (req.headers["x-database-password"] as string) || process.env.DATABASE_PASSWORD;
  const host = (req.headers["x-database-host"] as string) || process.env.DATABASE_HOST;
  const port = (req.headers["x-database-port"] as string) || process.env.DATABASE_PORT;
  const dbName = (req.headers["x-database-name"] as string) || process.env.DATABASE_NAME;

  if (!user && !password && !host && !port && !dbName) {
    return null;
  }

  return `postgresql://${user}:${password}@${host}:${port}/${dbName}`;
}

function extractUserFromUrl(databaseUrl: string): string {
  const match = databaseUrl.match(/postgresql:\/\/([^:]+):/);
  if (!match?.[1]) {
    throw new Error("Invalid database URL: could not extract user");
  }
  return match[1];
}

export function getDatabaseUrl(req: Request): { databaseUrl: string; user: string } {
  const databaseUrl = getDatabaseUrlFromToken(req)
    ?? getDatabaseUrlFromFullUrl(req)
    ?? getDatabaseUrlFromCredentials(req);

  if (!databaseUrl) {
    throw new Error("Missing authentication: provide Bearer token, DB URL, or DB credentials");
  }

  return { databaseUrl, user: extractUserFromUrl(databaseUrl) };
}
