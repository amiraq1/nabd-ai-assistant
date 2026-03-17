import fs from "fs/promises";
import path from "path";
import ts from "typescript";
import {
  appBlueprintSchema,
  generatedAppBundleSchema,
  normalizeAppBlueprint,
  type ApiEndpointDefinition,
  type AppBlueprint,
  type EntityDefinition,
  type GeneratedAppBundle,
  type GeneratedFile,
  type GenerationDiagnostic,
} from "../../shared/app-blueprint.js";
import { normalizeUIComponent, type UIComponent } from "../../shared/ui-schema.js";
import { generateModelReply } from "../ai/provider.js";
import { generateAppSchema } from "./ai-architect.js";
import { generateReactCode } from "../utils/generate-react-code.js";

const ENGINE_SYSTEM_PROMPT = `
You are a full-stack scaffold engine. Return JSON only.
Generate an app blueprint with these keys:
name, description, frontend, backend, database, features, businessRules, entities, endpoints, pages, deployment.
Use React + Tailwind + React Query on the frontend, Express + Drizzle on the backend, PostgreSQL for data, unless the prompt strongly implies otherwise.
Each entity must include fields. Each endpoint must include method, path, operation, summary, requestFields, responseFields.
`.trim();

const GENERATED_APPS_ROOT = path.resolve(process.cwd(), "generated-apps");

