import { and, asc, eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { projectsFor } from "@/lib/pageProject";
import { isId } from "@/lib/api";
import ProjectPicker from "@/components/ProjectPicker";
import GuardPanel from "@/components/GuardPanel";
import Empty from "@/components/Empty";

export const dynamic = "force-dynamic";

export default async function Guard({ searchParams }: { searchParams: Promise<{ project?: string; chapter?: string }> }) {
  const u = (await getUser())!;
  const sp = await searchParams;
  const { projects, current } = await projectsFor(u.id, sp.project);
  const chapters = current ? await db().select({ id: schema.chapters.id, title: schema.chapters.title }).from(schema.chapters).where(and(eq(schema.chapters.projectId, current.id), eq(schema.chapters.userId, u.id))).orderBy(asc(schema.chapters.position)) : [];
  const chapter = chapters.find((c) => sp.chapter && isId(sp.chapter) && c.id === sp.chapter) ?? chapters[0] ?? null;
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">Story Guard</h1>
      <p className="mt-1 text-muted">Checks a chapter against your Story Bible and earlier chapters, and flags possible continuity slips. It only suggests. It never edits your manuscript.</p>
      {!current || !chapter ? <Empty title="Nothing to check yet" hint="Create a project and write a chapter first." /> : (
        <div className="mt-5 space-y-5">
          <ProjectPicker projects={projects} value={current.id} />
          <GuardPanel key={chapter.id} projectId={current.id} chapters={chapters} chapterId={chapter.id} />
        </div>
      )}
    </div>
  );
}
