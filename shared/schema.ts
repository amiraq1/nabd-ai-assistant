import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const conversations = pgTable(
  "conversations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    title: text("title").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userCreatedAtIdx: index("conversations_user_created_idx").on(
      table.userId,
      table.createdAt,
      table.id,
    ),
  }),
);

export const messages = pgTable(
  "messages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    conversationId: varchar("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    conversationCreatedAtIdx: index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
      table.id,
    ),
  }),
);

export const projectPlatformEnum = pgEnum("project_platform", [
  "web",
  "app",
  "universal",
]);

export const libraryMaterialFormatEnum = pgEnum("library_material_format", [
  "book",
  "journal",
  "manuscript",
  "thesis",
  "dataset",
  "media",
  "archive",
  "digital_file",
]);

export const libraryAccessLevelEnum = pgEnum("library_access_level", [
  "public",
  "restricted",
  "confidential",
]);

export const libraryItemStatusEnum = pgEnum("library_item_status", [
  "available",
  "loaned",
  "reserved",
  "maintenance",
  "archived",
]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    platform: projectPlatformEnum("platform").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userCreatedAtIdx: index("projects_user_created_idx").on(
      table.userId,
      table.createdAt,
      table.id,
    ),
    userPlatformCreatedAtIdx: index("projects_user_platform_created_idx").on(
      table.userId,
      table.platform,
      table.createdAt,
      table.id,
    ),
    userNameIdx: index("projects_user_name_idx").on(table.userId, table.name),
  }),
);

export const projectScreens = pgTable(
  "project_screens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    uiSchema: jsonb("ui_schema").notNull(),
    reactCode: text("react_code").notNull().default(""),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    projectUpdatedAtIdx: index("project_screens_project_updated_idx").on(
      table.projectId,
      table.updatedAt,
      table.id,
    ),
  }),
);

export const libraryItems = pgTable(
  "library_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    creator: varchar("creator", { length: 255 }).notNull(),
    description: text("description").notNull().default(""),
    format: libraryMaterialFormatEnum("format").notNull(),
    subjectCode: varchar("subject_code", { length: 64 }).notNull(),
    subjectPath: text("subject_path").notNull(),
    classificationSystem: varchar("classification_system", { length: 16 }).notNull(),
    classificationCode: varchar("classification_code", { length: 64 }).notNull(),
    isbn: varchar("isbn", { length: 32 }),
    publisher: varchar("publisher", { length: 255 }),
    publicationYear: varchar("publication_year", { length: 16 }),
    language: varchar("language", { length: 32 }).notNull().default("en"),
    keywords: jsonb("keywords").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    accessLevel: libraryAccessLevelEnum("access_level").notNull().default("public"),
    itemStatus: libraryItemStatusEnum("item_status").notNull().default("available"),
    copiesTotal: integer("copies_total").notNull().default(1),
    copiesAvailable: integer("copies_available").notNull().default(1),
    shelfLocation: varchar("shelf_location", { length: 128 }),
    filePath: text("file_path"),
    mimeType: varchar("mime_type", { length: 128 }),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userCreatedAtIdx: index("library_items_user_created_idx").on(
      table.userId,
      table.createdAt,
      table.id,
    ),
    userSubjectIdx: index("library_items_user_subject_idx").on(
      table.userId,
      table.subjectCode,
      table.itemStatus,
    ),
    userTitleIdx: index("library_items_user_title_idx").on(table.userId, table.title),
    userCreatorIdx: index("library_items_user_creator_idx").on(table.userId, table.creator),
  }),
);

export const libraryLoans = pgTable(
  "library_loans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => libraryItems.id, { onDelete: "cascade" }),
    createdByUserId: varchar("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    borrowerName: varchar("borrower_name", { length: 255 }).notNull(),
    borrowerEmail: varchar("borrower_email", { length: 255 }),
    note: text("note").notNull().default(""),
    checkedOutAt: timestamp("checked_out_at").defaultNow().notNull(),
    dueAt: timestamp("due_at").notNull(),
    returnedAt: timestamp("returned_at"),
  },
  (table) => ({
    itemReturnedAtIdx: index("library_loans_item_returned_idx").on(
      table.itemId,
      table.returnedAt,
      table.dueAt,
      table.id,
    ),
    createdByCheckedOutIdx: index("library_loans_created_checked_out_idx").on(
      table.createdByUserId,
      table.checkedOutAt,
      table.id,
    ),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  libraryItems: many(libraryItems),
  libraryLoans: many(libraryLoans),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  screens: many(projectScreens),
}));

export const projectScreensRelations = relations(projectScreens, ({ one }) => ({
  project: one(projects, {
    fields: [projectScreens.projectId],
    references: [projects.id],
  }),
}));

export const libraryItemsRelations = relations(libraryItems, ({ one, many }) => ({
  user: one(users, {
    fields: [libraryItems.userId],
    references: [users.id],
  }),
  loans: many(libraryLoans),
}));

export const libraryLoansRelations = relations(libraryLoans, ({ one }) => ({
  item: one(libraryItems, {
    fields: [libraryLoans.itemId],
    references: [libraryItems.id],
  }),
  createdBy: one(users, {
    fields: [libraryLoans.createdByUserId],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  userId: true,
  title: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  role: true,
  content: true,
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  userId: true,
  name: true,
  platform: true,
});

export const insertProjectScreenSchema = createInsertSchema(projectScreens).pick({
  projectId: true,
  name: true,
  uiSchema: true,
  reactCode: true,
});

export const insertLibraryItemSchema = createInsertSchema(libraryItems).pick({
  userId: true,
  title: true,
  creator: true,
  description: true,
  format: true,
  subjectCode: true,
  subjectPath: true,
  classificationSystem: true,
  classificationCode: true,
  isbn: true,
  publisher: true,
  publicationYear: true,
  language: true,
  keywords: true,
  accessLevel: true,
  itemStatus: true,
  copiesTotal: true,
  copiesAvailable: true,
  shelfLocation: true,
  filePath: true,
  mimeType: true,
  metadata: true,
});

export const insertLibraryLoanSchema = createInsertSchema(libraryLoans).pick({
  itemId: true,
  createdByUserId: true,
  borrowerName: true,
  borrowerEmail: true,
  note: true,
  dueAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProjectScreen = z.infer<typeof insertProjectScreenSchema>;
export type ProjectScreen = typeof projectScreens.$inferSelect;
export type InsertLibraryItem = z.infer<typeof insertLibraryItemSchema>;
export type LibraryItem = typeof libraryItems.$inferSelect;
export type InsertLibraryLoan = z.infer<typeof insertLibraryLoanSchema>;
export type LibraryLoan = typeof libraryLoans.$inferSelect;