function cleanJson(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function timestampSlug(value = new Date()): string {
  return value.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
}

function words(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/[^A-Za-z0-9\u0600-\u06FF]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function pascal(value: string): string {
  const parts = words(value);
  return parts.length
    ? parts.map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase()).join("")
    : "GeneratedItem";
}

function camel(value: string): string {
  const label = pascal(value);
  return label[0].toLowerCase() + label.slice(1);
}

function kebab(value: string): string {
  return words(value).map((part) => part.toLowerCase()).join("-") || "generated-item";
}

function plural(value: string): string {
  if (value.endsWith("ies") || value.endsWith("s")) return value;
  if (value.endsWith("y")) return `${value.slice(0, -1)}ies`;
  return `${value}s`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function safeFilePath(targetPath: string): string {
  const normalized = targetPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Invalid generated file path: ${targetPath}`);
  }

  return segments.join("/");
}

function inferEntities(prompt: string): EntityDefinition[] {
  const normalized = prompt.toLowerCase();
  const presets: Array<{
    hit: string[];
    name: string;
    description: string;
    fields: EntityDefinition["fields"];
  }> = [
    {
      hit: ["habit", "routine", "streak"],
      name: "Habit",
      description: "Track repeated actions and completion state.",
      fields: [
        { name: "id", type: "id", required: true, primaryKey: true },
        { name: "name", type: "string", required: true },
        { name: "frequency", type: "string", required: true },
        { name: "completedToday", type: "boolean", required: true },
        { name: "createdAt", type: "dateTime", required: true },
      ],
    },
    {
      hit: ["product", "catalog", "inventory", "shop", "store"],
      name: "Product",
      description: "Catalog item or inventory record.",
      fields: [
        { name: "id", type: "id", required: true, primaryKey: true },
        { name: "name", type: "string", required: true },
        { name: "description", type: "text", required: false },
        { name: "price", type: "number", required: true },
        { name: "published", type: "boolean", required: true },
        { name: "createdAt", type: "dateTime", required: true },
      ],
    },
    {
      hit: ["invoice", "budget", "expense", "payment", "billing"],
      name: "Transaction",
      description: "Budget or billing record.",
      fields: [
        { name: "id", type: "id", required: true, primaryKey: true },
        { name: "title", type: "string", required: true },
        { name: "amount", type: "number", required: true },
        { name: "status", type: "string", required: true },
        { name: "createdAt", type: "dateTime", required: true },
      ],
    },
  ];
  const preset =
    presets.find((item) => item.hit.some((keyword) => normalized.includes(keyword))) ??
    {
      name: "Task",
      description: "Track work items inside the application.",
      fields: [
        { name: "id", type: "id", required: true, primaryKey: true },
        { name: "title", type: "string", required: true },
        { name: "description", type: "text", required: false },
        { name: "status", type: "string", required: true },
        { name: "createdAt", type: "dateTime", required: true },
      ],
    };

  return [
    {
      name: preset.name,
      tableName: kebab(plural(preset.name)).replace(/-/g, "_"),
      description: preset.description,
      fields: preset.fields,
    },
  ];
}

function inferEndpoints(entity: EntityDefinition): ApiEndpointDefinition[] {
  const name = pascal(entity.name);
  const pluralName = plural(name);
  const basePath = `/api/${kebab(pluralName)}`;
  const requestFields = entity.fields
    .filter((field) => !field.primaryKey && field.name !== "createdAt")
    .map((field) => field.name);
  const responseFields = entity.fields.map((field) => field.name);

  return [
    {
      name: `List ${pluralName}`,
      method: "GET",
      path: basePath,
      operation: "list",
      entity: name,
      summary: `List ${pluralName.toLowerCase()} with pagination and filtering.`,
      requestFields: ["limit", "cursor", "query"],
      responseFields,
    },
    {
      name: `Get ${name}`,
      method: "GET",
      path: `${basePath}/:id`,
      operation: "get",
      entity: name,
      summary: `Get one ${name.toLowerCase()} record.`,
      requestFields: ["id"],
      responseFields,
    },
    {
      name: `Create ${name}`,
      method: "POST",
      path: basePath,
      operation: "create",
      entity: name,
      summary: `Create a new ${name.toLowerCase()} record.`,
      requestFields,
      responseFields,
    },
    {
      name: `Update ${name}`,
      method: "PATCH",
      path: `${basePath}/:id`,
      operation: "update",
      entity: name,
      summary: `Update an existing ${name.toLowerCase()} record.`,
      requestFields: ["id", ...requestFields],
      responseFields,
    },
    {
      name: `Delete ${name}`,
      method: "DELETE",
      path: `${basePath}/:id`,
      operation: "delete",
      entity: name,
      summary: `Delete a ${name.toLowerCase()} record.`,
      requestFields: ["id"],
      responseFields: ["success"],
    },
  ];
}

function fallbackBlueprint(prompt: string): AppBlueprint {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  const entities = inferEntities(normalized);
  const entity = entities[0];
  return {
    name: pascal(words(normalized).slice(0, 4).join(" ")) || "GeneratedApp",
    description: normalized || "Generated full-stack application",
    frontend: {
      framework: "React",
      styling: "Tailwind CSS",
      queryLibrary: "@tanstack/react-query",
    },
    backend: {
      runtime: "Node.js",
      framework: "Express",
      orm: "Drizzle ORM",
    },
    database: {
      dialect: "PostgreSQL",
      migrationStrategy: "Tracked SQL migrations",
    },
    features: unique([
      "Responsive dashboard",
      "CRUD APIs",
      "OpenAPI documentation",
      "Docker deployment",
      /search|filter/i.test(normalized) ? "Search and filtering" : "",
    ]),
    businessRules: unique([
      "All mutations validate payloads before persistence.",
      "List endpoints support pagination and stable ordering.",
      "Audit timestamps are stored for every record.",
      /auth|login|account/i.test(normalized)
        ? "Protected write routes require authenticated access."
        : "",
    ]),
    entities,
    endpoints: inferEndpoints(entity),
    pages: [
      {
        name: "Dashboard",
        route: "/",
        kind: "dashboard",
        description: "Overview of the application state and recent records.",
        primaryEntity: entity.name,
      },
      {
        name: `${plural(entity.name)} List`,
        route: `/${kebab(plural(entity.name))}`,
        kind: "list",
        description: `List and filter ${plural(entity.name).toLowerCase()}.`,
        primaryEntity: entity.name,
      },
      {
        name: `${entity.name} Form`,
        route: `/${kebab(plural(entity.name))}/new`,
        kind: "form",
        description: `Create and edit ${entity.name.toLowerCase()} records.`,
        primaryEntity: entity.name,
      },
    ],
    deployment: {
      primaryTarget: "docker",
      additionalTargets: ["vercel"],
      env: ["DATABASE_URL", "PORT", "NODE_ENV"],
      notes: [
        "Ship the API and client in one container image.",
        "Use Vercel previews if the frontend is split from the API runtime.",
      ],
    },
  };
}

async function blueprintFromModel(
  prompt: string,
  currentBlueprint?: unknown,
): Promise<AppBlueprint | null> {
  try {
    const raw = await generateModelReply([
      { role: "system", content: ENGINE_SYSTEM_PROMPT },
      ...(currentBlueprint
        ? [
            {
              role: "system" as const,
              content: `Current blueprint JSON: ${JSON.stringify(currentBlueprint)}`,
            },
          ]
        : []),
      { role: "user", content: prompt },
    ]);
    return normalizeAppBlueprint(JSON.parse(cleanJson(raw)));
  } catch {
    return null;
  }
}

function mergeBlueprint(base: AppBlueprint, currentBlueprint?: unknown): AppBlueprint {
  const current = normalizeAppBlueprint(currentBlueprint);
  if (!current) return base;

  const entities = Array.from(
    new Map(
      [...current.entities, ...base.entities].map((entity) => [pascal(entity.name), entity]),
    ).values(),
  );
  const endpoints = Array.from(
    new Map(
      [...current.endpoints, ...base.endpoints].map((endpoint) => [
        `${endpoint.method}:${endpoint.path}`,
        endpoint,
      ]),
    ).values(),
  );
  const pages = Array.from(
    new Map([...current.pages, ...base.pages].map((page) => [page.route, page])).values(),
  );

  return appBlueprintSchema.parse({
    ...current,
    ...base,
    features: unique([...current.features, ...base.features]),
    businessRules: unique([...current.businessRules, ...base.businessRules]),
    entities,
    endpoints,
    pages,
    deployment: {
      ...current.deployment,
      ...base.deployment,
      env: unique([...current.deployment.env, ...base.deployment.env]),
      notes: unique([...current.deployment.notes, ...base.deployment.notes]),
      additionalTargets: unique([
        ...current.deployment.additionalTargets,
        ...base.deployment.additionalTargets,
      ]) as AppBlueprint["deployment"]["additionalTargets"],
    },
  });
}

function stabilizeBlueprint(blueprint: AppBlueprint): AppBlueprint {
  const entities = blueprint.entities.map((entity) => {
    const fields = Array.from(
      new Map(entity.fields.map((field) => [camel(field.name), field])).values(),
    );
    if (!fields.some((field) => field.primaryKey || camel(field.name) === "id")) {
      fields.unshift({ name: "id", type: "id", required: true, primaryKey: true });
    }
    if (!fields.some((field) => camel(field.name) === "createdAt")) {
      fields.push({ name: "createdAt", type: "dateTime", required: true });
    }

    return {
      ...entity,
      name: pascal(entity.name),
      tableName: entity.tableName || kebab(plural(entity.name)).replace(/-/g, "_"),
      fields,
    };
  });

  const ensuredEndpoints =
    blueprint.endpoints.length > 0 ? blueprint.endpoints : inferEndpoints(entities[0]);
  const ensuredPages =
    blueprint.pages.length > 0 ? blueprint.pages : fallbackBlueprint(blueprint.name).pages;

  return appBlueprintSchema.parse({
    ...blueprint,
    entities,
    endpoints: ensuredEndpoints,
    pages: ensuredPages,
  });
}

function drizzleField(field: EntityDefinition["fields"][number]): string {
  const name = camel(field.name);
  const column = kebab(field.name).replace(/-/g, "_");
  switch (field.type) {
    case "id":
      return `${name}: varchar("${column}", { length: 64 }).primaryKey()`;
    case "string":
      return `${name}: varchar("${column}", { length: 255 })${field.required ? ".notNull()" : ""}`;
    case "text":
      return `${name}: text("${column}")${field.required ? ".notNull()" : ""}`;
    case "number":
      return `${name}: integer("${column}")${field.required ? ".notNull()" : ""}`;
    case "boolean":
      return `${name}: boolean("${column}")${field.required ? ".notNull()" : ""}.default(false)`;
    case "dateTime":
      return `${name}: timestamp("${column}")${field.required ? ".notNull()" : ""}.defaultNow()`;
    case "json":
      return `${name}: jsonb("${column}")${field.required ? ".notNull()" : ""}.default(sql\`'{}'::jsonb\`)`;
  }
}

function schemaFile(blueprint: AppBlueprint): string {
  const entity = blueprint.entities[0];
  const tableConst = `${camel(plural(entity.name))}Table`;
  return [
    'import { sql } from "drizzle-orm";',
    'import { boolean, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";',
    'import { createInsertSchema } from "drizzle-zod";',
    'import { z } from "zod";',
    "",
    `export const ${tableConst} = pgTable("${entity.tableName}", {`,
    ...entity.fields.map((field) => `  ${drizzleField(field)},`),
    "});",
    "",
    `export const insert${pascal(entity.name)}Schema = createInsertSchema(${tableConst});`,
    `export type Insert${pascal(entity.name)} = z.infer<typeof insert${pascal(entity.name)}Schema>;`,
    `export type ${pascal(entity.name)} = typeof ${tableConst}.$inferSelect;`,
  ].join("\n");
}

function repositoryFile(blueprint: AppBlueprint): string {
  const entity = blueprint.entities[0];
  const entityName = pascal(entity.name);
  const tableConst = `${camel(plural(entity.name))}Table`;
  return [
    'import { desc, eq } from "drizzle-orm";',
    'import type { NodePgDatabase } from "drizzle-orm/node-postgres";',
    'import * as schema from "../../shared/generated-schema.js";',
    "",
    "type Database = NodePgDatabase<typeof schema>;",
    "",
    `export class ${entityName}Repository {`,
    "  constructor(private readonly db: Database) {}",
    "",
    "  list(limit = 20) {",
    `    return this.db.select().from(schema.${tableConst}).orderBy(desc(schema.${tableConst}.createdAt)).limit(limit);`,
    "  }",
    "",
    "  async getById(id: string) {",
    `    const [row] = await this.db.select().from(schema.${tableConst}).where(eq(schema.${tableConst}.id, id));`,
    "    return row;",
    "  }",
    "",
    `  async create(input: schema.Insert${entityName}) {`,
    `    const [row] = await this.db.insert(schema.${tableConst}).values(input).returning();`,
    "    return row;",
    "  }",
    "}",
  ].join("\n");
}

function routeFile(blueprint: AppBlueprint): string {
  const entity = blueprint.entities[0];
  const entityName = pascal(entity.name);
  const routeBase = `/api/${kebab(plural(entity.name))}`;
  return [
    'import type { Express } from "express";',
    'import { db } from "../db.js";',
    `import { ${entityName}Repository } from "../repositories/generated-repository.js";`,
    "",
    "export function registerGeneratedRoutes(app: Express): void {",
    `  const repository = new ${entityName}Repository(db);`,
    `  app.get("${routeBase}", async (req, res) => {`,
    '    const limit = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 20;',
    "    return res.json(await repository.list(Number.isFinite(limit) ? limit : 20));",
    "  });",
    `  app.get("${routeBase}/:id", async (req, res) => {`,
    "    const row = await repository.getById(req.params.id);",
    `    if (!row) return res.status(404).json({ message: "${entityName} not found" });`,
    "    return res.json(row);",
    "  });",
    `  app.post("${routeBase}", async (req, res) => res.status(201).json(await repository.create(req.body)));`,
    "}",
  ].join("\n");
}

function apiClientFile(blueprint: AppBlueprint): string {
  const entity = blueprint.entities[0];
  const entityName = pascal(entity.name);
  const routeBase = `/api/${kebab(plural(entity.name))}`;
  const fields = entity.fields
    .map((field) => {
      const typeMap: Record<string, string> = {
        id: "string",
        string: "string",
        text: "string",
        number: "number",
        boolean: "boolean",
        dateTime: "string",
        json: "Record<string, unknown>",
      };
      return `  ${camel(field.name)}${field.required ? "" : "?"}: ${typeMap[field.type]};`;
    })
    .join("\n");

  return [
    `export interface ${entityName} {`,
    fields,
    "}",
    "",
    `export interface Insert${entityName} extends Omit<${entityName}, "id"> {}`,
    "",
    `export const ${camel(plural(entity.name))}Api = {`,
    `  list: () => fetch("${routeBase}").then((response) => response.json() as Promise<${entityName}[]>),`,
    `  create: (input: Insert${entityName}) => fetch("${routeBase}", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }).then((response) => response.json() as Promise<${entityName}>),`,
    "};",
  ].join("\n");
}

function openApiDocument(blueprint: AppBlueprint): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: `${blueprint.name} API`,
      version: "1.0.0",
      description: blueprint.description,
    },
    servers: [{ url: "http://localhost:5000" }],
    paths: Object.fromEntries(
      blueprint.endpoints.map((endpoint) => [
        endpoint.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}"),
        {
          [endpoint.method.toLowerCase()]: {
            summary: endpoint.summary,
            operationId: camel(endpoint.name),
            tags: endpoint.entity ? [endpoint.entity] : ["Generated"],
            responses: { 200: { description: "Successful response" } },
          },
        },
      ]),
    ),
  };
}

