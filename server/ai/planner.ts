import {
  extractLocationFromText,
  extractSearchQuery,
  looksLikeDateTimeIntent,
  looksLikeWeatherIntent,
  looksLikeWebSearchIntent,
  type ToolName,
} from "./tools";

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
    .replace(/\s+و(?=(ابحث|search|طقس|الطقس|درجة الحرارة|الوقت|التاريخ))/gi, " ثم ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoPlanSegments(input: string): string[] {
  const normalized = normalizeForPlanning(input);
  const segments = normalized
    .split(/\s+(?:ثم|وبعد ذلك|بعدها)\s+|[،,\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return [input.trim()];
  }

  return segments;
}

function toToolStep(segment: string): Omit<PlanStep, "id"> | null {
  if (looksLikeWeatherIntent(segment)) {
    return {
      kind: "tool",
      objective: `الحصول على حالة الطقس لجزء الطلب: ${segment}`,
      toolName: "weather",
      toolInput: {
        location: extractLocationFromText(segment) ?? "الرياض",
      },
    };
  }

  if (looksLikeWebSearchIntent(segment)) {
    return {
      kind: "tool",
      objective: `تنفيذ بحث ويب لجزء الطلب: ${segment}`,
      toolName: "web_search",
      toolInput: {
        query: extractSearchQuery(segment),
      },
    };
  }

  if (looksLikeDateTimeIntent(segment)) {
    return {
      kind: "tool",
      objective: `إرجاع الوقت والتاريخ الحاليين لجزء الطلب: ${segment}`,
      toolName: "date_time",
      toolInput: {},
    };
  }

  return null;
}

export function buildExecutionPlan(content: string): ExecutionPlan {
  const segments = splitIntoPlanSegments(content);
  const steps: PlanStep[] = [];

  for (let i = 0; i < segments.length; i += 1) {
    const toolStep = toToolStep(segments[i]);
    if (toolStep) {
      steps.push({
        ...toolStep,
        id: `step-${steps.length + 1}`,
      });
    }
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
    objective: "دمج نتائج الأدوات مع السياق وإنتاج إجابة نهائية واضحة.",
  });

  return {
    isMultiStep: steps.filter((step) => step.kind === "tool").length > 1,
    steps,
  };
}
