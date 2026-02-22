import { z } from "zod";

export type ToolName = "date_time" | "weather" | "web_search";

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

interface ToolDefinition<TInput extends Record<string, unknown>> {
  name: ToolName;
  description: string;
  inputSchema: ToolSchema;
  parseInput: (input: unknown) => TInput;
  execute: (input: TInput) => Promise<ToolExecutionOutput>;
}

const REQUEST_TIMEOUT_MS = 8_000;

const WEATHER_CODE_AR: Record<number, string> = {
  0: "صحو",
  1: "غائم جزئياً",
  2: "غائم",
  3: "غائم كلياً",
  45: "ضباب",
  48: "ضباب متجمد",
  51: "رذاذ خفيف",
  53: "رذاذ متوسط",
  55: "رذاذ كثيف",
  56: "رذاذ متجمد خفيف",
  57: "رذاذ متجمد كثيف",
  61: "مطر خفيف",
  63: "مطر متوسط",
  65: "مطر غزير",
  66: "مطر متجمد خفيف",
  67: "مطر متجمد غزير",
  71: "ثلج خفيف",
  73: "ثلج متوسط",
  75: "ثلج كثيف",
  77: "حبوب ثلج",
  80: "زخات مطر خفيفة",
  81: "زخات مطر متوسطة",
  82: "زخات مطر عنيفة",
  85: "زخات ثلج خفيفة",
  86: "زخات ثلج كثيفة",
  95: "عاصفة رعدية",
  96: "عاصفة رعدية مع برد خفيف",
  99: "عاصفة رعدية مع برد كثيف",
};

const dateTimeInputSchema = z.object({}).passthrough();
const weatherInputSchema = z.object({
  location: z.string().min(2, "الموقع مطلوب"),
});
const webSearchInputSchema = z.object({
  query: z.string().min(2, "عبارة البحث مطلوبة"),
});

