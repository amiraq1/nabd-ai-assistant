import { z } from "zod";
import { normalizeUIComponent, type UIComponent } from "./ui-schema.js";

export const entityFieldTypeSchema = z.enum([
  "id",
  "string",
  "text",
  "number",
  "boolean",
  "dateTime",
  "json",
]);

export const endpointMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
export const entityOperationSchema = z.enum([
  "list",
  "get",
  "create",
  "update",
  "delete",
  "custom",
]);
export const pageKindSchema = z.enum([
  "dashboard",
  "list",
  "detail",
  "form",
  "auth",
  "settings",
  "marketing",
]);
export const deploymentTargetSchema = z.enum(["docker", "vercel", "netlify", "cloudflare"]);

export const entityFieldSchema = z.object({
  name: z.string().min(1),
  type: entityFieldTypeSchema,
  required: z.boolean().default(true),
  unique: z.boolean().optional(),
  primaryKey: z.boolean().optional(),
  references: z
    .object({
      entity: z.string().min(1),
      field: z.string().min(1),
    })
    .optional(),
});

export const entitySchema = z.object({
  name: z.string().min(1),
  tableName: z.string().min(1),
  description: z.string().min(1),
  fields: z.array(entityFieldSchema).min(1),
});

export const apiEndpointSchema = z.object({
  name: z.string().min(1),
  method: endpointMethodSchema,
  path: z.string().min(1),
  operation: entityOperationSchema,
  entity: z.string().min(1).optional(),
  summary: z.string().min(1),
  requestFields: z.array(z.string().min(1)).default([]),
  responseFields: z.array(z.string().min(1)).default([]),
});

export const pageSchema = z.object({
  name: z.string().min(1),
  route: z.string().min(1),
  kind: pageKindSchema,
  description: z.string().min(1),
  primaryEntity: z.string().min(1).optional(),
});

export const deploymentSchema = z.object({
  primaryTarget: deploymentTargetSchema,
  additionalTargets: z.array(deploymentTargetSchema).default([]),
  env: z.array(z.string().min(1)).default([]),
  notes: z.array(z.string().min(1)).default([]),
});

export const appBlueprintSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  frontend: z.object({
    framework: z.string().min(1),
    styling: z.string().min(1),
    queryLibrary: z.string().min(1),
  }),
  backend: z.object({
    runtime: z.string().min(1),
    framework: z.string().min(1),
    orm: z.string().min(1),
  }),
  database: z.object({
    dialect: z.string().min(1),
    migrationStrategy: z.string().min(1),
  }),
  features: z.array(z.string().min(1)).min(1),
  businessRules: z.array(z.string().min(1)).default([]),
  entities: z.array(entitySchema).min(1),
  endpoints: z.array(apiEndpointSchema).min(1),
  pages: z.array(pageSchema).min(1),
  deployment: deploymentSchema,
});

export const generatedFileSchema = z.object({
  path: z.string().min(1),
  language: z.string().min(1),
  content: z.string().min(1),
  kind: z.enum(["frontend", "backend", "database", "docs", "deployment"]),
});

export const generationDiagnosticSchema = z.object({
  filePath: z.string().min(1),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string().min(1),
});

export const generatedAppBundleSchema = z.object({
  blueprint: appBlueprintSchema,
  uiSchema: z.custom<UIComponent>((value) => normalizeUIComponent(value) !== null),
  openapi: z.record(z.any()),
  files: z.array(generatedFileSchema).min(1),
  diagnostics: z.array(generationDiagnosticSchema),
  metadata: z.object({
    usedModel: z.boolean(),
    usedFallback: z.boolean(),
    generatedAt: z.string().min(1),
  }),
});

export type EntityFieldType = z.infer<typeof entityFieldTypeSchema>;
export type EntityField = z.infer<typeof entityFieldSchema>;
export type EntityDefinition = z.infer<typeof entitySchema>;
export type ApiEndpointDefinition = z.infer<typeof apiEndpointSchema>;
export type PageDefinition = z.infer<typeof pageSchema>;
export type DeploymentDefinition = z.infer<typeof deploymentSchema>;
export type AppBlueprint = z.infer<typeof appBlueprintSchema>;
export type GeneratedFile = z.infer<typeof generatedFileSchema>;
export type GenerationDiagnostic = z.infer<typeof generationDiagnosticSchema>;
export type GeneratedAppBundle = z.infer<typeof generatedAppBundleSchema>;

export function normalizeAppBlueprint(value: unknown): AppBlueprint | null {
  const parsed = appBlueprintSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
