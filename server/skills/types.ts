export type SkillPropertyType = "string" | "number" | "boolean";

export interface SkillPropertySchema {
  type: SkillPropertyType;
  description: string;
}

export interface SkillInputSchema {
  type: "object";
  properties: Record<string, SkillPropertySchema>;
  required: string[];
  additionalProperties: boolean;
}

export type SkillPlannerExtractor =
  | "none"
  | "location"
  | "query"
  | "currency"
  | "timezone"
  | "country"
  | "news_topic"
  | "ip";

export interface SkillPlannerHints {
  keywords: string[];
  patterns?: string[];
  extractor?: SkillPlannerExtractor;
  objective?: string;
  priority?: number;
}

export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  handler: string;
  inputSchema: SkillInputSchema;
  planner?: SkillPlannerHints;
  samplePrompts?: string[];
}

export interface SkillExecutionOutput {
  text: string;
  metadata?: Record<string, unknown>;
}

export type SkillHandler = (
  input: Record<string, unknown>
) => Promise<SkillExecutionOutput>;

export interface LoadedSkill extends SkillManifest {
  format: "nabd-json" | "agent-skills";
  isExecutable: boolean;
  skillFilePath: string;
  instructions?: string;
  execute: SkillHandler;
  parseInput: (rawInput: unknown) => Record<string, unknown>;
}
