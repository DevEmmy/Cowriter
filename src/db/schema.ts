import { pgTable, text, timestamp, integer, uuid, boolean, date, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  dailyGoal: integer("daily_goal").notNull().default(500),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }), // sessions issued before this are signed out
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One-time links for password reset and email verification. Only a SHA-256 hash of the token is stored.
export const authTokens = pgTable("auth_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // reset | verify
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("auth_tokens_user_idx").on(t.userId, t.kind)]);

// Shared rate-limit counters. Kept in the database because serverless instances do not share memory.
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
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

// Idea Lab results. `result` is the structured AI output; `input` is the writer's original text, kept verbatim.
export const ideas = pgTable("ideas", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  kind: text("kind").notNull(), // idea | characters | plot | chapters
  input: text("input").notNull(),
  result: jsonb("result").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ideas_user_idx").on(t.userId, t.createdAt)]);

export const savedPrompts = pgTable("saved_prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("prompts_user_idx").on(t.userId, t.createdAt)]);

// Story Bible: what the writer has established. Entries are the writer's own words; AI only suggests, never writes here uninvited.
export const bibleEntries = pgTable("bible_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // character | location | timeline | rule | note
  name: text("name").notNull(),
  body: text("body").notNull().default(""),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("bible_project_idx").on(t.projectId, t.kind, t.position)]);

// Persistent manuscript memory: a summary and key facts per chapter, rebuilt only when the chapter text changes (contentHash).
export const chapterMemory = pgTable("chapter_memory", {
  chapterId: uuid("chapter_id").primaryKey().references(() => chapters.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  facts: jsonb("facts").notNull(),
  basic: boolean("basic").notNull().default(false), // true when built without AI (extract only)
  contentHash: text("content_hash").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("memory_project_idx").on(t.projectId)]);

// Story Guard results. `issues` are suggestions with a verbatim quote from the chapter; the manuscript is never edited.
export const guardReports = pgTable("guard_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId: uuid("chapter_id").references(() => chapters.id, { onDelete: "cascade" }),
  issues: jsonb("issues").notNull(),
  usedAi: boolean("used_ai").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("guard_chapter_idx").on(t.chapterId, t.createdAt)]);

// Cover Studio: saved cover designs (settings only; the artwork is rendered from them).
export const covers = pgTable("covers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  design: jsonb("design").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("covers_project_idx").on(t.projectId, t.updatedAt)]);
