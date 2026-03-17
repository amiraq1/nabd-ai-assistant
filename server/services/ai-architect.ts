import { normalizeUIComponent, type UIComponent } from "../../shared/ui-schema.js";

export const SYSTEM_PROMPT = `
Role: You are an expert AI-Architect and Senior Frontend Developer.
Your sole purpose is to translate user requests into a strict, deeply nested JSON schema representing a user interface.

Rules & Constraints:
1. NO CHAT, NO EXPLANATIONS. Output ONLY raw, valid JSON.
2. Do not wrap the output in code fences. Start directly with { and end with }.
3. If a "Current UI Schema" is provided, treat it as the source of truth. DO NOT rewrite it from scratch unless the user explicitly asks. Locate the component they want to change, update only the necessary properties, and return the FULL updated JSON tree.
4. You must construct the UI using ONLY these components:
   - "Container"
   - "Text"
   - "Button"
   - "Input"
   - "Image"
5. Styling: Use valid standard Tailwind CSS utility classes in the "style" property.
6. Never invent fields outside this interface:
{
  "type": string,
  "style": "string",
  "text"?: "string",
  "src"?: "string",
  "placeholder"?: "string",
  "children"?: [Component]
}
7. Return the FULL JSON object every time, even if only one nested component changed.
8. Responsiveness: Assume the root Container represents a mobile app screen and should typically include classes like "min-h-screen flex w-full".
9. Translate visible UI text into the language implied by the user request.
10. For "Image", always include a realistic placeholder URL in "src".
11. Keep the structure production-oriented and visually intentional, not generic boilerplate.
`.trim();

const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
const DEFAULT_COMPATIBLE_MODEL = process.env.AI_MODEL ?? "meta/llama-3.1-70b-instruct";
const DEFAULT_COMPATIBLE_ENDPOINT =
  process.env.AI_ENDPOINT ?? "https://integrate.api.nvidia.com/v1/chat/completions";
const REQUEST_TIMEOUT_MS = resolveTimeoutMs();
const FORCE_MOCK_MODE = process.env.FORCE_MOCK_MODE === "true";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface GeminiContent {
  role: "user";
  parts: Array<{
    text: string;
  }>;
}

function resolveTimeoutMs(): number {
  const raw = Number.parseInt(
    process.env.UI_SCHEMA_TIMEOUT_MS ?? process.env.AI_REQUEST_TIMEOUT_MS ?? "30000",
    10,
  );
  return Number.isFinite(raw) && raw > 0 ? raw : 30_000;
}

function buildFallbackSchema(message?: string): UIComponent {
  return {
    type: "Container",
    style:
      "min-h-screen flex w-full items-center justify-center bg-red-50 p-6",
    children: [
      {
        type: "Container",
        style:
          "flex w-full max-w-sm flex-col gap-3 rounded-3xl border border-red-200 bg-white p-5 shadow-sm",
        children: [
          {
            type: "Text",
            text: "فشل التوليد المعماري",
            style: "text-lg font-bold text-red-700",
          },
          {
            type: "Text",
            text: message ?? "حدث خطأ غير متوقع أثناء محاولة بناء الواجهة.",
            style: "text-sm leading-6 text-red-600",
          },
        ],
      },
    ],
  };
}

function buildMockSchema(userRequest: string): UIComponent {
  const title = userRequest.replace(/\s+/g, " ").trim().slice(0, 60) || "تطبيق مُقترح (Mock)";

  return {
    type: "Container",
    style:
      "min-h-screen flex w-full flex-col bg-stone-50 p-5 text-stone-900",
    children: [
      {
        type: "Container",
        style:
          "mt-4 flex flex-col gap-3 rounded-[28px] bg-white p-5 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.22)]",
        children: [
          {
            type: "Text",
            text: title,
            style: "text-2xl font-bold tracking-tight text-stone-900",
          },
          {
            type: "Text",
            text: "هذا العرض التوضيحي يظهر لأن نموذج المهندس (Architect Model) غير متصل بخادمك حالياً.",
            style: "text-sm leading-6 text-stone-500",
          },
          {
            type: "Input",
            placeholder: "اكتب هنا...",
            style:
              "mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none",
          },
          {
            type: "Button",
            text: "استمرار",
            style:
              "mt-1 inline-flex w-full items-center justify-center rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white",
          },
        ],
      },
    ],
  };
}

