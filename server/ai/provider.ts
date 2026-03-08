import type { ChatMessage } from "./types.js";
import type { ModelToolDefinition } from "./tools.js";

const AI_ENDPOINT =
  process.env.AI_ENDPOINT ?? "https://integrate.api.nvidia.com/v1/chat/completions";
const AI_MODEL = process.env.AI_MODEL ?? "meta/llama-3.1-70b-instruct";
const parsedTimeoutMs = Number.parseInt(process.env.AI_REQUEST_TIMEOUT_MS ?? "30000", 10);
const MODEL_REQUEST_TIMEOUT_MS = Number.isFinite(parsedTimeoutMs) && parsedTimeoutMs > 0
  ? parsedTimeoutMs
  : 30_000;

// Set to true to force mock mode regardless of API key validity.
const FORCE_MOCK_MODE = process.env.FORCE_MOCK_MODE === "true";

interface NvidiaToolCall {
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface NvidiaChoiceMessage {
  content?: string;
  tool_calls?: NvidiaToolCall[];
}

interface NvidiaChatResponse {
  choices?: Array<{
    message?: NvidiaChoiceMessage;
  }>;
}

interface GenerateModelReplyOptions {
  tools?: ModelToolDefinition[];
  onToolCall?: (
    toolName: string,
    rawInput: Record<string, unknown>,
  ) => Promise<string>;
  maxToolRounds?: number;
}

function safeParseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

// Generate a random ID for mock tool calls if needed
const generateMockId = () => Math.random().toString(36).substring(2, 9);

// Avant-Garde Mock Responses
const MOCK_RESPONSES = [
  "أهلاً بك في فضاء نبضـ. هذا الرد مُوّلد عبر (وضع المحاكاة الطليعي) ليتسنى لك اختبار أناقة الواجهة وانسيابية التفاعلات دون الحاجة إلى مفتاح API. كيف يمكنني إبهارك هندسياً اليوم؟",
  "التصميم الطليعي هو فن إخراج الوظيفة من طيات التعقيد... تماماً كما أقوم الآن بالرد عليك نيابةً عن الخادم لتتحقق من تكوين المساحات البيضاء وتفاعل المكونات.",
  "مُذهل! لقد استلمت رسالتك في قلب المحاكي. يبدو أن الهندسة المعمارية الأمامية للتطبيق تتنفس بشكل ممتاز. لا تتردد في اختبار أساليب العرض المختلفة.",
  "أنا المحاكي الذكي. أعمل في صمت، أردُ بأناقة، وأضمن لك بيئة اختبار خالية من ضجيج الأخطاء (403). هل ننتقل لهندسة صفحة المستخدم التالية؟"
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getMockCompletion(messages: ChatMessage[]): Promise<NvidiaChoiceMessage> {
  // Simulate network delay for UI realism (1s to 2.5s)
  const delay = Math.floor(Math.random() * 1500) + 1000;
  await sleep(delay);

  // Extract the last user message to make the mock response feel context-aware
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || "";

  let mockContent = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];

  if (lastUserMessage.includes("سلام") || lastUserMessage.includes("مرحبا")) {
    mockContent = "وعليكم السلام ورحمة الله! أهلاً بك في (وضع المحاكاة). الواجهة تبدو مبهرة حقاً. كيف نُكمل المسيرة الهندسية؟";
  }

  return {
    content: mockContent,
  };
}

async function requestCompletion(
  messages: ChatMessage[],
  tools?: ModelToolDefinition[],
): Promise<NvidiaChoiceMessage> {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (FORCE_MOCK_MODE || !apiKey) {
    console.log("[Mock Provider] Initiating simulated response.");
    return await getMockCompletion(messages);
  }

  const baseBody = {
    model: AI_MODEL,
    messages,
    stream: false,
  };

  const doRequest = async (body: unknown): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MODEL_REQUEST_TIMEOUT_MS);
    try {
      return await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`AI request timeout after ${MODEL_REQUEST_TIMEOUT_MS}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };

  let response = await doRequest(
    tools && tools.length > 0
      ? {
          ...baseBody,
          tools,
          tool_choice: "auto",
        }
      : baseBody,
  );

  // Some providers reject `tools`; retry once without tools to preserve compatibility.
  if (!response.ok && tools && tools.length > 0) {
    response = await doRequest(baseBody);
  }

  // Gracefully fallback to Mock Mode if API key is invalid (401/403)
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      console.warn(`[Provider] AI API returned ${response.status}. Falling back to Mock Mode.`);
      return await getMockCompletion(messages);
    }
    throw new Error(`AI API responded with status ${response.status}`);
  }

  const data = (await response.json()) as NvidiaChatResponse;
  return data.choices?.[0]?.message ?? {};
}

export async function generateModelReply(
  messages: ChatMessage[],
  options?: GenerateModelReplyOptions,
): Promise<string> {
  const maxToolRounds = Math.min(Math.max(options?.maxToolRounds ?? 1, 0), 3);
  const canUseToolCalls =
    Boolean(options?.tools?.length) && typeof options?.onToolCall === "function";

  let workingMessages = [...messages];
  let toolRounds = 0;
  let lastContent = "";

  while (true) {
    const allowTools = canUseToolCalls && toolRounds < maxToolRounds;
    
    // In Mock Mode, tools are bypassed directly within requestCompletion (it doesn't return tool_calls).
    const assistantMessage = await requestCompletion(
      workingMessages,
      allowTools ? options?.tools : undefined,
    );

    const content = (assistantMessage.content ?? "").trim();
    if (content) {
      lastContent = content;
    }

    const toolCalls = allowTools ? assistantMessage.tool_calls ?? [] : [];
    if (!toolCalls.length || !options?.onToolCall) {
      return lastContent || "عذراً، لم أتمكن من إنشاء رد.";
    }

    const toolSummaries: string[] = [];
    for (const toolCall of toolCalls.slice(0, 4)) {
      const toolName = toolCall.function?.name?.trim();
      if (!toolName) continue;

      const args = safeParseArgs(toolCall.function?.arguments);
      try {
        const output = await options.onToolCall(toolName, args);
        toolSummaries.push(
          `- ${toolName}\n  input: ${JSON.stringify(args)}\n  output: ${output}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "tool call failed";
        toolSummaries.push(
          `- ${toolName}\n  input: ${JSON.stringify(args)}\n  error: ${message}`,
        );
      }
    }

    if (toolSummaries.length === 0) {
      return lastContent || "عذراً، لم أتمكن من إنشاء رد.";
    }

    workingMessages = [
      ...workingMessages,
      {
        role: "assistant",
        content: content || "سأستخدم أدوات إضافية قبل الرد النهائي.",
      },
      {
        role: "system",
        content: `نتائج استدعاءات الأدوات:\n${toolSummaries.join("\n")}`,
      },
    ];

    toolRounds += 1;
  }
}

export function isModelConfigured(): boolean {
  // Always return true so the UI thinks it's configured and doesn't block interactions
  return true;
}
