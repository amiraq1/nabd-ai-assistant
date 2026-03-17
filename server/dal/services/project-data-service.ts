import type {
  InsertProjectScreen,
  Project,
  ProjectScreen,
} from "../../../shared/schema.js";
import { db } from "../../db.js";
import { getCacheStore, type CacheStore } from "../cache.js";
import {
  type CursorPageResult,
} from "../pagination.js";
import {
  createRepositories,
} from "../repositories/index.js";
import {
  type ProjectListFilters,
  type ProjectSummary,
} from "../repositories/projects-repository.js";
import { DrizzleUnitOfWork } from "../unit-of-work.js";

const PROJECT_LIST_TTL_SECONDS = 45;
const PROJECT_DETAIL_TTL_SECONDS = 45;
const DEFAULT_SCREEN_NAME = "Main Screen";

export interface ProjectDetailRecord {
  id: string;
  name: string;
  platform: Project["platform"];
  createdAt: Date;
  uiSchema: ProjectScreen["uiSchema"] | null;
  screen: ProjectScreen | null;
}

export interface CreateProjectInput {
  userId: string;
  name: string;
  platform: Project["platform"];
  uiSchema: InsertProjectScreen["uiSchema"];
  screenName?: string;
}

export interface UpdateProjectInput {
  userId: string;
  projectId: string;
  name: string;
  uiSchema: InsertProjectScreen["uiSchema"];
  screenName?: string;
}

export interface EnsureProjectInput {
  userId: string;
  name: string;
  platform: Project["platform"];
}

export interface ProjectWriteResult {
  project: Project;
  screen: ProjectScreen;
}

function buildProjectListCacheKey(userId: string, filters: ProjectListFilters): string {
  return `projects:list:${userId}:${JSON.stringify({
    limit: filters.limit ?? null,
    cursor: filters.cursor ?? null,
    query: filters.query ?? null,
    platform: filters.platform ?? null,
  })}`;
}

function buildProjectDetailCacheKey(userId: string, projectId: string): string {
  return `projects:detail:${userId}:${projectId}`;
}

function buildProjectPrefix(userId: string): string {
  return `projects:list:${userId}:`;
}

export class ProjectDataService {
  private readonly unitOfWork = new DrizzleUnitOfWork();
  private readonly repositories = createRepositories(db);
  private cacheStorePromise: Promise<CacheStore> | null = null;

  private async getCache(): Promise<CacheStore> {
    if (!this.cacheStorePromise) {
      this.cacheStorePromise = getCacheStore();
    }

    return this.cacheStorePromise;
  }

  private async invalidateProjectCaches(userId: string, projectId?: string): Promise<void> {
    const cache = await this.getCache();
    await cache.deleteByPrefix(buildProjectPrefix(userId));

    if (projectId) {
      await cache.delete(buildProjectDetailCacheKey(userId, projectId));
    }
  }

  async listProjectsForUser(
    userId: string,
    filters: ProjectListFilters = {},
  ): Promise<CursorPageResult<ProjectSummary>> {
    const cache = await this.getCache();
    const cacheKey = buildProjectListCacheKey(userId, filters);
    const cached = await cache.getJson<CursorPageResult<ProjectSummary>>(cacheKey);
    if (cached) {
      return {
        items: cached.items.map((item) => ({
          ...item,
          createdAt: new Date(item.createdAt),
        })),
        pageInfo: cached.pageInfo,
      };
    }

    const page = await this.repositories.projects.listByUser(userId, filters);
    await cache.setJson(cacheKey, page, PROJECT_LIST_TTL_SECONDS);
    return page;
  }

  async getProjectDetailForUser(
    userId: string,
    projectId: string,
  ): Promise<ProjectDetailRecord | undefined> {
    const cache = await this.getCache();
    const cacheKey = buildProjectDetailCacheKey(userId, projectId);
    const cached = await cache.getJson<ProjectDetailRecord>(cacheKey);
    if (cached) {
      return {
        ...cached,
        createdAt: new Date(cached.createdAt),
        screen: cached.screen
          ? {
              ...cached.screen,
              updatedAt: new Date(cached.screen.updatedAt),
            }
          : null,
      };
    }

    const record = await this.repositories.projects.findWithLatestScreenByIdForUser(
      projectId,
      userId,
    );
    if (!record) {
      return undefined;
    }

    const detail: ProjectDetailRecord = {
      id: record.project.id,
      name: record.project.name,
      platform: record.project.platform,
      createdAt: record.project.createdAt,
      uiSchema: record.latestScreen?.uiSchema ?? null,
      screen: record.latestScreen,
    };

    await cache.setJson(cacheKey, detail, PROJECT_DETAIL_TTL_SECONDS);
    return detail;
  }

  async createProjectWithScreen(input: CreateProjectInput): Promise<ProjectWriteResult> {
    return this.unitOfWork.execute(async (uow) => {
      const ensuredUser = await uow.users.ensureSessionUser(input.userId);
      const project = await uow.projects.create({
        userId: ensuredUser.id,
        name: input.name,
        platform: input.platform,
      });
      const screen = await uow.projects.createScreen({
        projectId: project.id,
        name: input.screenName?.trim() || DEFAULT_SCREEN_NAME,
        uiSchema: input.uiSchema,
        reactCode: "",
      });

      uow.afterCommit(() => this.invalidateProjectCaches(ensuredUser.id, project.id));
      return { project, screen };
    });
  }

  async updateProjectWithLatestScreen(input: UpdateProjectInput): Promise<ProjectWriteResult | undefined> {
    return this.unitOfWork.execute(async (uow) => {
      const project = await uow.projects.findByIdForUser(input.projectId, input.userId);
      if (!project) {
        return undefined;
      }

      const updatedProject =
        (await uow.projects.updateNameForUser(project.id, input.userId, input.name)) ?? project;
      const latestScreen = await uow.projects.findLatestScreenByProject(project.id);
      const screen = latestScreen
        ? await uow.projects.updateScreen(latestScreen.id, {
            name: input.screenName?.trim() || DEFAULT_SCREEN_NAME,
            uiSchema: input.uiSchema,
          })
        : await uow.projects.createScreen({
            projectId: project.id,
            name: input.screenName?.trim() || DEFAULT_SCREEN_NAME,
            uiSchema: input.uiSchema,
            reactCode: "",
          });

      if (!screen) {
        throw new Error("Failed to persist the latest project screen.");
      }

      uow.afterCommit(() => this.invalidateProjectCaches(input.userId, project.id));
      return {
        project: updatedProject,
        screen,
      };
    });
  }

  async deleteProjectForUser(userId: string, projectId: string): Promise<boolean> {
    return this.unitOfWork.execute(async (uow) => {
      const deleted = await uow.projects.deleteByIdForUser(projectId, userId);
      if (deleted) {
        uow.afterCommit(() => this.invalidateProjectCaches(userId, projectId));
      }
      return deleted;
    });
  }

  async ensureNamedProject(input: EnsureProjectInput): Promise<Project> {
    return this.unitOfWork.execute(async (uow) => {
      const ensuredUser = await uow.users.ensureSessionUser(input.userId);
      const existing = await uow.projects.findByNameForUser(ensuredUser.id, input.name);
      if (existing) {
        return existing;
      }

      const project = await uow.projects.create({
        userId: ensuredUser.id,
        name: input.name,
        platform: input.platform,
      });
      uow.afterCommit(() => this.invalidateProjectCaches(ensuredUser.id, project.id));
      return project;
    });
  }
}
