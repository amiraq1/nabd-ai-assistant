import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import { db } from "../db.js";
import { resolveSessionUserId } from "../auth/session-user.js";
import { hasDatabaseUrl } from "../database-url.js";
import { normalizeUIComponent } from "../../shared/ui-schema.js";
import { projectScreens, projects, users } from "../../shared/schema.js";

const MAX_PROJECT_NAME_CHARS = 255;
const DEFAULT_SCREEN_NAME = "Main Screen";

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

    if (!hasDatabaseUrl()) {
      return res.status(500).json({
        message: "DATABASE_URL is not configured. Project saving requires a PostgreSQL connection.",
      });
    }

    const userId = resolveRequestUserId(req, res);

    try {
      const result = await db.transaction(async (tx) => {
        await tx
          .insert(users)
          .values({
            id: userId,
            username: `session_${userId}_${randomUUID().slice(0, 8)}`,
            password: randomUUID(),
          })
          .onConflictDoNothing();

        const [project] = await tx
          .insert(projects)
          .values({
            userId,
            name,
            platform: "web",
          })
          .returning();

        const [screen] = await tx
          .insert(projectScreens)
          .values({
            projectId: project.id,
            name: DEFAULT_SCREEN_NAME,
            uiSchema,
            reactCode: "",
          })
          .returning();

        return {
          project,
          screen,
        };
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
}