async function uiSchemaFromBlueprint(blueprint: AppBlueprint): Promise<UIComponent> {
  const generated = await generateAppSchema(
    `Build the primary dashboard UI for ${blueprint.name}. ${blueprint.description}. Important features: ${blueprint.features.join(", ")}.`,
  );

  return (
    normalizeUIComponent(generated) ?? {
      type: "Container",
      style: "min-h-screen flex w-full flex-col bg-stone-950 p-6 text-white",
      children: [
        {
          type: "Container",
          style: "flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/5 p-6",
          children: [
            {
              type: "Text",
              text: blueprint.name,
              style: "text-3xl font-semibold tracking-tight text-white",
            },
            {
              type: "Text",
              text: blueprint.description,
              style: "text-sm leading-7 text-white/70",
            },
            {
              type: "Button",
              text: blueprint.pages[0]?.name ?? "Open app",
              style:
                "inline-flex w-full items-center justify-center rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-stone-950",
            },
          ],
        },
      ],
    }
  );
}

function frontendFile(blueprint: AppBlueprint, uiSchema: UIComponent): string {
  const entity = blueprint.entities[0];
  const entityName = pascal(entity.name);
  const apiName = `${camel(plural(entity.name))}Api`;
  const previewComponentCode = generateReactCode(uiSchema).replace(
    "export default function GeneratedApp()",
    "function PreviewCanvas()",
  );

  return [
    'import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";',
    `import { ${apiName} } from "./generated-api-client";`,
    "",
    previewComponentCode,
    "",
    "const queryClient = new QueryClient();",
    "",
    "function DashboardData() {",
    `  const query = useQuery({ queryKey: ["${camel(plural(entity.name))}"], queryFn: ${apiName}.list });`,
    "  return (",
    '    <section className="rounded-[28px] border border-white/10 bg-white/5 p-5">', 
    `      <h2 className="text-lg font-semibold text-white">${plural(entityName)}</h2>`,
    '      <pre className="mt-4 overflow-auto rounded-2xl bg-black/30 p-4 text-xs text-emerald-200">{JSON.stringify(query.data ?? [], null, 2)}</pre>',
    "    </section>",
    "  );",
    "}",
    "",
    "function Shell() {",
    "  return (",
    '    <div className="min-h-screen bg-stone-950 p-6 text-white">', 
    '      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">', 
    '        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6"><PreviewCanvas /></div>',
    '        <div className="space-y-6">', 
    '          <section className="rounded-[28px] border border-white/10 bg-white/5 p-5">',
    `            <h1 className="text-3xl font-semibold tracking-tight">${blueprint.name}</h1>`,
    `            <p className="mt-3 text-sm leading-7 text-white/70">${blueprint.description}</p>`,
    "          </section>",
    "          <DashboardData />",
    "        </div>",
    "      </div>",
    "    </div>",
    "  );",
    "}",
    "",
    "export default function GeneratedAppShell() {",
    "  return <QueryClientProvider client={queryClient}><Shell /></QueryClientProvider>;",
    "}",
  ].join("\n");
}

