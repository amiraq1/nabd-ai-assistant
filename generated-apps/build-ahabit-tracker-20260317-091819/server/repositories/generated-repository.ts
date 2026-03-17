import { desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../shared/generated-schema.js";

type Database = NodePgDatabase<typeof schema>;

export class HabitRepository {
  constructor(private readonly db: Database) {}

  list(limit = 20) {
    return this.db.select().from(schema.habitsTable).orderBy(desc(schema.habitsTable.createdAt)).limit(limit);
  }

  async getById(id: string) {
    const [row] = await this.db.select().from(schema.habitsTable).where(eq(schema.habitsTable.id, id));
    return row;
  }

  async create(input: schema.InsertHabit) {
    const [row] = await this.db.insert(schema.habitsTable).values(input).returning();
    return row;
  }
}