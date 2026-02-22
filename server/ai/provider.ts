import type { ChatMessage } from "./types";

const AI_ENDPOINT = process.env.AI_ENDPOINT ?? "https://integrate.api.nvidia.com/v1/chat/completions";
const AI_MODEL = process.env.AI_MODEL ?? "meta/llama-3.1-70b-instruct";

interface NvidiaChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export async function generateModelReply(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not configured");
  }

  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API responded with status ${response.status}`);
  }

  const data = (await response.json()) as NvidiaChatResponse;
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return "عذراً، لم أتمكن من إنشاء رد.";
  }

  return content;
}

export function isModelConfigured(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY);
}