function deploymentFiles(): GeneratedFile[] {
  return [
    {
      path: "Dockerfile",
      language: "dockerfile",
      kind: "deployment",
      content: [
        "FROM node:20-alpine",
        "WORKDIR /app",
        "COPY package*.json ./",
        "RUN npm ci",
        "COPY . .",
        "RUN npm run build",
        "EXPOSE 5000",
        'CMD ["npm", "run", "start"]',
      ].join("\n"),
    },
    {
      path: "docker-compose.generated.yml",
      language: "yaml",
      kind: "deployment",
      content: [
        "services:",
        "  app:",
        "    build: .",
        '    ports: ["5000:5000"]',
        "    environment:",
        "      NODE_ENV: production",
        "      PORT: \"5000\"",
        "      DATABASE_URL: ${DATABASE_URL}",
      ].join("\n"),
    },
    {
      path: ".github/workflows/generated-app-ci.yml",
      language: "yaml",
      kind: "deployment",
      content: [
        "name: generated-app-ci",
        "on: [push, pull_request]",
        "jobs:",
        "  build:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - uses: actions/checkout@v4",
        "      - uses: actions/setup-node@v4",
        "        with:",
        "          node-version: 20",
        "          cache: npm",
        "      - run: npm ci",
        "      - run: npm run lint",
        "      - run: npm run build",
      ].join("\n"),
    },
  ];
}

