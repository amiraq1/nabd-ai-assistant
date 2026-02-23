import fs from "fs";
import path from "path";
import { z } from "zod";
import { SKILL_HANDLERS } from "./handlers.js";
import type {
  LoadedSkill,
  SkillInputSchema,
  SkillManifest,
} from "./types.js";

const SKILLS_ROOT = process.env.NABD_SKILLS_DIR?.trim()
  ? path.resolve(process.cwd(), process.env.NABD_SKILLS_DIR.trim())
  : path.resolve(process.cwd(), "skills");
const DISCOVERY_TTL_MS = 4_000;

const skillManifestSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(2)
      .regex(/^[a-z0-9_\-]+$/),
    name: z.string().trim().min(2),
    description: z.string().trim().min(6),
    category: z.string().trim().min(2),
    version: z.string().trim().min(1),
    handler: z.string().trim().min(2),
    inputSchema: z.object({
      type: z.literal("object"),
      properties: z.record(
        z.object({
          type: z.enum(["string", "number", "boolean"]),
          description: z.string().trim().min(1),
        }),
      ),
      required: z.array(z.string().trim().min(1)).default([]),
      additionalProperties: z.boolean().default(false),
    }),
    planner: z
      .object({
        keywords: z.array(z.string().trim().min(1)).default([]),
        patterns: z.array(z.string().trim().min(1)).optional(),
        extractor: z
          .enum([
            "none",
            "location",
            "query",
            "currency",
            "timezone",
            "country",
            "news_topic",
            "ip",
          ])
          .optional(),
        objective: z.string().trim().min(2).optional(),
        priority: z.number().int().optional(),
      })
      .optional(),
    samplePrompts: z.array(z.string().trim().min(2)).max(8).optional(),
  })
  .strict();

interface ParsedSkillMarkdown {
  frontmatter: Record<string, string | Record<string, string>>;
  body: string;
}

let skillsCache: LoadedSkill[] = [];
let lastScanAt = 0;
let lastScanError: string | null = null;

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_\-\u0600-\u06FF\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function parseInputAgainstSchema(
  schema: SkillInputSchema,
  rawInput: unknown,
): Record<string, unknown> {
  const base =
    rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)
      ? (rawInput as Record<string, unknown>)
      : {};
  const output: Record<string, unknown> = {};

  if (!schema.additionalProperties) {
    const unknownKeys = Object.keys(base).filter((key) => !(key in schema.properties));
    if (unknownKeys.length > 0) {
      throw new Error(`مدخلات غير مدعومة: ${unknownKeys.join(", ")}`);
    }
  }

  for (const [key, property] of Object.entries(schema.properties)) {
    const value = base[key];
    const isRequired = schema.required.includes(key);

    if (value === undefined || value === null) {
      if (isRequired) {
        throw new Error(`الحقل "${key}" مطلوب`);
      }
      continue;
    }

    if (property.type === "string") {
      if (typeof value !== "string") {
        throw new Error(`الحقل "${key}" يجب أن يكون نصًا`);
      }
      const trimmed = value.trim();
      if (!trimmed && isRequired) {
        throw new Error(`الحقل "${key}" لا يمكن أن يكون فارغًا`);
      }
      if (trimmed) output[key] = trimmed;
      continue;
    }

    if (property.type === "number") {
      const parsed =
        typeof value === "number"
          ? value
          : typeof value === "string"
            ? Number(value)
            : Number.NaN;
      if (!Number.isFinite(parsed)) {
        throw new Error(`الحقل "${key}" يجب أن يكون رقمًا`);
      }
      output[key] = parsed;
      continue;
    }

    if (property.type === "boolean") {
      if (typeof value !== "boolean") {
        throw new Error(`الحقل "${key}" يجب أن يكون قيمة منطقية`);
      }
      output[key] = value;
    }
  }

  if (schema.additionalProperties) {
    for (const [key, value] of Object.entries(base)) {
      if (!(key in schema.properties)) {
        output[key] = value;
      }
    }
  }

  return output;
}

function loadManifestFromPath(manifestPath: string): SkillManifest | null {
  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return skillManifestSchema.parse(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid manifest";
    console.warn(`[skills] skipping invalid manifest ${manifestPath}: ${message}`);
    return null;
  }
}

function normalizeFrontmatterValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseSkillMarkdown(skillMdPath: string): ParsedSkillMarkdown | null {
  try {
    const raw = fs.readFileSync(skillMdPath, "utf8").replace(/\r\n/g, "\n");
    if (!raw.startsWith("---\n")) {
      return null;
    }

    const closingIndex = raw.indexOf("\n---\n", 4);
    if (closingIndex < 0) {
      return null;
    }

    const frontmatterRaw = raw.slice(4, closingIndex);
    const body = raw.slice(closingIndex + "\n---\n".length).trim();

    const frontmatter: Record<string, string | Record<string, string>> = {};
    const lines = frontmatterRaw.split("\n");
    let pendingObjectKey: string | null = null;

    for (const line of lines) {
      if (!line.trim() || line.trim().startsWith("#")) continue;

      const nestedMatch = line.match(/^\s{2,}([A-Za-z0-9_.-]+):\s*(.*)$/);
      if (nestedMatch && pendingObjectKey) {
        const container = (frontmatter[pendingObjectKey] ?? {}) as Record<string, string>;
        container[nestedMatch[1]] = normalizeFrontmatterValue(nestedMatch[2]);
        frontmatter[pendingObjectKey] = container;
        continue;
      }

      const topMatch = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
      if (!topMatch) continue;

      const key = topMatch[1].trim();
      const value = topMatch[2] ?? "";

      if (value.trim() === "") {
        frontmatter[key] = {};
        pendingObjectKey = key;
      } else {
        frontmatter[key] = normalizeFrontmatterValue(value);
        pendingObjectKey = null;
      }
    }

    return { frontmatter, body };
  } catch {
    return null;
  }
}

function fallbackInstructionSchema(): SkillInputSchema {
  return {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: true,
  };
}

function buildInstructionOnlySkill(
  skillMdPath: string,
  parsed: ParsedSkillMarkdown,
): LoadedSkill | null {
  const nameField = parsed.frontmatter.name;
  const descriptionField = parsed.frontmatter.description;

  const rawId = typeof nameField === "string" ? nameField.trim() : "";
  const id = rawId || path.basename(path.dirname(skillMdPath));
  const description =
    typeof descriptionField === "string" && descriptionField.trim()
      ? descriptionField.trim()
      : "Instruction-only Agent Skill";

  if (!id) {
    return null;
  }

  const metadata = parsed.frontmatter.metadata;
  const metadataMap =
    metadata && typeof metadata === "object" ? (metadata as Record<string, string>) : {};

  const category = metadataMap.category?.trim() || "instruction";
  const version = metadataMap.version?.trim() || "1.0.0";

  const keywords = Array.from(new Set([...tokenize(id), ...tokenize(description)])).slice(0, 18);

  return {
    id,
    name: id,
    description,
    category,
    version,
    handler: "instruction_only",
    inputSchema: fallbackInstructionSchema(),
    planner: {
      keywords,
      objective: `تفعيل تعليمات skill ${id} عند ارتباط الطلب بها.`,
      priority: 5,
      extractor: "none",
    },
    samplePrompts: [],
    format: "agent-skills",
    isExecutable: false,
    skillFilePath: skillMdPath,
    instructions: parsed.body || undefined,
    parseInput: () => ({}),
    execute: async () => {
      throw new Error(`المهارة "${id}" إرشادية فقط ولا تملك handler تنفيذي.`);
    },
  };
}

