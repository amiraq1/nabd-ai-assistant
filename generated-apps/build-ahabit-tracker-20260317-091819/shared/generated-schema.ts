import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const habitsTable = pgTable("habits", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  frequency: varchar("frequency", { length: 255 }).notNull(),
  completedToday: boolean("completed_today").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHabitSchema = createInsertSchema(habitsTable);
export type InsertHabit = z.infer<typeof insertHabitSchema>;
export type Habit = typeof habitsTable.$inferSelect;