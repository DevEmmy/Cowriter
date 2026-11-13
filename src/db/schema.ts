import { pgTable, text, timestamp, integer, jsonb, uuid, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    theme: text("theme").notNull().default("professional"),
    status: text("status").notNull().default("draft"), // draft | processing | ready | failed
    // Full presentation (slides + element source refs) as JSON
    presentation: jsonb("presentation"),
    coverage: jsonb("coverage"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("projects_user_idx").on(t.userId)],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    blobKey: text("blob_key").notNull(),
    contentHash: text("content_hash").notNull(),
    // Extracted structured content units (cached; never re-extracted)
    extracted: jsonb("extracted"),
    pageCount: integer("page_count"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("documents_project_idx").on(t.projectId)],
);

// Resumable job queue: one row per pipeline stage run
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    stage: text("stage").notNull().default("extract"), // extract | plan | design | verify | done
    status: text("status").notNull().default("queued"), // queued | running | done | failed
    cursor: jsonb("cursor"), // resume point (e.g. next section index)
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    detail: text("detail"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("jobs_project_idx").on(t.projectId)],
);
