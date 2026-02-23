import type { ChatMessage } from "./types.js";
import type { ModelToolDefinition } from "./tools.js";

const AI_ENDPOINT =
  process.env.AI_ENDPOINT ?? "https://integrate.api.nvidia.com/v1/chat/completions";
const AI_MODEL = process.env.AI_MODEL ?? "meta/llama-3.1-70b-instruct";

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

async function requestCompletion(
  messages: ChatMessage[],
  tools?: ModelToolDefinition[],
): Promise<NvidiaChoiceMessage> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not configured");
  }

  const baseBody = {
    model: AI_MODEL,
    messages,
    stream: false,
  };

  let response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(
      tools && tools.length > 0
        ? {
            ...baseBody,
            tools,
            tool_choice: "auto",
          }
        : baseBody,
    ),
  });

  // Some providers reject `tools`; retry once without tools to preserve compatibility.
  if (!response.ok && tools && tools.length > 0) {
    response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(baseBody),
    });
  }

  if (!response.ok) {
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
  return Boolean(process.env.NVIDIA_API_KEY);
}
