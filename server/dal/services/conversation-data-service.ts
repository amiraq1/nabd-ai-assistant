import type { Conversation, InsertMessage, Message } from "../../../shared/schema.js";
import { db } from "../../db.js";
import { getCacheStore, type CacheStore } from "../cache.js";
import type { CursorPageResult } from "../pagination.js";
import { createRepositories } from "../repositories/index.js";
import type { ConversationListFilters } from "../repositories/conversations-repository.js";
import { DrizzleUnitOfWork } from "../unit-of-work.js";

const CONVERSATION_LIST_TTL_SECONDS = 30;

function buildConversationListKey(userId: string, filters: ConversationListFilters): string {
  return `conversations:list:${userId}:${JSON.stringify({
    limit: filters.limit ?? null,
    cursor: filters.cursor ?? null,
    query: filters.query ?? null,
  })}`;
}

function buildConversationListPrefix(userId: string): string {
  return `conversations:list:${userId}:`;
}

export class ConversationDataService {
  private readonly repositories = createRepositories(db);
  private readonly unitOfWork = new DrizzleUnitOfWork();
  private cacheStorePromise: Promise<CacheStore> | null = null;

  private async getCache(): Promise<CacheStore> {
    if (!this.cacheStorePromise) {
      this.cacheStorePromise = getCacheStore();
    }

    return this.cacheStorePromise;
  }

  private async invalidateConversationList(userId: string): Promise<void> {
    const cache = await this.getCache();
    await cache.deleteByPrefix(buildConversationListPrefix(userId));
  }

  async listConversationsForUser(
    userId: string,
    filters: ConversationListFilters = {},
  ): Promise<CursorPageResult<Conversation>> {
    const cache = await this.getCache();
    const cacheKey = buildConversationListKey(userId, filters);
    const cached = await cache.getJson<CursorPageResult<Conversation>>(cacheKey);
    if (cached) {
      return {
        items: cached.items.map((item) => ({
          ...item,
          createdAt: new Date(item.createdAt),
        })),
        pageInfo: cached.pageInfo,
      };
    }

    const page = await this.repositories.conversations.listByUser(userId, filters);
    await cache.setJson(cacheKey, page, CONVERSATION_LIST_TTL_SECONDS);
    return page;
  }

  async getConversationForUser(id: string, userId: string): Promise<Conversation | undefined> {
    return this.repositories.conversations.findByIdForUser(id, userId);
  }

  async createConversation(userId: string, title: string): Promise<Conversation> {
    return this.unitOfWork.execute(async (uow) => {
      const conversation = await uow.conversations.create({ userId, title });
      uow.afterCommit(() => this.invalidateConversationList(userId));
      return conversation;
    });
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    return this.unitOfWork.execute(async (uow) => {
      const deleted = await uow.conversations.deleteByIdForUser(id, userId);
      if (deleted) {
        uow.afterCommit(() => this.invalidateConversationList(userId));
      }
      return deleted;
    });
  }

  async listMessagesForConversation(
    conversationId: string,
    userId: string,
  ): Promise<Message[]> {
    return this.repositories.messages.listByConversationForUser(conversationId, userId);
  }

  async createMessage(input: InsertMessage): Promise<Message> {
    return this.unitOfWork.execute(async (uow) => uow.messages.create(input));
  }
}
