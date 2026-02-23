import { isModelConfigured, generateModelReply } from "./provider.js";
import { buildExecutionPlan, type ExecutionPlan } from "./planner.js";
import {
  listModelToolDefinitions,
  listToolDefinitions,
  runTool,
  type ToolExecutionOutput,
  type ToolName,
} from "./tools.js";
import { normalizeChatRole, type ChatMessage } from "./types.js";
import { retrieveKnowledgeContext, type RetrievedContext } from "../rag/retriever.js";
import { buildNabdSystemPrompt } from "./system-prompt.js";
import {
  buildAvailableSkillsXml,
  matchInstructionSkills,
} from "../skills/registry.js";

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
  historySummaryApplied: boolean;
  historyMessagesUsed: number;
  activatedInstructionSkills: string[];
}

export interface GenerateAssistantReplyResult {
  content: string;
  source: AssistantReplySource;
  trace: OrchestrationTrace;
}

const MAX_RECENT_HISTORY_TURNS = 10;
const MAX_SUMMARY_ITEMS = 12;
const MAX_SUMMARY_CHARS = 1_400;
const MAX_SKILL_INSTRUCTIONS_CHARS = 2_000;

function inferSource(
  toolRuns: ToolRunTrace[],
  plan: ExecutionPlan,
  ragContexts: RetrievedContext[],
): AssistantReplySource {
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
        `${index + 1}. [${context.title}] (${context.source})\n${context.content}`,
    )
    .join("\n\n");
}

function buildCitations(contexts: RetrievedContext[]): string {
  if (contexts.length === 0) return "";
  const lines = contexts.map(
    (context, index) => `${index + 1}. ${context.title} (${context.source})`,
  );
  return `\n\nالمراجع:\n${lines.join("\n")}`;
}

function buildLocalPlanText(userContent: string, plan: ExecutionPlan): string {
  const actionableSteps = plan.steps.filter((step) => step.kind === "tool");

  if (actionableSteps.length === 0) {
    return (
      `فهمت طلبك: "${userContent}".\n` +
      "النظام يعمل حالياً بوضع محلي محدود، وهذه خطوات تساعد للوصول لإجابة أدق:\n" +
      "1. حدّد الهدف النهائي بدقة.\n" +
      "2. أضف القيود المهمة (الوقت، الطول، الأسلوب، اللغة).\n" +
      "3. حدّد شكل المخرجات المطلوب (نقاط، جدول، كود، خطة)."
    );
  }

  return (
    `فهمت طلبك: "${userContent}".\n` +
    "هذه خطة تنفيذ مقترحة:\n" +
    actionableSteps.map((step, index) => `${index + 1}. ${step.objective}`).join("\n")
  );
}

function buildFallbackReply(
  userContent: string,
  plan: ExecutionPlan,
  toolRuns: ToolRunTrace[],
  contexts: RetrievedContext[],
  modelIssue?: string,
): string {
  const parts: string[] = [];

  if (toolRuns.length > 0) {
    const successful = toolRuns.filter((run) => run.outputText);
    if (successful.length > 0) {
      parts.push(
        `نتائج التنفيذ للطلب "${userContent}":\n` +
          successful
            .map((run) => `- [${run.toolName}] ${run.outputText ?? ""}`)
            .join("\n"),
      );
    }

    const failed = toolRuns.filter((run) => run.error);
    if (failed.length > 0) {
      parts.push(
        "ملاحظات:\n" +
          failed.map((run) => `- تعذر تنفيذ ${run.toolName}: ${run.error}`).join("\n"),
      );
    }
  }

  if (contexts.length > 0) {
    parts.push(
      "سياق معرفي مرتبط:\n" +
        contexts
          .map((context) => `- ${context.title}: ${context.content}`)
          .join("\n"),
    );
  }

  if (modelIssue) {
    parts.unshift(`تعذر استخدام مزود النموذج حالياً: ${modelIssue}`);
  }

  if (parts.length === 0) {
    return (
      buildLocalPlanText(userContent, plan) +
      "\n\nملاحظة تقنية: للحصول على إجابات نموذج كاملة، اضبط NVIDIA_API_KEY ثم أعد تشغيل الخادم."
    );
  }

  return (
    parts.join("\n\n") +
    "\n\n" +
    buildLocalPlanText(userContent, plan) +
    buildCitations(contexts)
  );
}

function summarizeConversationHistory(history: ConversationTurn[]): {
  summary: string | null;
  recentHistory: ConversationTurn[];
  historyMessagesUsed: number;
} {
  if (history.length <= MAX_RECENT_HISTORY_TURNS) {
    return {
      summary: null,
      recentHistory: history,
      historyMessagesUsed: history.length,
    };
  }

  const recentHistory = history.slice(-MAX_RECENT_HISTORY_TURNS);
  const older = history.slice(0, -MAX_RECENT_HISTORY_TURNS).slice(-MAX_SUMMARY_ITEMS);

  const summaryLines = older.map((turn, index) => {
    const roleLabel = turn.role === "assistant" ? "المساعد" : "المستخدم";
    const compact = turn.content.replace(/\s+/g, " ").trim().slice(0, 180);
    return `${index + 1}. [${roleLabel}] ${compact}`;
  });

  let summaryText =
    `ملخص ${older.length} رسالة سابقة للحفاظ على السياق:` +
    `\n${summaryLines.join("\n")}`;
  if (summaryText.length > MAX_SUMMARY_CHARS) {
    summaryText = `${summaryText.slice(0, MAX_SUMMARY_CHARS)}...`;
  }

  return {
    summary: summaryText,
    recentHistory,
    historyMessagesUsed: recentHistory.length,
  };
}

