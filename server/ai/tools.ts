import { listExecutableSkills, runSkill } from "../skills/registry.js";
import type { SkillPlannerExtractor } from "../skills/types.js";

export type ToolName = string;

interface ToolSchema {
  type: "object";
  properties: Record<string, { type: string; description: string }>;
  required: string[];
  additionalProperties: boolean;
}

export interface ToolExecutionOutput {
  text: string;
  metadata?: Record<string, unknown>;
}

export interface ToolPlanningMatch {
  toolName: ToolName;
  toolInput: Record<string, unknown>;
  objective: string;
  score: number;
}

export interface ModelToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: ToolSchema;
  };
}

const CITY_TIMEZONE_MAP: Record<string, string> = {
  الرياض: "Asia/Riyadh",
  جدة: "Asia/Riyadh",
  مكة: "Asia/Riyadh",
  المدينة: "Asia/Riyadh",
  dubai: "Asia/Dubai",
  دبي: "Asia/Dubai",
  أبوظبي: "Asia/Dubai",
  cairo: "Africa/Cairo",
  القاهرة: "Africa/Cairo",
  tokyo: "Asia/Tokyo",
  طوكيو: "Asia/Tokyo",
  london: "Europe/London",
  لندن: "Europe/London",
  paris: "Europe/Paris",
  باريس: "Europe/Paris",
  newyork: "America/New_York",
  "new york": "America/New_York",
  "نيويورك": "America/New_York",
};

