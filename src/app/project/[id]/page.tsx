import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { ownedProject } from "@/lib/projects";
import type { ExtractedDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const { id } = await params;
  const project = await ownedProject(userId, id);
  if (!project) notFound();
  const docs = await db().select().from(schema.documents).where(eq(schema.documents.projectId, id));
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900">← Dashboard</Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">{project.title}</h1>
      <p className="mt-1 text-sm capitalize text-slate-500">{project.status}</p>
      <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Content extraction is complete. Slide generation is not available yet, so this page shows what was read from your documents.</p>
      {docs.map((d) => {
        const ex = d.extracted as ExtractedDoc | null;
        const flagged = ex?.units.filter((u) => u.uncertain).length ?? 0;
        return (
          <section key={d.id} className="mt-8">
            <h2 className="font-semibold text-slate-900">{d.filename}</h2>
            <p className="text-sm text-slate-500">{ex ? `${ex.units.length} content units${flagged ? ` · ${flagged} need review` : ""}` : "Not extracted"}</p>
            {ex?.warnings.map((w) => <p key={w} className="mt-1 text-sm text-amber-700">⚠ {w}</p>)}
            <ol className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
              {ex?.units.map((u) => (
                <li key={u.id} className={`flex gap-3 px-4 py-2.5 ${u.uncertain ? "bg-amber-50" : ""}`}>
                  <span className="w-20 shrink-0 text-xs uppercase tracking-wide text-slate-400">{u.kind}{u.page ? ` · p${u.page}` : ""}</span>
                  <span className={`whitespace-pre-line ${u.kind === "heading" ? "font-semibold" : ""}`}>{u.text}</span>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </main>
  );
}
