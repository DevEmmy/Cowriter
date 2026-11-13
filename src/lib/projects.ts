import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/** Returns the project only if it belongs to this user. */
export async function ownedProject(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [p] = await db().select().from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId))).limit(1);
  return p ?? null;
}