function fileDiagnostics(files: GeneratedFile[]): GenerationDiagnostic[] {
  return files.flatMap((file) => {
    if (file.path.endsWith(".ts") || file.path.endsWith(".tsx")) {
      const result = ts.transpileModule(file.content, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          ...(file.path.endsWith(".tsx") ? { jsx: ts.JsxEmit.ReactJSX } : {}),
        },
        reportDiagnostics: true,
        fileName: file.path,
      });

      return (result.diagnostics ?? []).map((diagnostic) => ({
        filePath: file.path,
        severity: diagnostic.category === ts.DiagnosticCategory.Error ? "error" : "warning",
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      })) satisfies GenerationDiagnostic[];
    }

    if (file.path.endsWith(".json")) {
      try {
        JSON.parse(file.content);
        return [];
      } catch (error) {
        return [
          {
            filePath: file.path,
            severity: "error" as const,
            message: error instanceof Error ? error.message : "Invalid JSON content",
          },
        ];
      }
    }

    return [];
  });
}

export async function generateBlueprintOnly(
  prompt: string,
  currentBlueprint?: unknown,
): Promise<AppBlueprint> {
  const normalizedPrompt = prompt.replace(/\s+/g, " ").trim();
  if (!normalizedPrompt) {
    throw new Error("Prompt is required to generate a blueprint.");
  }

  const modelBlueprint = await blueprintFromModel(normalizedPrompt, currentBlueprint);
  return stabilizeBlueprint(
    mergeBlueprint(modelBlueprint ?? fallbackBlueprint(normalizedPrompt), currentBlueprint),
  );
}

