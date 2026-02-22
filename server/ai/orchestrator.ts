import { isModelConfigured, generateModelReply } from "./provider";
import { buildExecutionPlan, type ExecutionPlan } from "./planner";
import {
  listToolDefinitions,
  runTool,
  type ToolExecutionOutput,
  type ToolName,
} from "./tools";
import { normalizeChatRole, type ChatMessage } from "./types";
import { retrieveKnowledgeContext, type RetrievedContext } from "../rag/retriever";

interface ConversationTurn {
  role: string;
  content: string;
}

interface GenerateAssistantReplyInput {
  content: string;
  systemPrompt?: string;
  history: ConversationTurn[];
}

export type AssistantReplySource = "tool" | "llm" | "rag" | "planner";

export interface ToolRunTrace {
  stepId: string;
  toolName: ToolName;
  input: Record<string, unknown>;
  outputText?: string;
  error?: string;
  latencyMs: number;
}

export interface OrchestrationTrace {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  userContent: string;
  systemPromptProvided: boolean;
  modelConfigured: boolean;
  source: AssistantReplySource;
  plan: ExecutionPlan;
  toolRuns: ToolRunTrace[];
  ragContexts: RetrievedContext[];
}

export interface GenerateAssistantReplyResult {
  content: string;
  source: AssistantReplySource;
  trace: OrchestrationTrace;
}

function inferSource(toolRuns: ToolRunTrace[], plan: ExecutionPlan, ragContexts: RetrievedContext[]): AssistantReplySource {
  if (toolRuns.length > 1 || plan.isMultiStep) return "planner";
  if (toolRuns.length === 1) return "tool";
  if (ragContexts.length > 0) return "rag";
  return "llm";
}

function formatToolDefinitionsForPrompt(): string {
  return listToolDefinitions()
    .map((tool) => {
      const schemaText = JSON.stringify(tool.inputSchema, null, 0);
      return `- ${tool.name}: ${tool.description}\n  schema: ${schemaText}`;
    })
    .join("\n");
}

function formatToolRuns(toolRuns: ToolRunTrace[]): string {
  return toolRuns
    .map((run) => {
      if (run.error) {
        return `- ${run.toolName}: فشل التنفيذ (${run.error}) (latency=${run.latencyMs}ms)`;
      }
      return (
        `- ${run.toolName}\n` +
        `  input: ${JSON.stringify(run.input)}\n` +
        `  output: ${run.outputText ?? "بدون مخرجات"}\n` +
        `  latencyMs: ${run.latencyMs}`
      );
    })
    .join("\n");
}

function formatRetrievedContext(contexts: RetrievedContext[]): string {
  return contexts
    .map(
      (context, index) =>
        `${index + 1}. [${context.title}] (${context.source})\n${context.content}`
    )
    .join("\n\n");
}

function buildCitations(contexts: RetrievedContext[]): string {
  if (contexts.length === 0) return "";
  const lines = contexts.map(
    (context, index) => `${index + 1}. ${context.title} (${context.source})`
  );
  return `\n\nالمراجع:\n${lines.join("\n")}`;
}

function buildFallbackReply(
  userContent: string,
  toolRuns: ToolRunTrace[],
  contexts: RetrievedContext[]
): string {
  const parts: string[] = [];

  if (toolRuns.length > 0) {
    const successful = toolRuns.filter((run) => run.outputText);
    if (successful.length > 0) {
      parts.push(
        `نتائج التنفيذ للطلب "${userContent}":\n` +
          successful
            .map((run) => `- [${run.toolName}] ${run.outputText ?? ""}`)
            .join("\n")
      );
    }

    const failed = toolRuns.filter((run) => run.error);
    if (failed.length > 0) {
      parts.push(
        "ملاحظات:\n" +
          failed.map((run) => `- تعذر تنفيذ ${run.toolName}: ${run.error}`).join("\n")
      );
    }
  }

  if (contexts.length > 0) {
    parts.push(
      "سياق معرفي مرتبط:\n" +
        contexts
          .map((context) => `- ${context.title}: ${context.content}`)
          .join("\n")
    );
  }

  if (parts.length === 0) {
    return "لا أستطيع توليد إجابة كاملة حالياً لأن إعدادات النموذج غير مكتملة (NVIDIA_API_KEY).";
  }

  return parts.join("\n\n") + buildCitations(contexts);
}

