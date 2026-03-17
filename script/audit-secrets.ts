import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseEnvFile } from "../server/load-env.ts";
import { isSensitivePublicEnvName } from "../server/security/public-env.ts";

const ROOT = process.cwd();
const SECRET_NAME_PATTERN = /(KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL|SERVICE_ROLE)/i;
const PUBLIC_SUPABASE_KEYS = new Set(["SUPABASE_ANON_KEY", "SUPABASE_URL", "SUPABASE_PROJECT_ID"]);
const DIRECT_SECRET_KEYS = [
  "AI_API_KEY",
  "NVIDIA_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "NEWS_API_KEY",
  "IPSTACK_API_KEY",
  "DATABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DEBUG_API_TOKEN",
  "REDIS_URL",
] as const;

const LITERAL_SECRET_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "OpenAI key", regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: "GitHub fine-grained PAT", regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { name: "GitHub classic PAT", regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { name: "Supabase personal access token", regex: /\bsbp_[A-Za-z0-9]{20,}\b/g },
  { name: "AWS access key id", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "Postgres connection string", regex: /\bpostgres(?:ql)?:\/\/[^\s"'`]+/g },
];

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return parseEnvFile(fs.readFileSync(filePath, "utf8"));
}

function maskValue(value: string): string {
  if (!value.trim()) {
    return "<empty>";
  }

  if (value.length <= 8) {
    return "*".repeat(value.length);
  }

  return `${value.slice(0, 2)}${"*".repeat(Math.min(8, value.length - 4))}${value.slice(-2)}`;
}

function getTrackedFiles(): string[] {
  const stdout = execFileSync("git", ["ls-files"], {
    cwd: ROOT,
    encoding: "utf8",
  });

  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !file.startsWith("generated-apps/"))
    .filter((file) => file !== ".env" && file !== ".env.example");
}

function classifyEnvInventory(envValues: Record<string, string>) {
  return Object.entries(envValues)
    .filter(
      ([key]) => SECRET_NAME_PATTERN.test(key) || key.startsWith("VITE_") || PUBLIC_SUPABASE_KEYS.has(key),
    )
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({
      key,
      hasValue: Boolean(value.trim()),
      masked: maskValue(value),
      classification: isSensitivePublicEnvName(key)
        ? "frontend-secret-risk"
        : key.startsWith("VITE_") || PUBLIC_SUPABASE_KEYS.has(key)
          ? "public-runtime"
          : "server-secret",
    }));
}

function scanTrackedFiles(files: string[]) {
  const findings: Array<{ file: string; name: string; preview: string }> = [];

  for (const relativePath of files) {
    const absolutePath = path.resolve(ROOT, relativePath);
    let content: string;
    try {
      content = fs.readFileSync(absolutePath, "utf8");
    } catch {
      continue;
    }

    for (const pattern of LITERAL_SECRET_PATTERNS) {
      const match = pattern.regex.exec(content);
      pattern.regex.lastIndex = 0;
      if (!match) {
        continue;
      }

      const matchedValue = match[0];
      if (
        pattern.name === "Postgres connection string" &&
        (matchedValue.includes("...") || matchedValue.includes("your-"))
      ) {
        continue;
      }

      findings.push({
        file: relativePath,
        name: pattern.name,
        preview: maskValue(matchedValue),
      });
    }
  }

  return findings;
}

function printSection(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function main(): void {
  const envValues = readEnvFile(path.resolve(ROOT, ".env"));
  const envExampleValues = readEnvFile(path.resolve(ROOT, ".env.example"));
  const trackedFiles = getTrackedFiles();
  const inventory = classifyEnvInventory(envValues);
  const literalFindings = scanTrackedFiles(trackedFiles);

  printSection("Secret Inventory (.env)");
  if (inventory.length === 0) {
    console.log("No secret-like keys found in .env.");
  } else {
    for (const item of inventory) {
      console.log(
        `${item.key} | ${item.classification} | ${item.hasValue ? "set" : "empty"} | ${item.masked}`,
      );
    }
  }

  printSection("Direct Secret Presence");
  for (const key of DIRECT_SECRET_KEYS) {
    const value = envValues[key] ?? "";
    console.log(`${key} | ${value.trim() ? "present" : "missing"}`);
  }

  printSection("Public Env Leak Check");
  const publicLeaks = inventory.filter((item) => item.classification === "frontend-secret-risk");
  if (publicLeaks.length === 0) {
    console.log("No sensitive VITE_* variables detected in .env.");
  } else {
    for (const leak of publicLeaks) {
      console.log(`${leak.key} is dangerous and should be removed from client-exposed env.`);
    }
  }

  printSection("Tracked File Literal Secret Scan");
  if (literalFindings.length === 0) {
    console.log("No literal secret patterns detected in tracked files.");
  } else {
    for (const finding of literalFindings) {
      console.log(`${finding.name} | ${finding.file} | ${finding.preview}`);
    }
  }

  printSection("Secrets Provider Readiness");
  const provider = (envValues.SECRETS_PROVIDER || "env").trim() || "env";
  console.log(`SECRETS_PROVIDER | ${provider}`);
  console.log(
    `AWS_SECRETS_MANAGER_SECRET_ID | ${(envValues.AWS_SECRETS_MANAGER_SECRET_ID || "").trim() ? "configured" : "missing"}`,
  );
  console.log(
    `VAULT_KV_PATH | ${(envValues.VAULT_KV_PATH || "").trim() ? "configured" : "missing"}`,
  );

  printSection(".env.example Coverage");
  for (const key of DIRECT_SECRET_KEYS) {
    console.log(`${key} | ${Object.prototype.hasOwnProperty.call(envExampleValues, key) ? "documented" : "missing"}`);
  }
}

main();