export async function generateAppBundle(
  prompt: string,
  currentBlueprint?: unknown,
): Promise<GeneratedAppBundle> {
  const normalizedPrompt = prompt.replace(/\s+/g, " ").trim();
  if (!normalizedPrompt) {
    throw new Error("Prompt is required to generate an app bundle.");
  }

  const modelBlueprint = await blueprintFromModel(normalizedPrompt, currentBlueprint);
  const blueprint = stabilizeBlueprint(
    mergeBlueprint(modelBlueprint ?? fallbackBlueprint(normalizedPrompt), currentBlueprint),
  );
  const uiSchema = await uiSchemaFromBlueprint(blueprint);
  const openapi = openApiDocument(blueprint);
  const files: GeneratedFile[] = [
    {
      path: "shared/generated-schema.ts",
      language: "typescript",
      kind: "database",
      content: schemaFile(blueprint),
    },
    {
      path: "server/repositories/generated-repository.ts",
      language: "typescript",
      kind: "backend",
      content: repositoryFile(blueprint),
    },
    {
      path: "server/routes/generated-api.ts",
      language: "typescript",
      kind: "backend",
      content: routeFile(blueprint),
    },
    {
      path: "client/src/generated/generated-api-client.ts",
      language: "typescript",
      kind: "frontend",
      content: apiClientFile(blueprint),
    },
    {
      path: "client/src/generated/GeneratedApp.tsx",
      language: "typescript",
      kind: "frontend",
      content: frontendFile(blueprint, uiSchema),
    },
    {
      path: "docs/openapi.generated.json",
      language: "json",
      kind: "docs",
      content: JSON.stringify(openapi, null, 2),
    },
    ...deploymentFiles(),
  ];

  const diagnostics = fileDiagnostics(files);
  return generatedAppBundleSchema.parse({
    blueprint,
    uiSchema,
    openapi,
    files,
    diagnostics,
    metadata: {
      usedModel: Boolean(modelBlueprint),
      usedFallback: !modelBlueprint,
      generatedAt: new Date().toISOString(),
    },
  });
}

export async function materializeGeneratedApp(
  bundleInput: unknown,
): Promise<{
  rootPath: string;
  absolutePath: string;
  fileCount: number;
}> {
  const bundle = generatedAppBundleSchema.parse(bundleInput);
  const slug = kebab(bundle.blueprint.name);
  const rootPath = `/generated-apps/${slug}-${timestampSlug()}`;
  const absoluteRootPath = path.resolve(process.cwd(), `.${rootPath}`);

  if (!absoluteRootPath.startsWith(`${GENERATED_APPS_ROOT}${path.sep}`)) {
    throw new Error("Refusing to materialize outside generated-apps.");
  }

  await fs.mkdir(absoluteRootPath, { recursive: true });

  for (const file of bundle.files) {
    const relativeFilePath = safeFilePath(file.path);
    const absoluteFilePath = path.resolve(absoluteRootPath, relativeFilePath);
    if (!absoluteFilePath.startsWith(`${absoluteRootPath}${path.sep}`)) {
      throw new Error(`Refusing to write outside app root: ${file.path}`);
    }

    await fs.mkdir(path.dirname(absoluteFilePath), { recursive: true });
    await fs.writeFile(absoluteFilePath, file.content, "utf8");
  }

  return {
    rootPath,
    absolutePath: absoluteRootPath,
    fileCount: bundle.files.length,
  };
}
