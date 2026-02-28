import {
  type User,
  type InsertUser,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  users,
  conversations,
  messages,
} from "../shared/schema.js";
import { db } from "./db.js";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getConversations(userId: string): Promise<Conversation[]>;
  getConversation(id: string, userId: string): Promise<Conversation | undefined>;
  createConversation(conv: InsertConversation): Promise<Conversation>;
  deleteConversation(id: string, userId: string): Promise<boolean>;
  getMessages(conversationId: string, userId: string): Promise<Message[]>;
  createMessage(msg: InsertMessage): Promise<Message>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.createdAt));
  }

  async getConversation(id: string, userId: string): Promise<Conversation | undefined> {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
    return conv;
  }

  async createConversation(conv: InsertConversation): Promise<Conversation> {
    const [result] = await db.insert(conversations).values(conv).returning();
    return result;
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const [deletedConversation] = await db
      .delete(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .returning({ id: conversations.id });
    return Boolean(deletedConversation);
  }

  async getMessages(conversationId: string, userId: string): Promise<Message[]> {
    const [conv] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(eq(conversations.id, conversationId), eq(conversations.userId, userId)),
      );
    if (!conv) return [];

    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async createMessage(msg: InsertMessage): Promise<Message> {
    const [result] = await db.insert(messages).values(msg).returning();
    return result;
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private conversations: Map<string, Conversation> = new Map();
  private messages: Map<string, Message> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    ).filter(
      (conversation) => conversation.userId === userId,
    );
  }

  async getConversation(id: string, userId: string): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation || conversation.userId !== userId) return undefined;
    return conversation;
  }

  async createConversation(conv: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const conversation: Conversation = {
      ...conv,
      id,
      createdAt: new Date(),
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const conversation = await this.getConversation(id, userId);
    if (!conversation) return false;

    this.conversations.delete(id);
    for (const [msgId, msg] of Array.from(this.messages.entries())) {
      if (msg.conversationId === id) {
        this.messages.delete(msgId);
      }
    }
    return true;
  }

  async getMessages(conversationId: string, userId: string): Promise<Message[]> {
    const conversation = await this.getConversation(conversationId, userId);
    if (!conversation) return [];

    return Array.from(this.messages.values())
      .filter((msg) => msg.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createMessage(msg: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...msg,
      id,
      createdAt: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }
}

export const storage = process.env.DATABASE_URL
  ? new DatabaseStorage()
  : new MemStorage();