function buildNowText(): string {
  const now = new Date();
  const date = new Intl.DateTimeFormat("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);
  const time = new Intl.DateTimeFormat("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);
  return `الوقت الحالي هو ${time}، والتاريخ اليوم ${date}.`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

interface OpenMeteoGeocodeResponse {
  results?: Array<{
    name: string;
    country?: string;
    latitude: number;
    longitude: number;
  }>;
}

interface OpenMeteoWeatherResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
}

async function getWeatherForLocation(location: string): Promise<ToolExecutionOutput> {
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=ar&format=json`;
  const geoData = await fetchJson<OpenMeteoGeocodeResponse>(geoUrl);
  const match = geoData.results?.[0];

  if (!match) {
    return {
      text: `لم أتمكن من تحديد الموقع "${location}". حاول كتابة اسم مدينة أوضح.`,
    };
  }

  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${match.latitude}` +
    `&longitude=${match.longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&timezone=auto`;

  const weatherData = await fetchJson<OpenMeteoWeatherResponse>(weatherUrl);
  const current = weatherData.current;

  if (!current) {
    return {
      text: `تم العثور على الموقع "${match.name}" لكن بيانات الطقس غير متاحة حالياً.`,
    };
  }

  const weatherText =
    current.weather_code !== undefined
      ? WEATHER_CODE_AR[current.weather_code] ?? `رمز حالة الطقس ${current.weather_code}`
      : "غير متاح";

  const label = [match.name, match.country].filter(Boolean).join("، ");
  const temperature =
    current.temperature_2m !== undefined ? `${current.temperature_2m.toFixed(1)}°م` : "غير متاح";
  const feelsLike =
    current.apparent_temperature !== undefined ? `${current.apparent_temperature.toFixed(1)}°م` : "غير متاح";
  const humidity =
    current.relative_humidity_2m !== undefined ? `${current.relative_humidity_2m}%` : "غير متاح";
  const wind =
    current.wind_speed_10m !== undefined ? `${current.wind_speed_10m} كم/س` : "غير متاح";

  return {
    text:
      `الطقس الحالي في ${label}:\n` +
      `- الحالة: ${weatherText}\n` +
      `- الحرارة: ${temperature}\n` +
      `- المحسوسة: ${feelsLike}\n` +
      `- الرطوبة: ${humidity}\n` +
      `- سرعة الرياح: ${wind}`,
    metadata: {
      location: label,
      latitude: match.latitude,
      longitude: match.longitude,
    },
  };
}

interface WikipediaSearchResponse {
  query?: {
    search?: Array<{
      title: string;
      snippet: string;
      pageid: number;
    }>;
  };
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

async function searchWeb(query: string): Promise<ToolExecutionOutput> {
  const wikiUrl =
    `https://ar.wikipedia.org/w/api.php?action=query&list=search&format=json` +
    `&utf8=1&srlimit=5&origin=*&srsearch=${encodeURIComponent(query)}`;

  const wiki = await fetchJson<WikipediaSearchResponse>(wikiUrl);
  const hits = (wiki.query?.search ?? []).slice(0, 3);

  if (hits.length === 0) {
    return {
      text: `لم أجد نتائج واضحة لعبارة "${query}" في البحث السريع.`,
    };
  }

  const lines = hits.map((hit, index) => {
    const url = `https://ar.wikipedia.org/?curid=${hit.pageid}`;
    return `${index + 1}. ${hit.title}\n${stripHtml(hit.snippet)}\nالرابط: ${url}`;
  });

  return {
    text: `نتائج البحث عن "${query}":\n${lines.join("\n\n")}`,
    metadata: {
      query,
      count: hits.length,
      source: "wikipedia",
    },
  };
}

const TOOL_REGISTRY: Record<ToolName, ToolDefinition<Record<string, unknown>>> = {
  date_time: {
    name: "date_time",
    description: "إرجاع التاريخ والوقت الحاليين بشكل منسق.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    parseInput: (input) => dateTimeInputSchema.parse(input),
    execute: async () => ({ text: buildNowText() }),
  },
  weather: {
    name: "weather",
    description: "جلب حالة الطقس الحالية لمدينة محددة.",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "اسم المدينة أو الموقع المراد جلب الطقس له.",
        },
      },
      required: ["location"],
      additionalProperties: false,
    },
    parseInput: (input) => weatherInputSchema.parse(input),
    execute: async (input) => getWeatherForLocation(input.location as string),
  },
  web_search: {
    name: "web_search",
    description: "تنفيذ بحث ويب سريع وإرجاع ملخص نتائج موثوقة.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "العبارة أو السؤال المراد البحث عنه.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    parseInput: (input) => webSearchInputSchema.parse(input),
    execute: async (input) => searchWeb(input.query as string),
  },
};

export function listToolDefinitions(): Array<{
  name: ToolName;
  description: string;
  inputSchema: ToolSchema;
}> {
  return Object.values(TOOL_REGISTRY).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export function looksLikeDateTimeIntent(input: string): boolean {
  return [
    /الوقت/,
    /الساعة/,
    /التوقيت/,
    /التاريخ/,
    /اليوم/,
    /\btime\b/i,
    /\bdate\b/i,
    /\btoday\b/i,
    /\bnow\b/i,
  ].some((pattern) => pattern.test(input));
}

export function looksLikeWeatherIntent(input: string): boolean {
  return [
    /طقس/,
    /الطقس/,
    /درجة الحرارة/,
    /حرارة/,
    /weather/i,
    /forecast/i,
  ].some((pattern) => pattern.test(input));
}

export function looksLikeWebSearchIntent(input: string): boolean {
  return [
    /ابحث/,
    /بحث/,
    /معلومات عن/,
    /أخبار/,
    /news/i,
    /search/i,
    /what is/i,
    /who is/i,
  ].some((pattern) => pattern.test(input));
}

export function extractLocationFromText(input: string): string | null {
  const cleaned = input.trim();
  const patterns = [
    /(?:في|ب)\s+([^\n،,.؟!]+)/,
    /(?:طقس|weather)\s+([^\n،,.؟!]+)/i,
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
    .replace(/^(اعطني معلومات عن)/, "")
    .replace(/^(من هو|ما هو)/, "")
    .trim();

  return normalized || cleaned;
}

export async function runTool(
  name: ToolName,
  rawInput: Record<string, unknown> = {}
): Promise<ToolExecutionOutput> {
  const tool = TOOL_REGISTRY[name];
  const parsed = tool.parseInput(rawInput);
  return tool.execute(parsed);
}
