import { desc, eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import IdeaLab from "@/components/IdeaLab";

export const dynamic = "force-dynamic";

export default async function Ideas() {
  const u = (await getUser())!;
  const projects = await db().select({ id: schema.projects.id, title: schema.projects.title }).from(schema.projects).where(eq(schema.projects.userId, u.id)).orderBy(desc(schema.projects.updatedAt));
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">Idea Lab</h1>
      <p className="mt-1 text-ink/70">Bring a rough idea. Co Writer offers suggestions you can take or leave. Your story stays yours.</p>
      <IdeaLab projects={projects} />
    </div>
  );
}
