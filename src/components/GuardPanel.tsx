"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface Issue { source: "local" | "ai"; severity: "low" | "medium" | "high"; category: string; quote: string; problem: string; reference?: string }
interface Report { id: string; issues: { issues: Issue[]; dropped: number; note: string | null }; usedAi: boolean; createdAt: string }
const SEV: Record<string, string> = { high: "bg-red-100 text-red-900", medium: "bg-amber-100 text-amber-900", low: "bg-lavender text-electric-dark" };

export default function GuardPanel({ projectId, chapters, chapterId }: { projectId: string; chapters: Array<{ id: string; title: string }>; chapterId: string }) {
  const router = useRouter(), path = usePathname();
  const [report, setReport] = useState<Report | null>(null), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  useEffect(() => { fetch(`/api/chapters/${chapterId}/guard`).then((r) => r.json()).then((d) => setReport(d.report ?? null)).catch(() => {}); }, [chapterId]);

  async function run() {
    setBusy(true); setErr(""); setHidden(new Set());
    const r = await fetch(`/api/chapters/${chapterId}/guard`, { method: "POST" });
    const d = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) return setErr(d.error ?? "Something went wrong.");
    setReport(d.report);
  }
  const issues = report?.issues.issues ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-0 flex-1 text-sm font-medium sm:max-w-xs">Chapter
          <select value={chapterId} onChange={(e) => router.replace(`${path}?project=${projectId}&chapter=${e.target.value}`)} className="field mt-1">
            {chapters.map((c) => <option key={c.id} value={c.id}>{c.title || "Untitled"}</option>)}
          </select></label>
        <button className="btn btn-primary w-full sm:w-auto" onClick={run} disabled={busy}>{busy ? "Checking…" : "Check this chapter"}</button>
      </div>
      <div role="status" aria-live="polite">{err && <p role="alert" className="msg-err text-sm">{err}</p>}</div>

      {report && (
        <section aria-label="Story Guard report" className="space-y-3">
          <p className="text-sm text-muted">Checked {new Date(report.createdAt).toLocaleString()} · {report.usedAi ? "AI continuity check and local checks" : "local checks only"} · suggestions only</p>
          {report.issues.note && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{report.issues.note}</p>}
          {report.issues.dropped > 0 && <p className="text-sm text-muted">{report.issues.dropped} AI suggestion{report.issues.dropped > 1 ? "s were" : " was"} hidden because the quoted text could not be found in your chapter.</p>}
          {issues.length === 0 ? <p className="card text-center font-medium">No continuity problems found.</p> : (
            <ul className="space-y-3">
              {issues.map((i, n) => hidden.has(n) ? null : (
                <li key={n} className="card">
                  <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${SEV[i.severity]}`}>{i.severity}</span><span className="text-sm capitalize text-muted">{i.category}</span><span className="text-xs text-muted">{i.source === "ai" ? "AI" : "Local check"}</span></div>
                  <p className="mt-2 font-medium">{i.problem}</p>
                  <blockquote className="mt-2 border-l-4 border-peach pl-3 text-sm italic text-muted">{i.quote}</blockquote>
                  {i.reference && <p className="mt-2 text-sm text-muted">Compared with: {i.reference}</p>}
                  <div className="mt-3 flex gap-2">
                    <Link href={`/studio/${projectId}?chapter=${chapterId}`} className="btn btn-secondary">Open chapter</Link>
                    <button className="btn btn-secondary" onClick={() => setHidden(new Set([...hidden, n]))}>Dismiss</button>
                  </div>
                </li>))}
            </ul>)}
        </section>
      )}
    </div>
  );
}