function normalizeForIntent(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeArabicDigits(input: string): string {
  const map: Record<string, string> = {
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
  };
  return input.replace(/[٠-٩]/g, (digit) => map[digit] ?? digit);
}

export function extractLocationFromText(input: string): string | null {
  const cleaned = input.trim();
  const patterns = [
    /(?:في|ب)\s+([^\n،,.؟!]+)/,
    /(?:طقس|weather|forecast)\s+([^\n،,.؟!]+)/i,
    /(?:مدينة|city)\s+([^\n،,.؟!]+)/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

export function extractSearchQuery(input: string): string {
  const cleaned = input.trim();
  const normalized = cleaned
    .replace(/^(ابحث(?:\s+لي)?(?:\s+عن)?)/, "")
    .replace(/^(search(?:\s+for)?)/i, "")
    .replace(/^(اعطني|اعطني معلومات|أعطني|أعطني معلومات)\s+(?:عن)?/, "")
    .replace(/^(من هو|ما هو|ما هي)/, "")
    .replace(/^(tell me about)/i, "")
    .trim();

  return normalized || cleaned;
}

function extractTimezoneFromText(input: string): string | null {
  const cleaned = input.trim();
  const explicitTz = cleaned.match(/([A-Za-z]+\/[A-Za-z_+-]+)/);
  if (explicitTz?.[1]) {
    return explicitTz[1];
  }

  const locationMatch = cleaned.match(/(?:في|ب|for|in)\s+([^\n،,.؟!]+)/i);
  const location = locationMatch?.[1]?.trim().toLowerCase();
  if (location && CITY_TIMEZONE_MAP[location]) {
    return CITY_TIMEZONE_MAP[location];
  }

  for (const [key, value] of Object.entries(CITY_TIMEZONE_MAP)) {
    if (cleaned.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  return null;
}

function extractCurrencyFromText(input: string): {
  from?: string;
  to?: string;
  amount?: number;
} {
  const cleaned = normalizeArabicDigits(input).toUpperCase();
  const pairWithAmount = cleaned.match(
    /(\d+(?:\.\d+)?)\s*([A-Z]{3})\s*(?:إلى|الى|TO|->|→)\s*([A-Z]{3})/i,
  );
  if (pairWithAmount) {
    return {
      amount: Number(pairWithAmount[1]),
      from: pairWithAmount[2],
      to: pairWithAmount[3],
    };
  }

  const pairOnly = cleaned.match(/(?:من|FROM)\s*([A-Z]{3})\s*(?:إلى|الى|TO)\s*([A-Z]{3})/i);
  if (pairOnly) {
    return {
      amount: 1,
      from: pairOnly[1],
      to: pairOnly[2],
    };
  }

  const codes = cleaned.match(/\b[A-Z]{3}\b/g) ?? [];
  if (codes.length >= 2) {
    return { from: codes[0], to: codes[1], amount: 1 };
  }

  return { from: "USD", to: "SAR", amount: 1 };
}

function extractCountryFromText(input: string): string | null {
  const cleaned = input.trim();
  const patterns = [
    /(?:عن|حول|داخل|في)\s+([^\n،,.؟!]+)/,
    /(?:country|capital of)\s+([^\n،,.؟!]+)/i,
    /(?:دولة|بلد)\s+([^\n،,.؟!]+)/,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return null;
}

function extractNewsTopic(input: string): string {
  const cleaned = input.trim();
  return cleaned
    .replace(/^(أخبار|خبر|ما آخر أخبار|اعطني أخبار|أعطني أخبار)\s*/i, "")
    .replace(/^(news|headlines|latest news)\s*/i, "")
    .trim();
}

function extractIpFromText(input: string): string | null {
  const ipv4 =
    input.match(
      /\b(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})\b/,
    )?.[0] ?? null;
  if (ipv4) return ipv4;

  const ipv6 = input.match(/\b(?:[a-fA-F0-9]{1,4}:){2,7}[a-fA-F0-9]{1,4}\b/)?.[0] ?? null;
  return ipv6;
}

function computeIntentScore(
  segment: string,
  keywords: string[],
  patterns?: string[],
): number {
  if (!keywords.length && (!patterns || patterns.length === 0)) {
    return 0;
  }

  const normalized = normalizeForIntent(segment);
  let score = 0;

  for (const keyword of keywords) {
    if (normalized.includes(keyword.toLowerCase())) {
      score += 1;
    }
  }

  for (const pattern of patterns ?? []) {
    try {
      if (new RegExp(pattern, "i").test(segment)) {
        score += 2;
      }
    } catch {
      // Ignore invalid regex in external skill manifests.
    }
  }

  return score;
}

function buildInputFromExtractor(
  extractor: SkillPlannerExtractor | undefined,
  segment: string,
): Record<string, unknown> {
  switch (extractor) {
    case "location":
      return { location: extractLocationFromText(segment) ?? "الرياض" };
    case "query":
      return { query: extractSearchQuery(segment) };
    case "currency": {
      const parsed = extractCurrencyFromText(segment);
      return {
        from: parsed.from ?? "USD",
        to: parsed.to ?? "SAR",
        amount: parsed.amount ?? 1,
      };
    }
    case "timezone":
      return { timezone: extractTimezoneFromText(segment) ?? "Asia/Riyadh" };
    case "country":
      return { country: extractCountryFromText(segment) ?? "المملكة العربية السعودية" };
    case "news_topic": {
      const topic = extractNewsTopic(segment);
      return topic ? { topic, language: "ar" } : { topic: "الذكاء الاصطناعي", language: "ar" };
    }
    case "ip":
      return { ip: extractIpFromText(segment) ?? undefined };
    case "none":
    default:
      return {};
  }
}

export function matchToolForSegment(segment: string): ToolPlanningMatch | null {
  const candidates = listExecutableSkills()
    .map((skill) => {
      const score = computeIntentScore(
        segment,
        skill.planner?.keywords ?? [],
        skill.planner?.patterns,
      );
      if (score <= 0) return null;

      return {
        toolName: skill.id,
        toolInput: buildInputFromExtractor(skill.planner?.extractor, segment),
        objective:
          skill.planner?.objective ??
          `تشغيل مهارة ${skill.name} لمعالجة جزء الطلب: ${segment}`,
        score: score + (skill.planner?.priority ?? 0) / 100,
      } as ToolPlanningMatch;
    })
    .filter((item): item is ToolPlanningMatch => item !== null)
    .sort((left, right) => right.score - left.score);

  return candidates[0] ?? null;
}

export function listToolDefinitions(): Array<{
  name: ToolName;
  description: string;
  inputSchema: ToolSchema;
}> {
  return listExecutableSkills().map((skill) => ({
    name: skill.id,
    description: skill.description,
    inputSchema: skill.inputSchema,
  }));
}

export function listModelToolDefinitions(): ModelToolDefinition[] {
  return listExecutableSkills().map((skill) => ({
    type: "function",
    function: {
      name: skill.id,
      description: skill.description,
      parameters: skill.inputSchema,
    },
  }));
}

export async function runTool(
  name: ToolName,
  rawInput: Record<string, unknown> = {},
): Promise<ToolExecutionOutput> {
  return runSkill(name, rawInput);
}

export function looksLikeDateTimeIntent(input: string): boolean {
  const match = matchToolForSegment(input);
  return match?.toolName === "date_time" || match?.toolName === "world_time";
}

export function looksLikeWeatherIntent(input: string): boolean {
  const match = matchToolForSegment(input);
  return match?.toolName === "weather";
}

export function looksLikeWebSearchIntent(input: string): boolean {
  const match = matchToolForSegment(input);
  return match?.toolName === "web_search" || match?.toolName === "news_headlines";
}
