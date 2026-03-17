import { and, desc, eq, ilike, lt, or } from "drizzle-orm";
import {
  conversations,
  type Conversation,
  type InsertConversation,
} from "../../../shared/schema.js";
import {
  buildCursorPageResult,
  clampLimit,
  decodeTimestampCursor,
  type CursorPageOptions,
  type CursorPageResult,
} from "../pagination.js";
import type { DatabaseExecutor } from "../types.js";

export interface ConversationListFilters extends CursorPageOptions {
  query?: string;
}

export interface IConversationRepository {
  listByUser(
    userId: string,
    filters?: ConversationListFilters,
  ): Promise<CursorPageResult<Conversation>>;
  findByIdForUser(id: string, userId: string): Promise<Conversation | undefined>;
  create(conversation: InsertConversation): Promise<Conversation>;
  deleteByIdForUser(id: string, userId: string): Promise<boolean>;
}

export class ConversationRepository implements IConversationRepository {
  constructor(private readonly executor: DatabaseExecutor) {}

  async listByUser(
    userId: string,
    filters: ConversationListFilters = {},
  ): Promise<CursorPageResult<Conversation>> {
    const limit = clampLimit(filters.limit, 20, 100);
    const cursor = decodeTimestampCursor(filters.cursor);
    const normalizedQuery = filters.query?.trim();
    const conditions = [eq(conversations.userId, userId)];

    if (normalizedQuery) {
      conditions.push(ilike(conversations.title, `%${normalizedQuery}%`));
    }

    if (cursor) {
      conditions.push(
        or(
          lt(conversations.createdAt, cursor.createdAt),
          and(
            eq(conversations.createdAt, cursor.createdAt),
            lt(conversations.id, cursor.id),
          ),
        )!,
      );
    }

    const rows = await this.executor
      .select()
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(conversations.createdAt), desc(conversations.id))
      .limit(limit + 1);

    return buildCursorPageResult(rows, limit);
  }

  async findByIdForUser(id: string, userId: string): Promise<Conversation | undefined> {
    const [conversation] = await this.executor
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
    return conversation;
  }

  async create(conversation: InsertConversation): Promise<Conversation> {
    const [created] = await this.executor
      .insert(conversations)
      .values(conversation)
      .returning();
    return created;
  }

  async deleteByIdForUser(id: string, userId: string): Promise<boolean> {
    const [deleted] = await this.executor
      .delete(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .returning({ id: conversations.id });
    return Boolean(deleted);
  }
}
