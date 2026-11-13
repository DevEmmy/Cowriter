import { pgTable, text, timestamp, integer, uuid, boolean, date, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  dailyGoal: integer("daily_goal").notNull().default(500),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type").notNull().default("novel"), // novel | short_story | screenplay | article | blog_post | poetry | custom
  favorite: boolean("favorite").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("projects_user_idx").on(t.userId)]);

// A chapter is the unit of writing. `kind` lets the manuscript hold parts and scenes later.
export const chapters = pgTable("chapters", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Untitled chapter"),
  position: integer("position").notNull().default(0),
  content: text("content").notNull().default(""), // HTML from the editor
  wordCount: integer("word_count").notNull().default(0),
  revision: integer("revision").notNull().default(1), // bumps on every save; used to detect stale tabs
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("chapters_project_idx").on(t.projectId, t.position)]);

export const chapterVersions = pgTable("chapter_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  wordCount: integer("word_count").notNull(),
  reason: text("reason").notNull().default("auto"), // auto | manual | before_restore
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("versions_chapter_idx").on(t.chapterId, t.createdAt)]);

// Words written per user per day (only increases count), powers goals, streaks and charts.
export const writingStats = pgTable("writing_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  words: integer("words").notNull().default(0),
}, (t) => [uniqueIndex("stats_user_day").on(t.userId, t.day)]);

// Writing voice: one global profile per user plus optional per-project overrides (scope = "global" | projectId).
export const writingProfiles = pgTable("writing_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scope: text("scope").notNull().default("global"),
  samples: text("samples").notNull().default(""),
  analysis: jsonb("analysis"), // local stats + AI-written voice summary
  instructions: text("instructions").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("profiles_user_scope").on(t.userId, t.scope)]);

// One running conversation per project.
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId: uuid("chapter_id"),
  role: text("role").notNull(), // user | assistant
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("messages_project_idx").on(t.projectId, t.createdAt)]);
