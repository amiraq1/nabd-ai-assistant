import type { PoolConfig } from "pg";
import { loadLocalEnv } from "./load-env.ts";

const LOCALHOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

loadLocalEnv();

function parseDatabaseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function isLocalDatabaseHost(hostname: string): boolean {
  return LOCALHOSTS.has(hostname.toLowerCase());
}

function shouldRequireSsl(url: URL): boolean {
  if (isLocalDatabaseHost(url.hostname)) {
    return false;
  }

  const sslmode = url.searchParams.get("sslmode")?.toLowerCase();
  if (sslmode === "disable") {
    return false;
  }

  return true;
}

function getSslMode(url: URL): "require" | "allow" | "prefer" | "verify-full" | false {
  const sslmode = url.searchParams.get("sslmode")?.toLowerCase();

  if (sslmode === "disable") {
    return false;
  }

  if (
    sslmode === "require" ||
    sslmode === "allow" ||
    sslmode === "prefer" ||
    sslmode === "verify-full"
  ) {
    return sslmode;
  }

  return shouldRequireSsl(url) ? "require" : false;
}

export function getOptionalDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    return null;
  }

  const parsed = parseDatabaseUrl(raw);
  if (!parsed) {
    return raw;
  }

  if (shouldRequireSsl(parsed) && !parsed.searchParams.has("sslmode")) {
    parsed.searchParams.set("sslmode", "require");
  }

  return parsed.toString();
}

export function getDatabaseUrl(): string {
  const value = getOptionalDatabaseUrl();
  if (!value) {
    throw new Error("DATABASE_URL is required");
  }

  return value;
}

export function hasDatabaseUrl(): boolean {
  return getOptionalDatabaseUrl() !== null;
}

export function getDrizzleKitPgCredentials():
  | {
      url: string;
    }
  | {
      host: string;
      port: number;
      user?: string;
      password?: string;
      database: string;
      ssl?: "require" | "allow" | "prefer" | "verify-full";
    } {
  const databaseUrl = getDatabaseUrl();
  const parsed = parseDatabaseUrl(databaseUrl);

  if (!parsed) {
    return {
      url: databaseUrl,
    };
  }

  const ssl = getSslMode(parsed);

  return {
    host: parsed.hostname,
    port: parsed.port ? Number.parseInt(parsed.port, 10) : 5432,
    user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    database: parsed.pathname.replace(/^\/+/, "") || "postgres",
    ssl: ssl || undefined,
  };
}

export function getNodePgPoolConfig(): PoolConfig {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    return {};
  }

  const parsed = parseDatabaseUrl(raw);
  if (!parsed) {
    return {
      connectionString: raw,
    };
  }

  const useSsl = shouldRequireSsl(parsed);

  // `pg` ignores constructor SSL options when ssl params live in the URL.
  parsed.searchParams.delete("sslmode");

  return {
    connectionString: parsed.toString(),
    ssl: useSsl
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  };
}