function cleanJsonResponse(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseAppSchemaResponse(raw: string): UIComponent {
  let parsed: unknown;

  try {
    parsed = JSON.parse(cleanJsonResponse(raw));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parse error";
    throw new Error(`AI returned invalid JSON: ${message}`);
  }

  const normalized = normalizeUIComponent(parsed);
  if (!normalized) {
    throw new Error("AI returned JSON outside the allowed UI schema contract.");
  }

  return normalized;
}

function buildCurrentSchemaContext(currentSchema?: object): string | null {
  if (!currentSchema) {
    return null;
  }

  try {
    return `Current UI Schema: ${JSON.stringify(currentSchema)}. Use this as the source of truth. Do not rewrite it from scratch unless the user explicitly asks. Modify only the requested parts, preserve the rest, and return the full updated JSON tree.`;
  } catch {
    return "Current UI Schema is available but could not be serialized. Use it as the source of truth, modify only the requested parts, and return the full updated JSON tree.";
  }
}

function buildChatMessages(userRequest: string, currentSchema?: object): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
  const schemaContext = buildCurrentSchemaContext(currentSchema);

  if (schemaContext) {
    messages.push({ role: "system", content: schemaContext });
  }

  messages.push({ role: "user", content: userRequest });
  return messages;
}

function buildGeminiContents(userRequest: string, currentSchema?: object): GeminiContent[] {
  const contents: GeminiContent[] = [];
  const schemaContext = buildCurrentSchemaContext(currentSchema);

  if (schemaContext) {
    contents.push({
      role: "user",
      parts: [{ text: schemaContext }],
    });
  }

  contents.push({
    role: "user",
    parts: [{ text: userRequest }],
  });

  return contents;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`AI architect request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureOk(response: Response, providerName: string): Promise<void> {
  if (response.ok) {
    return;
  }

  const errorText = (await response.text()).slice(0, 600);
  throw new Error(`${providerName} request failed with ${response.status}: ${errorText}`);
}

async function requestOpenAiSchema(userRequest: string, currentSchema?: object): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const endpoint =
    process.env.OPENAI_API_ENDPOINT?.trim() ||
    "https://api.openai.com/v1/chat/completions";

  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: buildChatMessages(userRequest, currentSchema),
    }),
  });

  await ensureOk(response, "OpenAI");
  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI returned an empty schema payload.");
  }

  return content;
}

async function requestGeminiSchema(userRequest: string, currentSchema?: object): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const model = DEFAULT_GEMINI_MODEL;
  const endpoint =
    process.env.GEMINI_API_ENDPOINT?.trim() ||
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: buildGeminiContents(userRequest, currentSchema),
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  await ensureOk(response, "Gemini");
  const data = (await response.json()) as GeminiGenerateContentResponse;
  const content = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!content) {
    throw new Error("Gemini returned an empty schema payload.");
  }

  return content;
}

async function requestCompatibleSchema(userRequest: string, currentSchema?: object): Promise<string> {
  const apiKey = process.env.AI_API_KEY?.trim() || process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("No compatible AI API key is configured.");
  }

  const response = await fetchWithTimeout(DEFAULT_COMPATIBLE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_COMPATIBLE_MODEL,
      temperature: 0.2,
      stream: false,
      messages: buildChatMessages(userRequest, currentSchema),
    }),
  });

  await ensureOk(response, "Compatible");
  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Compatible provider returned an empty schema payload.");
  }

  return content;
}

function resolveProvider(): "openai" | "gemini" | "compatible" | "mock" | null {
  const explicit = process.env.UI_SCHEMA_PROVIDER?.trim().toLowerCase();
  if (
    explicit === "openai" ||
    explicit === "gemini" ||
    explicit === "compatible" ||
    explicit === "mock"
  ) {
    return explicit;
  }

  if (FORCE_MOCK_MODE) {
    return "mock";
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    return "openai";
  }

  if (process.env.GEMINI_API_KEY?.trim()) {
    return "gemini";
  }

  if (process.env.AI_API_KEY?.trim() || process.env.NVIDIA_API_KEY?.trim()) {
    return "compatible";
  }

  return null;
}

export async function generateAppSchema(
  userRequest: string,
  currentSchema?: object,
): Promise<UIComponent> {
  const normalizedRequest = userRequest.trim();
  if (!normalizedRequest) {
    return buildFallbackSchema("لا توجد تعليمات كافية لبناء الواجهة. يرجى كتابة وصف.");
  }

  try {
    const provider = resolveProvider();
    if (!provider) {
      throw new Error("لم يتم إعداد مزود نموذج الذكاء الاصطناعي (Model Provider) في بيئة الخادم.");
    }

    if (provider === "mock") {
      return buildMockSchema(normalizedRequest);
    }

    const rawContent =
      provider === "openai"
        ? await requestOpenAiSchema(normalizedRequest, currentSchema)
        : provider === "gemini"
          ? await requestGeminiSchema(normalizedRequest, currentSchema)
          : await requestCompatibleSchema(normalizedRequest, currentSchema);

    return parseAppSchemaResponse(rawContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI architect failure";
    console.error("AI Generation Error:", error);
    return buildFallbackSchema(message);
  }
}
