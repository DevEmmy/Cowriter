import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import Empty from "@/components/Empty";

export const dynamic = "force-dynamic";

export default async function Library({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const u = (await getUser())!;
  const focus = (await searchParams).project;
  const rows = await db().select({ id: schema.projects.id, title: schema.projects.title, type: schema.projects.type, archived: schema.projects.archived, updatedAt: schema.projects.updatedAt, words: sql<number>`coalesce(sum(${schema.chapters.wordCount}),0)::int`, chapters: sql<number>`count(${schema.chapters.id})::int` })
    .from(schema.projects).leftJoin(schema.chapters, eq(schema.chapters.projectId, schema.projects.id)).where(and(eq(schema.projects.userId, u.id))).groupBy(schema.projects.id).orderBy(sql`${schema.projects.updatedAt} desc`);
  const fmt: Array<[string, string]> = [["docx", "Word (.docx)"], ["pdf", "PDF"], ["txt", "Plain text"]];
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">My Library</h1>
      <p className="mt-1 text-muted">Download any manuscript as a Word document, a print-ready 6 × 9 inch PDF, or plain text. Chapters stay in order.</p>
      {rows.length === 0 ? <Empty title="Your library is empty" hint="Write a project and it will appear here, ready to export." /> : (
        <ul className="mt-5 space-y-3">{rows.map((p) => (
          <li key={p.id} className={`card ${focus === p.id ? "ring-2 ring-electric" : ""}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2"><div className="min-w-0"><Link href={`/studio/${p.id}`} className="text-lg font-semibold hover:underline">{p.title}</Link>{p.archived && <span className="ml-2 text-xs text-muted">archived</span>}</div>
              <p className="text-sm text-muted">{p.words.toLocaleString()} words · {p.chapters} chapter{p.chapters === 1 ? "" : "s"}</p></div>
            {p.words > 0 ? <div className="mt-3 grid gap-2 sm:grid-cols-3">{fmt.map(([f, l]) => <a key={f} href={`/api/projects/${p.id}/export?format=${f}`} download className="btn btn-secondary">Download {l}</a>)}</div>
              : <p className="mt-2 text-sm text-muted">Nothing written yet.</p>}
          </li>))}</ul>)}
    </div>
  );
}
