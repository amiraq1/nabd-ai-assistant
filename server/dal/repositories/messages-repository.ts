import { and, asc, eq } from "drizzle-orm";
import {
  conversations,
  messages,
  type InsertMessage,
  type Message,
} from "../../../shared/schema.js";
import type { DatabaseExecutor } from "../types.js";

export interface IMessageRepository {
  listByConversationForUser(conversationId: string, userId: string): Promise<Message[]>;
  create(message: InsertMessage): Promise<Message>;
}

export class MessageRepository implements IMessageRepository {
  constructor(private readonly executor: DatabaseExecutor) {}

  async listByConversationForUser(conversationId: string, userId: string): Promise<Message[]> {
    return this.executor
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(conversations.userId, userId),
        ),
      )
      .orderBy(asc(messages.createdAt), asc(messages.id));
  }

  async create(message: InsertMessage): Promise<Message> {
    const [created] = await this.executor.insert(messages).values(message).returning();
    return created;
  }
}