function buildTrace(
  startTimeMs: number,
  userContent: string,
  systemPromptProvided: boolean,
  modelConfigured: boolean,
  source: AssistantReplySource,
  plan: ExecutionPlan,
  toolRuns: ToolRunTrace[],
  ragContexts: RetrievedContext[],
  historySummaryApplied: boolean,
  historyMessagesUsed: number,
  activatedInstructionSkills: string[],
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
    historySummaryApplied,
    historyMessagesUsed,
    activatedInstructionSkills,
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
  input: GenerateAssistantReplyInput,
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
  const history = summarizeConversationHistory(input.history);
  const activatedInstructionSkills = matchInstructionSkills(input.content, 2);
  const availableSkillsXml = buildAvailableSkillsXml();

  const messages: ChatMessage[] = [];
  const systemInstructions: string[] = [buildNabdSystemPrompt()];
  systemInstructions.push(`Catalog of available skills:\n${availableSkillsXml}`);

  if (input.systemPrompt) {
    systemInstructions.push(`توجيه إضافي من المستخدم:\n${input.systemPrompt}`);
  }

  if (history.summary) {
    systemInstructions.push(history.summary);
  }

  systemInstructions.push(
    "إذا كانت نتائج المهارات تحتوي نقصاً أو خطأ، اذكر ذلك بوضوح وقدّم أفضل بديل عملي.",
  );
  systemInstructions.push(`المهارات المتاحة:\n${formatToolDefinitionsForPrompt()}`);

  if (activatedInstructionSkills.length > 0) {
    const instructionsBlock = activatedInstructionSkills
      .map((skill) => {
        const snippet = (skill.instructions ?? "").slice(0, MAX_SKILL_INSTRUCTIONS_CHARS);
        return `- ${skill.id}\n${snippet}`;
      })
      .join("\n\n");
    systemInstructions.push(
      `تعليمات مهارات مفعلة من SKILL.md (Agent Skills):\n${instructionsBlock}`,
    );
  }

  if (plan.steps.length > 1) {
    systemInstructions.push(
      `خطة التنفيذ الحالية:\n${plan.steps
        .map((step) => `- (${step.id}) ${step.objective}`)
        .join("\n")}`,
    );
  }

  if (toolRuns.length > 0) {
    systemInstructions.push(`نتائج المهارات المنفذة:\n${formatToolRuns(toolRuns)}`);
  }

  if (ragContexts.length > 0) {
    systemInstructions.push(
      `سياق معرفي مسترجع (RAG):\n${formatRetrievedContext(ragContexts)}`,
    );
  }

  messages.push({
    role: "system",
    content: systemInstructions.join("\n\n"),
  });

  for (const turn of history.recentHistory) {
    const role = normalizeChatRole(turn.role);
    if (!role) continue;
    messages.push({ role, content: turn.content });
  }

  messages.push({ role: "user", content: input.content });

  const modelConfigured = isModelConfigured();

  if (!modelConfigured) {
    const source = inferSource(toolRuns, plan, ragContexts);
    const content = buildFallbackReply(input.content, plan, toolRuns, ragContexts);
    const trace = buildTrace(
      startTimeMs,
      input.content,
      Boolean(input.systemPrompt),
      modelConfigured,
      source,
      plan,
      toolRuns,
      ragContexts,
      Boolean(history.summary),
      history.historyMessagesUsed,
      activatedInstructionSkills.map((skill) => skill.id),
    );
    return {
      content,
      source,
      trace,
    };
  }

  let modelContent: string;
  try {
    const modelTools = listModelToolDefinitions();
    modelContent = await generateModelReply(messages, {
      tools: modelTools,
      maxToolRounds: 2,
      onToolCall: async (toolName, rawInput) => {
        const toolStart = Date.now();
        const normalizedInput =
          rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)
            ? rawInput
            : {};

        try {
          const output = await runTool(toolName, normalizedInput);
          toolRuns.push({
            stepId: `model-tool-${toolRuns.length + 1}`,
            toolName,
            input: normalizedInput,
            outputText: output.text,
            latencyMs: Date.now() - toolStart,
          });
          return output.text;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "فشل تنفيذ مهارة عبر function calling";
          toolRuns.push({
            stepId: `model-tool-${toolRuns.length + 1}`,
            toolName,
            input: normalizedInput,
            error: message,
            latencyMs: Date.now() - toolStart,
          });
          return `تعذر تنفيذ المهارة ${toolName}: ${message}`;
        }
      },
    });
  } catch (error) {
    const modelIssue = error instanceof Error ? error.message : "خطأ غير معروف في المزود";
    const source = inferSource(toolRuns, plan, ragContexts);
    const content = buildFallbackReply(
      input.content,
      plan,
      toolRuns,
      ragContexts,
      modelIssue,
    );
    const trace = buildTrace(
      startTimeMs,
      input.content,
      Boolean(input.systemPrompt),
      modelConfigured,
      source,
      plan,
      toolRuns,
      ragContexts,
      Boolean(history.summary),
      history.historyMessagesUsed,
      activatedInstructionSkills.map((skill) => skill.id),
    );
    return {
      content,
      source,
      trace,
    };
  }

  const source = inferSource(toolRuns, plan, ragContexts);
  const content =
    ragContexts.length > 0 ? `${modelContent}${buildCitations(ragContexts)}` : modelContent;

  const trace = buildTrace(
    startTimeMs,
    input.content,
    Boolean(input.systemPrompt),
    modelConfigured,
    source,
    plan,
    toolRuns,
    ragContexts,
    Boolean(history.summary),
    history.historyMessagesUsed,
    activatedInstructionSkills.map((skill) => skill.id),
  );

  return {
    content,
    source,
    trace,
  };
}
