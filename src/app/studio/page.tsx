import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

/** "Writing Studio" and "Talk to Co Writer" jump straight back into the most recently edited chapter. */
export default async function Latest({ searchParams }: { searchParams: Promise<{ ai?: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const { ai } = await searchParams;
  const [c] = await db().select({ id: schema.chapters.id, projectId: schema.chapters.projectId }).from(schema.chapters).where(eq(schema.chapters.userId, userId)).orderBy(desc(schema.chapters.updatedAt)).limit(1);
  if (!c) redirect("/projects");
  redirect(`/studio/${c.projectId}?chapter=${c.id}${ai === "1" ? "&ai=1" : ""}`);
}
