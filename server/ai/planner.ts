import { matchToolForSegment, type ToolName } from "./tools.js";

export interface PlanStep {
  id: string;
  kind: "tool" | "synthesis";
  objective: string;
  toolName?: ToolName;
  toolInput?: Record<string, unknown>;
}

export interface ExecutionPlan {
  isMultiStep: boolean;
  steps: PlanStep[];
}

function normalizeForPlanning(input: string): string {
  return input
    .replace(
      /\s+و(?=(ابحث|search|طقس|الطقس|درجة الحرارة|الوقت|التاريخ|الأخبار|خبر|صرف|تحويل))/gi,
      " ثم ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoPlanSegments(input: string): string[] {
  const normalized = normalizeForPlanning(input);
  const segments = normalized
    .split(/\s+(?:ثم|وبعد ذلك|بعدها|and then|then)\s+|[،,\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return [input.trim()];
  }

  return segments;
}

function toToolStep(segment: string): Omit<PlanStep, "id"> | null {
  const match = matchToolForSegment(segment);
  if (!match) return null;

  return {
    kind: "tool",
    objective: match.objective,
    toolName: match.toolName,
    toolInput: match.toolInput,
  };
}

export function buildExecutionPlan(content: string): ExecutionPlan {
  const segments = splitIntoPlanSegments(content);
  const steps: PlanStep[] = [];

  for (const segment of segments) {
    const toolStep = toToolStep(segment);
    if (!toolStep) continue;

    steps.push({
      ...toolStep,
      id: `step-${steps.length + 1}`,
    });
  }

  if (steps.length === 0) {
    return {
      isMultiStep: false,
      steps: [
        {
          id: "step-1",
          kind: "synthesis",
          objective: "الإجابة المباشرة على طلب المستخدم عبر النموذج اللغوي.",
        },
      ],
    };
  }

  steps.push({
    id: `step-${steps.length + 1}`,
    kind: "synthesis",
    objective: "دمج نتائج المهارات مع السياق وإنتاج إجابة نهائية واضحة.",
  });

  return {
    isMultiStep: steps.filter((step) => step.kind === "tool").length > 1,
    steps,
  };
}
