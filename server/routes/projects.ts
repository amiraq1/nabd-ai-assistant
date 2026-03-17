import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import { resolveSessionUserId } from "../auth/session-user.js";
import { dataAccess } from "../dal/index.js";
import { normalizeUIComponent } from "../../shared/ui-schema.js";
import type { Project } from "../../shared/schema.js";

const MAX_PROJECT_NAME_CHARS = 255;
const DEFAULT_SCREEN_NAME = "Main Screen";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isProjectId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function resolveRequestUserId(req: Request, res: Response): string {
  const passportUser = (req as Request & { user?: unknown }).user;

  if (typeof passportUser === "string" && passportUser.trim()) {
    return passportUser.trim();
  }

  if (
    passportUser &&
    typeof passportUser === "object" &&
    typeof (passportUser as { id?: unknown }).id === "string" &&
    (passportUser as { id: string }).id.trim()
  ) {
    return (passportUser as { id: string }).id.trim();
  }

  const bodyMockUserId =
    typeof req.body?.mockUserId === "string" ? req.body.mockUserId.trim() : "";
  if (bodyMockUserId) {
    return bodyMockUserId;
  }

  const headerMockUserId =
    typeof req.headers["x-mock-user-id"] === "string"
      ? req.headers["x-mock-user-id"].trim()
      : "";
  if (headerMockUserId) {
    return headerMockUserId;
  }

  return resolveSessionUserId(req, res);
}

export function registerProjectRoutes(app: Express): void {
  app.get("/api/projects", async (req, res) => {
    const userId = resolveRequestUserId(req, res);
    const rawLimit =
      typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
    const query = typeof req.query.query === "string" ? req.query.query.trim() : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor.trim() : undefined;
    const rawPlatform =
      typeof req.query.platform === "string" ? req.query.platform.trim() : undefined;

    const platform =
      rawPlatform === "web" || rawPlatform === "app" || rawPlatform === "universal"
        ? (rawPlatform as Project["platform"])
        : undefined;

    if (rawPlatform && !platform) {
      return res.status(400).json({ message: "platform must be web, app, or universal" });
    }

    try {
      const page = await dataAccess.projects.listProjectsForUser(userId, {
        limit: rawLimit,
        cursor,
        query,
        platform,
      });
      const items = page.items.map((project) => ({
        id: project.id,
        name: project.name,
        platform: project.platform,
        createdAt: project.createdAt,
      }));

      const shouldReturnPage =
        rawLimit !== undefined || Boolean(cursor) || Boolean(query) || Boolean(platform);
      if (shouldReturnPage) {
        return res.json({
          items,
          pageInfo: page.pageInfo,
          filters: {
            query: query ?? null,
            platform: platform ?? null,
          },
        });
      }

      return res.json(items);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to fetch projects";
      return res.status(500).json({ message });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    const userId = resolveRequestUserId(req, res);
    const projectId = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!isProjectId(projectId)) {
      return res.status(404).json({ message: "Project not found" });
    }

    try {
      const project = await dataAccess.projects.getProjectDetailForUser(userId, projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      return res.json({
        id: project.id,
        name: project.name,
        platform: project.platform,
        createdAt: project.createdAt,
        uiSchema: project.uiSchema,
      });
    } catch (error) {
      console.error(`Failed to fetch project ${projectId}:`, error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to fetch project";
      return res.status(500).json({ message });
    }
  });

  app.post("/api/projects", async (req, res) => {
    const rawName = req.body?.name;
    const rawUiSchema = req.body?.uiSchema;

    if (typeof rawName !== "string" || !rawName.trim()) {
      return res.status(400).json({ message: "name is required" });
    }

    const name = rawName.trim();
    if (name.length > MAX_PROJECT_NAME_CHARS) {
      return res.status(400).json({
        message: `name exceeds ${MAX_PROJECT_NAME_CHARS} characters`,
      });
    }

    const uiSchema = normalizeUIComponent(rawUiSchema);
    if (!uiSchema) {
      return res.status(400).json({ message: "uiSchema must be a valid UI schema object" });
    }

    const userId = resolveRequestUserId(req, res);

    try {
      const result = await dataAccess.projects.createProjectWithScreen({
        userId,
        name,
        platform: "web",
        uiSchema,
      });

      return res.status(200).json({
        ...result.project,
        screen: result.screen,
      });
    } catch (error) {
      console.error("Failed to save project:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to save project";
      return res.status(500).json({ message });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    const projectId = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!isProjectId(projectId)) {
      return res.status(404).json({ message: "Project not found" });
    }

    const rawName = req.body?.name;
    const rawUiSchema = req.body?.uiSchema;

    if (typeof rawName !== "string" || !rawName.trim()) {
      return res.status(400).json({ message: "name is required" });
    }

    const name = rawName.trim();
    if (name.length > MAX_PROJECT_NAME_CHARS) {
      return res.status(400).json({
        message: `name exceeds ${MAX_PROJECT_NAME_CHARS} characters`,
      });
    }

    const uiSchema = normalizeUIComponent(rawUiSchema);
    if (!uiSchema) {
      return res.status(400).json({ message: "uiSchema must be a valid UI schema object" });
    }

    try {
      const result = await dataAccess.projects.updateProjectWithLatestScreen({
        userId: resolveRequestUserId(req, res),
        projectId,
        name,
        uiSchema,
      });
      if (!result) {
        return res.status(404).json({ message: "Project not found" });
      }

      return res.status(200).json({
        ...result.project,
        screen: result.screen,
      });
    } catch (error) {
      console.error(`Failed to update project ${projectId}:`, error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to update project";
      return res.status(500).json({ message });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    const userId = resolveRequestUserId(req, res);
    const projectId = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!isProjectId(projectId)) {
      return res.status(404).json({ message: "Project not found" });
    }

    try {
      const deleted = await dataAccess.projects.deleteProjectForUser(userId, projectId);

      if (!deleted) {
        return res.status(404).json({ message: "Project not found" });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error(`Failed to delete project ${projectId}:`, error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to delete project";
      return res.status(500).json({ message });
    }
  });
}
