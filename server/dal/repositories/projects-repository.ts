import { and, desc, eq, ilike, lt, or } from "drizzle-orm";
import {
  projectScreens,
  projects,
  type InsertProject,
  type InsertProjectScreen,
  type Project,
  type ProjectScreen,
} from "../../../shared/schema.js";
import {
  buildCursorPageResult,
  clampLimit,
  decodeTimestampCursor,
  type CursorPageOptions,
  type CursorPageResult,
} from "../pagination.js";
import type { DatabaseExecutor } from "../types.js";

export interface ProjectListFilters extends CursorPageOptions {
  query?: string;
  platform?: Project["platform"];
}

export interface ProjectSummary {
  id: string;
  name: string;
  platform: Project["platform"];
  createdAt: Date;
}

export interface ProjectWithLatestScreen {
  project: Project;
  latestScreen: ProjectScreen | null;
}

export interface IProjectRepository {
  listAll(limit?: number): Promise<Project[]>;
  listByUser(
    userId: string,
    filters?: ProjectListFilters,
  ): Promise<CursorPageResult<ProjectSummary>>;
  findById(id: string): Promise<Project | undefined>;
  findByIdForUser(id: string, userId: string): Promise<Project | undefined>;
  findByNameForUser(userId: string, name: string): Promise<Project | undefined>;
  findWithLatestScreenByIdForUser(
    id: string,
    userId: string,
  ): Promise<ProjectWithLatestScreen | undefined>;
  create(project: InsertProject): Promise<Project>;
  updateName(id: string, name: string): Promise<Project | undefined>;
  updateNameForUser(id: string, userId: string, name: string): Promise<Project | undefined>;
  deleteById(id: string): Promise<boolean>;
  deleteByIdForUser(id: string, userId: string): Promise<boolean>;
  createScreen(screen: InsertProjectScreen): Promise<ProjectScreen>;
  findScreenById(screenId: string): Promise<ProjectScreen | undefined>;
  findLatestScreenByProject(projectId: string): Promise<ProjectScreen | undefined>;
  updateScreen(
    screenId: string,
    updates: {
      name?: string;
      uiSchema?: InsertProjectScreen["uiSchema"];
      reactCode?: string;
    },
  ): Promise<ProjectScreen | undefined>;
}

export class ProjectRepository implements IProjectRepository {
  constructor(private readonly executor: DatabaseExecutor) {}

  async listAll(limit = 100): Promise<Project[]> {
    return this.executor
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt), desc(projects.id))
      .limit(limit);
  }

  async listByUser(
    userId: string,
    filters: ProjectListFilters = {},
  ): Promise<CursorPageResult<ProjectSummary>> {
    const limit = clampLimit(filters.limit, 24, 100);
    const cursor = decodeTimestampCursor(filters.cursor);
    const normalizedQuery = filters.query?.trim();
    const conditions = [eq(projects.userId, userId)];

    if (filters.platform) {
      conditions.push(eq(projects.platform, filters.platform));
    }

    if (normalizedQuery) {
      conditions.push(ilike(projects.name, `%${normalizedQuery}%`));
    }

    if (cursor) {
      conditions.push(
        or(
          lt(projects.createdAt, cursor.createdAt),
          and(eq(projects.createdAt, cursor.createdAt), lt(projects.id, cursor.id)),
        )!,
      );
    }

    const rows = await this.executor
      .select({
        id: projects.id,
        name: projects.name,
        platform: projects.platform,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(and(...conditions))
      .orderBy(desc(projects.createdAt), desc(projects.id))
      .limit(limit + 1);

    return buildCursorPageResult(rows, limit);
  }

  async findByIdForUser(id: string, userId: string): Promise<Project | undefined> {
    const [project] = await this.executor
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)));
    return project;
  }

  async findById(id: string): Promise<Project | undefined> {
    const [project] = await this.executor
      .select()
      .from(projects)
      .where(eq(projects.id, id));
    return project;
  }

  async findByNameForUser(userId: string, name: string): Promise<Project | undefined> {
    const [project] = await this.executor
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), eq(projects.name, name)))
      .orderBy(desc(projects.createdAt), desc(projects.id));
    return project;
  }

  async findWithLatestScreenByIdForUser(
    id: string,
    userId: string,
  ): Promise<ProjectWithLatestScreen | undefined> {
    const project = await this.findByIdForUser(id, userId);
    if (!project) {
      return undefined;
    }

    return {
      project,
      latestScreen: (await this.findLatestScreenByProject(project.id)) ?? null,
    };
  }

  async create(project: InsertProject): Promise<Project> {
    const [created] = await this.executor.insert(projects).values(project).returning();
    return created;
  }

  async updateNameForUser(
    id: string,
    userId: string,
    name: string,
  ): Promise<Project | undefined> {
    const [updated] = await this.executor
      .update(projects)
      .set({ name })
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();
    return updated;
  }

  async updateName(id: string, name: string): Promise<Project | undefined> {
    const [updated] = await this.executor
      .update(projects)
      .set({ name })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async deleteById(id: string): Promise<boolean> {
    const [deleted] = await this.executor
      .delete(projects)
      .where(eq(projects.id, id))
      .returning({ id: projects.id });
    return Boolean(deleted);
  }

  async deleteByIdForUser(id: string, userId: string): Promise<boolean> {
    const [deleted] = await this.executor
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning({ id: projects.id });
    return Boolean(deleted);
  }

  async createScreen(screen: InsertProjectScreen): Promise<ProjectScreen> {
    const [created] = await this.executor
      .insert(projectScreens)
      .values(screen)
      .returning();
    return created;
  }

  async findScreenById(screenId: string): Promise<ProjectScreen | undefined> {
    const [screen] = await this.executor
      .select()
      .from(projectScreens)
      .where(eq(projectScreens.id, screenId));
    return screen;
  }

  async findLatestScreenByProject(projectId: string): Promise<ProjectScreen | undefined> {
    const [screen] = await this.executor
      .select()
      .from(projectScreens)
      .where(eq(projectScreens.projectId, projectId))
      .orderBy(desc(projectScreens.updatedAt), desc(projectScreens.id));
    return screen;
  }

  async updateScreen(
    screenId: string,
    updates: {
      name?: string;
      uiSchema?: InsertProjectScreen["uiSchema"];
      reactCode?: string;
    },
  ): Promise<ProjectScreen | undefined> {
    const [updated] = await this.executor
      .update(projectScreens)
      .set({
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.uiSchema !== undefined ? { uiSchema: updates.uiSchema } : {}),
        ...(updates.reactCode !== undefined ? { reactCode: updates.reactCode } : {}),
        updatedAt: new Date(),
      })
      .where(eq(projectScreens.id, screenId))
      .returning();

    return updated;
  }
}
