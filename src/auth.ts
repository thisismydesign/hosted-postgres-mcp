import { Request } from "express";

type TokenMap = Record<string, string>;

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
  const token = authHeader.slice(7);
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

  const missing: string[] = [];
  if (!user) missing.push("user");
  if (!password) missing.push("password");
  if (!host) missing.push("host");
  if (!port) missing.push("port");
  if (!dbName) missing.push("database name");

  if (missing.length > 0) {
    throw new Error(`Missing database configuration: ${missing.join(", ")}`);
  }

  return `postgresql://${user}:${password}@${host}:${port}/${dbName}`;
}

export function getDatabaseUrl(req: Request): string {
  const tokenUrl = getDatabaseUrlFromToken(req);
  if (tokenUrl) return tokenUrl;

  const fullUrl = getDatabaseUrlFromFullUrl(req);
  if (fullUrl) return fullUrl;

  const credentialsUrl = getDatabaseUrlFromCredentials(req);
  if (credentialsUrl) return credentialsUrl;

  throw new Error("Missing authentication: provide Bearer token, X-Database-Url, or credential headers/env vars");
}