function discoverSkillsOnDisk(): LoadedSkill[] {
  if (!fs.existsSync(SKILLS_ROOT)) {
    return [];
  }

  const dirents = fs.readdirSync(SKILLS_ROOT, { withFileTypes: true });
  const loaded: LoadedSkill[] = [];
  const seenIds = new Set<string>();

  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;

    const skillDir = path.join(SKILLS_ROOT, dirent.name);
    const jsonPath = path.join(skillDir, "skill.json");
    const skillMdPath = path.join(skillDir, "SKILL.md");

    const hasJson = fs.existsSync(jsonPath);
    const hasSkillMd = fs.existsSync(skillMdPath);

    if (hasJson) {
      const manifest = loadManifestFromPath(jsonPath);
      if (!manifest) continue;

      if (seenIds.has(manifest.id)) {
        console.warn(`[skills] duplicated skill id "${manifest.id}" ignored`);
        continue;
      }

      const handler = SKILL_HANDLERS[manifest.handler];
      if (!handler) {
        console.warn(
          `[skills] missing handler "${manifest.handler}" for skill "${manifest.id}"`,
        );
        continue;
      }

      const parsedSkillMd = hasSkillMd ? parseSkillMarkdown(skillMdPath) : null;

      seenIds.add(manifest.id);
      loaded.push({
        ...manifest,
        format: "nabd-json",
        isExecutable: true,
        skillFilePath: hasSkillMd ? skillMdPath : jsonPath,
        instructions: parsedSkillMd?.body,
        execute: handler,
        parseInput: (rawInput) => parseInputAgainstSchema(manifest.inputSchema, rawInput),
      });
      continue;
    }

    if (hasSkillMd) {
      const parsed = parseSkillMarkdown(skillMdPath);
      if (!parsed) {
        console.warn(`[skills] invalid SKILL.md frontmatter: ${skillMdPath}`);
        continue;
      }

      const skill = buildInstructionOnlySkill(skillMdPath, parsed);
      if (!skill) continue;

      if (seenIds.has(skill.id)) {
        console.warn(`[skills] duplicated skill id "${skill.id}" ignored`);
        continue;
      }

      seenIds.add(skill.id);
      loaded.push(skill);
    }
  }

  return loaded.sort((left, right) => left.id.localeCompare(right.id));
}

function escapeXml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function refreshSkills(force = false): void {
  if (!force && Date.now() - lastScanAt < DISCOVERY_TTL_MS) {
    return;
  }

  try {
    skillsCache = discoverSkillsOnDisk();
    lastScanError = null;
  } catch (error) {
    lastScanError = error instanceof Error ? error.message : "unknown discovery error";
    console.error("[skills] discovery failed:", error);
  } finally {
    lastScanAt = Date.now();
  }
}

export function listSkills(): LoadedSkill[] {
  refreshSkills(false);
  return skillsCache;
}

export function listExecutableSkills(): LoadedSkill[] {
  return listSkills().filter((skill) => skill.isExecutable);
}

export function getSkillById(id: string): LoadedSkill | undefined {
  refreshSkills(false);
  return skillsCache.find((skill) => skill.id === id);
}

export function matchInstructionSkills(query: string, limit = 2): LoadedSkill[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = listSkills()
    .filter((skill) => Boolean(skill.instructions))
    .map((skill) => {
      const haystackTokens = new Set(
        tokenize(`${skill.id} ${skill.name} ${skill.description} ${skill.instructions ?? ""}`),
      );
      let score = 0;
      for (const token of queryTokens) {
        if (haystackTokens.has(token)) score += 1;
      }
      return { skill, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, limit));

  return scored.map((item) => item.skill);
}

export function buildAvailableSkillsXml(skills = listSkills()): string {
  const lines: string[] = ["<available_skills>"];
  for (const skill of skills) {
    lines.push("<skill>");
    lines.push(`<name>${escapeXml(skill.id)}</name>`);
    lines.push(`<description>${escapeXml(skill.description)}</description>`);
    lines.push(`<location>${escapeXml(skill.skillFilePath)}</location>`);
    lines.push("</skill>");
  }
  lines.push("</available_skills>");
  return lines.join("\n");
}

export async function runSkill(
  id: string,
  rawInput: Record<string, unknown> = {},
): Promise<{ text: string; metadata?: Record<string, unknown> }> {
  const skill = getSkillById(id);
  if (!skill) {
    throw new Error(`المهارة "${id}" غير متاحة حالياً`);
  }
  if (!skill.isExecutable) {
    throw new Error(`المهارة "${id}" إرشادية فقط وغير قابلة للتنفيذ المباشر`);
  }
  const parsed = skill.parseInput(rawInput);
  return skill.execute(parsed);
}

export function getSkillsDiagnostics(): {
  root: string;
  count: number;
  executableCount: number;
  ids: string[];
  formats: Array<{ id: string; format: LoadedSkill["format"]; executable: boolean }>;
  lastScanAt: string | null;
  lastScanError: string | null;
} {
  refreshSkills(false);
  return {
    root: SKILLS_ROOT,
    count: skillsCache.length,
    executableCount: skillsCache.filter((skill) => skill.isExecutable).length,
    ids: skillsCache.map((skill) => skill.id),
    formats: skillsCache.map((skill) => ({
      id: skill.id,
      format: skill.format,
      executable: skill.isExecutable,
    })),
    lastScanAt: lastScanAt > 0 ? new Date(lastScanAt).toISOString() : null,
    lastScanError,
  };
}
