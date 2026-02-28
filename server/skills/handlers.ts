import type { SkillExecutionOutput, SkillHandler } from "./types.js";

const REQUEST_TIMEOUT_MS = 9_000;
const DEFAULT_TIMEZONE = "Asia/Riyadh";
const DEFAULT_NEWS_TOPIC = "الذكاء الاصطناعي";

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

function toSafeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toSafeNumber(value: unknown, fallback = 1): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function formatTimeZoneCandidate(value: unknown): string {
  const candidate = toSafeString(value) ?? DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("ar-SA", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function formatNowText(timezone: string): string {
  const now = new Date();
  const date = new Intl.DateTimeFormat("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(now);
  const time = new Intl.DateTimeFormat("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(now);
  return `الوقت الحالي هو ${time}، والتاريخ ${date} (المنطقة الزمنية: ${timezone}).`;
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

async function weatherHandler(input: Record<string, unknown>): Promise<SkillExecutionOutput> {
  const location = toSafeString(input.location) ?? "الرياض";
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
      text: `تم العثور على "${match.name}" لكن بيانات الطقس غير متاحة حالياً.`,
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
    current.apparent_temperature !== undefined
      ? `${current.apparent_temperature.toFixed(1)}°م`
      : "غير متاح";
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

async function webSearchHandler(input: Record<string, unknown>): Promise<SkillExecutionOutput> {
  const query = toSafeString(input.query) ?? "الذكاء الاصطناعي";
  const wikiUrl =
    `https://ar.wikipedia.org/w/api.php?action=query&list=search&format=json` +
    `&utf8=1&srlimit=5&origin=*&srsearch=${encodeURIComponent(query)}`;
  const wiki = await fetchJson<WikipediaSearchResponse>(wikiUrl);
  const hits = (wiki.query?.search ?? []).slice(0, 3);

  if (hits.length === 0) {
    return {
      text: `لم أجد نتائج واضحة لعبارة "${query}" في البحث السريع.`,
      metadata: { query, source: "wikipedia" },
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

interface ExchangeRateHostResponse {
  result?: number;
  info?: { rate?: number };
  date?: string;
}

interface FrankfurterResponse {
  amount?: number;
  base?: string;
  date?: string;
  rates?: Record<string, number>;
}

async function exchangeRateHandler(input: Record<string, unknown>): Promise<SkillExecutionOutput> {
  const from = (toSafeString(input.from) ?? "USD").toUpperCase();
  const to = (toSafeString(input.to) ?? "SAR").toUpperCase();
  const amount = toSafeNumber(input.amount, 1);

  try {
    const primaryUrl =
      `https://api.exchangerate.host/convert?from=${encodeURIComponent(from)}` +
      `&to=${encodeURIComponent(to)}&amount=${amount}`;
    const primary = await fetchJson<ExchangeRateHostResponse>(primaryUrl);
    if (typeof primary.result === "number" && Number.isFinite(primary.result)) {
      const rate = typeof primary.info?.rate === "number" ? primary.info.rate : primary.result / amount;
      return {
        text:
          `سعر الصرف الحالي:\n` +
          `- ${amount} ${from} = ${primary.result.toFixed(4)} ${to}\n` +
          `- السعر لكل 1 ${from}: ${rate.toFixed(6)} ${to}` +
          (primary.date ? `\n- تاريخ البيانات: ${primary.date}` : ""),
        metadata: { source: "exchangerate.host", from, to, amount, result: primary.result, rate },
      };
    }
  } catch {
    // fall through to fallback provider
  }

  const fallbackUrl =
    `https://api.frankfurter.app/latest?amount=${amount}` +
    `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const fallback = await fetchJson<FrankfurterResponse>(fallbackUrl);
  const value = fallback.rates?.[to];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      text: `تعذر جلب سعر الصرف حالياً بين ${from} و${to}.`,
      metadata: { source: "frankfurter", from, to, amount },
    };
  }

  const rate = value / amount;
  return {
    text:
      `سعر الصرف الحالي:\n` +
      `- ${amount} ${from} = ${value.toFixed(4)} ${to}\n` +
      `- السعر لكل 1 ${from}: ${rate.toFixed(6)} ${to}` +
      (fallback.date ? `\n- تاريخ البيانات: ${fallback.date}` : ""),
    metadata: { source: "frankfurter", from, to, amount, result: value, rate },
  };
}

interface WorldTimeApiResponse {
  timezone?: string;
  datetime?: string;
  utc_offset?: string;
  day_of_week?: number;
}

function encodeTimeZonePath(timezone: string): string {
  return timezone
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function worldTimeHandler(input: Record<string, unknown>): Promise<SkillExecutionOutput> {
  const timezone = formatTimeZoneCandidate(input.timezone);
  const url = `https://worldtimeapi.org/api/timezone/${encodeTimeZonePath(timezone)}`;
  const response = await fetchJson<WorldTimeApiResponse>(url);
  const iso = toSafeString(response.datetime);
  if (!iso) {
    return {
      text: `تعذر جلب الوقت العالمي للمنطقة ${timezone}.`,
      metadata: { timezone, source: "worldtimeapi" },
    };
  }

  const instant = new Date(iso);
  const date = new Intl.DateTimeFormat("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(instant);
  const time = new Intl.DateTimeFormat("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(instant);

  return {
    text:
      `الوقت الحالي في ${response.timezone ?? timezone}:\n` +
      `- ${time}\n` +
      `- ${date}` +
      (response.utc_offset ? `\n- فرق التوقيت UTC: ${response.utc_offset}` : ""),
    metadata: {
      source: "worldtimeapi",
      timezone: response.timezone ?? timezone,
      dayOfWeek: response.day_of_week,
    },
  };
}

interface IpStackResponse {
  ip?: string;
  type?: string;
  continent_name?: string;
  country_name?: string;
  region_name?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  connection?: { isp?: string };
  currency?: { code?: string; name?: string };
  time_zone?: { id?: string; current_time?: string };
}

interface IpApiResponse {
  ip?: string;
  city?: string;
  region?: string;
  country_name?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  org?: string;
  currency?: string;
}

function sanitizeIpInput(value: unknown): string | null {
  const ip = toSafeString(value);
  if (!ip) return null;
  if (/^[A-Za-z0-9:.]+$/.test(ip)) return ip;
  return null;
}

async function ipGeolocationHandler(input: Record<string, unknown>): Promise<SkillExecutionOutput> {
  const ip = sanitizeIpInput(input.ip);
  const ipstackKey = toSafeString(process.env.IPSTACK_API_KEY);

  if (ipstackKey) {
    try {
      const ipstackUrl =
        `https://api.ipstack.com/${encodeURIComponent(ip ?? "check")}` +
        `?access_key=${encodeURIComponent(ipstackKey)}`;
      const data = await fetchJson<IpStackResponse>(ipstackUrl);
      if (data.country_name || data.city || data.time_zone?.id) {
        const cityRegion = [data.city, data.region_name].filter(Boolean).join("، ");
        const locationLabel = [cityRegion, data.country_name].filter(Boolean).join(" - ");
        const latLng =
          typeof data.latitude === "number" && typeof data.longitude === "number"
            ? `${data.latitude}, ${data.longitude}`
            : "غير متاح";
        return {
          text:
            `معلومات الموقع عبر IP${data.ip ? ` (${data.ip})` : ""}:\n` +
            `- الموقع: ${locationLabel || "غير متاح"}\n` +
            `- المنطقة الزمنية: ${data.time_zone?.id ?? "غير متاح"}\n` +
            `- الإحداثيات: ${latLng}\n` +
            `- مزود الخدمة: ${data.connection?.isp ?? "غير متاح"}\n` +
            `- العملة: ${data.currency?.code ?? "غير متاح"}`,
          metadata: {
            source: "ipstack",
            ip: data.ip ?? ip ?? "current",
            timezone: data.time_zone?.id,
            country: data.country_name,
          },
        };
      }
    } catch {
      // fall through to public fallback
    }
  }

  const ipapiUrl = ip
    ? `https://ipapi.co/${encodeURIComponent(ip)}/json/`
    : "https://ipapi.co/json/";
  const fallback = await fetchJson<IpApiResponse>(ipapiUrl);

  const cityRegion = [fallback.city, fallback.region].filter(Boolean).join("، ");
  const locationLabel = [cityRegion, fallback.country_name].filter(Boolean).join(" - ");
  const latLng =
    typeof fallback.latitude === "number" && typeof fallback.longitude === "number"
      ? `${fallback.latitude}, ${fallback.longitude}`
      : "غير متاح";

  return {
    text:
      `معلومات الموقع عبر IP${fallback.ip ? ` (${fallback.ip})` : ""}:\n` +
      `- الموقع: ${locationLabel || "غير متاح"}\n` +
      `- المنطقة الزمنية: ${fallback.timezone ?? "غير متاح"}\n` +
      `- الإحداثيات: ${latLng}\n` +
      `- مزود الخدمة: ${fallback.org ?? "غير متاح"}\n` +
      `- العملة: ${fallback.currency ?? "غير متاح"}`,
    metadata: {
      source: ipstackKey ? "ipapi-fallback" : "ipapi",
      ip: fallback.ip ?? ip ?? "current",
      timezone: fallback.timezone,
      country: fallback.country_name,
    },
  };
}

interface NewsApiResponse {
  articles?: Array<{
    title?: string;
    description?: string;
    url?: string;
    publishedAt?: string;
    source?: { name?: string };
  }>;
}

async function newsHeadlinesHandler(input: Record<string, unknown>): Promise<SkillExecutionOutput> {
  const apiKey = toSafeString(process.env.NEWS_API_KEY);
  const topic = toSafeString(input.topic) ?? DEFAULT_NEWS_TOPIC;
  const language = (toSafeString(input.language) ?? "ar").toLowerCase();

  if (!apiKey) {
    return {
      text:
        "مهارة الأخبار تتطلب تفعيل NEWS_API_KEY. " +
        "أضف المفتاح في ملف البيئة ثم أعد تشغيل الخادم.",
      metadata: { topic, language, configured: false },
    };
  }

  const url =
    `https://newsapi.org/v2/everything?sortBy=publishedAt&pageSize=5` +
    `&language=${encodeURIComponent(language)}&q=${encodeURIComponent(topic)}`;

  const response = await fetchJson<NewsApiResponse>(url, {
    headers: { "X-Api-Key": apiKey },
  });

  const items = (response.articles ?? []).slice(0, 4);
  if (items.length === 0) {
    return {
      text: `لا توجد عناوين أخبار متاحة حالياً حول "${topic}".`,
      metadata: { topic, language, count: 0, source: "newsapi" },
    };
  }

  const lines = items.map((item, index) => {
    const source = item.source?.name ? `(${item.source.name})` : "";
    const title = toSafeString(item.title) ?? "بدون عنوان";
    const summary = toSafeString(item.description);
    const publishedAt = toSafeString(item.publishedAt);
    const urlLine = toSafeString(item.url) ? `الرابط: ${item.url}` : "الرابط: غير متاح";
    return [
      `${index + 1}. ${title} ${source}`.trim(),
      summary ?? "بدون ملخص متاح.",
      publishedAt ? `النشر: ${publishedAt}` : null,
      urlLine,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return {
    text: `أحدث العناوين حول "${topic}":\n${lines.join("\n\n")}`,
    metadata: { topic, language, count: items.length, source: "newsapi" },
  };
}

interface RestCountry {
  name?: { common?: string; official?: string };
  capital?: string[];
  population?: number;
  region?: string;
  subregion?: string;
  languages?: Record<string, string>;
  currencies?: Record<string, { name?: string; symbol?: string }>;
}

async function restCountriesHandler(input: Record<string, unknown>): Promise<SkillExecutionOutput> {
  const country = toSafeString(input.country) ?? "";
  if (!country) {
    return { text: "الرجاء تحديد اسم الدولة المطلوب معلومات عنها." };
  }

  const url = `https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fullText=false`;
  const response = await fetchJson<RestCountry[]>(url);
  const first = response[0];
  if (!first) {
    return {
      text: `لم أجد بيانات موثوقة عن "${country}".`,
      metadata: { country, source: "restcountries" },
    };
  }

  const name = first.name?.common ?? country;
  const capital = first.capital?.[0] ?? "غير متاح";
  const population =
    typeof first.population === "number" ? first.population.toLocaleString("ar-SA") : "غير متاح";
  const region = [first.region, first.subregion].filter(Boolean).join(" / ") || "غير متاح";
  const languages = first.languages
    ? Object.values(first.languages).slice(0, 4).join("، ")
    : "غير متاح";
  const currencies = first.currencies
    ? Object.entries(first.currencies)
        .slice(0, 3)
        .map(([code, value]) => {
          const currencyName = value?.name ?? code;
          const symbol = value?.symbol ? ` (${value.symbol})` : "";
          return `${currencyName}${symbol}`;
        })
        .join("، ")
    : "غير متاح";

  return {
    text:
      `معلومات سريعة عن ${name}:\n` +
      `- العاصمة: ${capital}\n` +
      `- عدد السكان: ${population}\n` +
      `- المنطقة: ${region}\n` +
      `- اللغات: ${languages}\n` +
      `- العملة: ${currencies}`,
    metadata: { source: "restcountries", country: name },
  };
}

function formatGregorianDate(date: Date): string {
  return new Intl.DateTimeFormat("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatHijriDate(date: Date): string {
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

async function hijriCalendarHandler(input: Record<string, unknown>): Promise<SkillExecutionOutput> {
  const dateInput = toSafeString(input.date);
  const target = dateInput ? new Date(`${dateInput}T00:00:00Z`) : new Date();
  if (Number.isNaN(target.getTime())) {
    return {
      text: `صيغة التاريخ "${dateInput}" غير صحيحة. استخدم YYYY-MM-DD.`,
    };
  }

  return {
    text:
      `التاريخ الميلادي: ${formatGregorianDate(target)}\n` +
      `التاريخ الهجري: ${formatHijriDate(target)}`,
    metadata: {
      source: "intl-islamic-calendar",
      date: target.toISOString(),
    },
  };
}

const dateTimeHandler: SkillHandler = async (input) => {
  const timezone = formatTimeZoneCandidate(input.timezone);
  return {
    text: formatNowText(timezone),
    metadata: { timezone, source: "local-intl" },
  };
};

export const SKILL_HANDLERS: Record<string, SkillHandler> = {
  date_time: dateTimeHandler,
  weather: weatherHandler,
  web_search: webSearchHandler,
  exchange_rate: exchangeRateHandler,
  world_time: worldTimeHandler,
  ip_geolocation: ipGeolocationHandler,
  news_headlines: newsHeadlinesHandler,
  rest_countries: restCountriesHandler,
  hijri_calendar: hijriCalendarHandler,
};