function buildTrace(
  startTimeMs: number,
  userContent: string,
  systemPromptProvided: boolean,
  modelConfigured: boolean,
  source: AssistantReplySource,
  plan: ExecutionPlan,
  toolRuns: ToolRunTrace[],
  ragContexts: RetrievedContext[]
): OrchestrationTrace {
  const endTimeMs = Date.now();
  return {
    startedAt: new Date(startTimeMs).toISOString(),
    finishedAt: new Date(endTimeMs).toISOString(),
    durationMs: endTimeMs - startTimeMs,
    userContent,
    systemPromptProvided,
    modelConfigured,
    source,
    plan,
    toolRuns,
    ragContexts,
  };
}

export function previewOrchestration(content: string): {
  plan: ExecutionPlan;
  ragContexts: RetrievedContext[];
  toolDefinitions: ReturnType<typeof listToolDefinitions>;
} {
  return {
    plan: buildExecutionPlan(content),
    ragContexts: retrieveKnowledgeContext(content, 3),
    toolDefinitions: listToolDefinitions(),
  };
}

export async function generateAssistantReply(
  input: GenerateAssistantReplyInput
): Promise<GenerateAssistantReplyResult> {
  const startTimeMs = Date.now();
  const plan = buildExecutionPlan(input.content);
  const toolRuns: ToolRunTrace[] = [];

  for (const step of plan.steps) {
    if (step.kind !== "tool" || !step.toolName) continue;
    const stepInput = step.toolInput ?? {};
    const toolStart = Date.now();

    try {
      const output: ToolExecutionOutput = await runTool(step.toolName, stepInput);
      toolRuns.push({
        stepId: step.id,
        toolName: step.toolName,
        input: stepInput,
        outputText: output.text,
        latencyMs: Date.now() - toolStart,
      });
    } catch (error) {
      toolRuns.push({
        stepId: step.id,
        toolName: step.toolName,
        input: stepInput,
        error: error instanceof Error ? error.message : "خطأ غير معروف",
        latencyMs: Date.now() - toolStart,
      });
    }
  }

  const ragContexts = retrieveKnowledgeContext(input.content, 3);

  const messages: ChatMessage[] = [];
  const systemInstructions: string[] = [];

  if (input.systemPrompt) {
    systemInstructions.push(input.systemPrompt);
  }

  systemInstructions.push(
    "أنت مساعد عربي دقيق. استخدم نتائج الأدوات والسياق المعرفي عند توفرهما قبل إعطاء الإجابة."
  );
  systemInstructions.push(
    "إذا كانت نتائج الأدوات تحتوي نقصاً أو خطأ، اذكر ذلك بوضوح وقدّم أفضل بديل عملي."
  );
  systemInstructions.push(`الأدوات المتاحة:\n${formatToolDefinitionsForPrompt()}`);

  if (plan.steps.length > 1) {
    systemInstructions.push(
      `خطة التنفيذ الحالية:\n${plan.steps
        .map((step) => `- (${step.id}) ${step.objective}`)
        .join("\n")}`
    );
  }

  if (toolRuns.length > 0) {
    systemInstructions.push(`نتائج الأدوات:\n${formatToolRuns(toolRuns)}`);
  }

  if (ragContexts.length > 0) {
    systemInstructions.push(
      `سياق معرفي مسترجع (RAG):\n${formatRetrievedContext(ragContexts)}`
    );
  }

  messages.push({
    role: "system",
    content: systemInstructions.join("\n\n"),
  });

  for (const turn of input.history) {
    const role = normalizeChatRole(turn.role);
    if (!role) continue;
    messages.push({ role, content: turn.content });
  }

  messages.push({ role: "user", content: input.content });

  const modelConfigured = isModelConfigured();
  const inferredSource = inferSource(toolRuns, plan, ragContexts);

  if (!modelConfigured) {
    const content = buildFallbackReply(input.content, toolRuns, ragContexts);
    const trace = buildTrace(
      startTimeMs,
      input.content,
      Boolean(input.systemPrompt),
      modelConfigured,
      inferredSource,
      plan,
      toolRuns,
      ragContexts
    );
    return {
      content,
      source: inferredSource,
      trace,
    };
  }

  const modelContent = await generateModelReply(messages);
  const content =
    ragContexts.length > 0 ? `${modelContent}${buildCitations(ragContexts)}` : modelContent;

  const trace = buildTrace(
    startTimeMs,
    input.content,
    Boolean(input.systemPrompt),
    modelConfigured,
    inferredSource,
    plan,
    toolRuns,
    ragContexts
  );

  return {
    content,
    source: inferredSource,
    trace,
  };
}
