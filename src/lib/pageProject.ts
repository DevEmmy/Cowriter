import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isId } from "@/lib/api";

/** Loads the user's projects and picks the requested one (or the most recent). */
export async function projectsFor(userId: string, wanted?: string) {
  const projects = await db().select({ id: schema.projects.id, title: schema.projects.title }).from(schema.projects).where(eq(schema.projects.userId, userId)).orderBy(desc(schema.projects.updatedAt));
  const current = projects.find((p) => wanted && isId(wanted) && p.id === wanted) ?? projects[0] ?? null;
  return { projects, current };
}
