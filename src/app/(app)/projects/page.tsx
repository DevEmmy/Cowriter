import { desc, eq, sql } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import NewProject from "@/components/NewProject";
import ProjectList from "@/components/ProjectList";

export const dynamic = "force-dynamic";

export default async function Projects() {
  const user = (await getUser())!;
  const rows = await db().select({
    id: schema.projects.id, title: schema.projects.title, type: schema.projects.type, favorite: schema.projects.favorite,
    archived: schema.projects.archived, updatedAt: schema.projects.updatedAt,
    words: sql<number>`coalesce((select sum(word_count) from chapters where chapters.project_id = ${schema.projects.id}),0)::int`,
    chapters: sql<number>`(select count(*) from chapters where chapters.project_id = ${schema.projects.id})::int`,
  }).from(schema.projects).where(eq(schema.projects.userId, user.id)).orderBy(desc(schema.projects.updatedAt));
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">My Projects</h1>
        <NewProject label="New project" />
      </header>
      <ProjectList projects={rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }))} />
    </div>
  );
}
