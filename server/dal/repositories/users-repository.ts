import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { users, type InsertUser, type User } from "../../../shared/schema.js";
import type { DatabaseExecutor } from "../types.js";

export interface IUserRepository {
  findById(id: string): Promise<User | undefined>;
  findByUsername(username: string): Promise<User | undefined>;
  create(user: InsertUser): Promise<User>;
  ensureSessionUser(userId: string): Promise<User>;
}

export class UserRepository implements IUserRepository {
  constructor(private readonly executor: DatabaseExecutor) {}

  async findById(id: string): Promise<User | undefined> {
    const [user] = await this.executor.select().from(users).where(eq(users.id, id));
    return user;
  }

  async findByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.executor
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async create(user: InsertUser): Promise<User> {
    const [created] = await this.executor.insert(users).values(user).returning();
    return created;
  }

  async ensureSessionUser(userId: string): Promise<User> {
    const existing = await this.findById(userId);
    if (existing) {
      return existing;
    }

    const [created] = await this.executor
      .insert(users)
      .values({
        id: userId,
        username: `session_${userId}`,
        password: randomUUID(),
      })
      .onConflictDoNothing()
      .returning();

    if (created) {
      return created;
    }

    const fallback = await this.findById(userId);
    if (fallback) {
      return fallback;
    }

    throw new Error("Failed to ensure a backing user row for the active session.");
  }
}
