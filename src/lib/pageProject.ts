import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isId } from "@/lib/api";

/** Loads the user's projects and picks the requested one (or the most recent). */
export async function projectsFor(userId: string, wanted?: string) {
  const projects = await db().select({ id: schema.projects.id, title: schema.projects.title }).from(schema.projects).where(eq(schema.projects.userId, userId)).orderBy(desc(schema.projects.updatedAt));
  const current = projects.find((p) => wanted && isId(wanted) && p.id === wanted) ?? projects[0] ?? null;
  return { projects, current };
}

export async function chaptersFor(userId: string, projectId: string, wanted?: string) {
  const { and, asc } = await import("drizzle-orm");
  const chapters = await db().select({ id: schema.chapters.id, title: schema.chapters.title }).from(schema.chapters).where(and(eq(schema.chapters.projectId, projectId), eq(schema.chapters.userId, userId))).orderBy(asc(schema.chapters.position));
  const current = chapters.find((c) => wanted && isId(wanted) && c.id === wanted) ?? chapters[0] ?? null;
  return { chapters, current };
}
