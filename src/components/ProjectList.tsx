"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface P { id: string; title: string; type: string; favorite: boolean; archived: boolean; updatedAt: string; words: number; chapters: number }

export default function ProjectList({ projects }: { projects: P[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"all" | "fav" | "archived">("all");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  const shown = projects.filter((p) => (tab === "archived" ? p.archived : !p.archived && (tab === "all" || p.favorite)) && p.title.toLowerCase().includes(q.toLowerCase()));

  async function patch(id: string, body: object) {
    setErr("");
    const r = await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error ?? "Could not update the project."); else router.refresh();
  }
  async function rename(p: P) {
    const t = prompt("Rename project", p.title);
    if (t && t.trim() && t !== p.title) await patch(p.id, { title: t.trim() });
  }
  async function remove(p: P) {
    const typed = prompt(`This permanently deletes "${p.title}" and all its chapters and versions.\n\nType the project title to confirm:`);
    if (typed === null) return;
    const r = await fetch(`/api/projects/${p.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmTitle: typed }) });
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error ?? "Could not delete."); else router.refresh();
  }

  const tabBtn = (k: typeof tab, l: string) => (
    <button onClick={() => setTab(k)} aria-pressed={tab === k} className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? "bg-electric text-white" : "bg-white text-ink/70 ring-1 ring-lavender hover:bg-lavender"}`}>{l}</button>
  );
  const act = "rounded-lg px-2.5 py-1 text-xs text-ink/70 hover:bg-lavender";
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {tabBtn("all", "All")}{tabBtn("fav", "Favourites")}{tabBtn("archived", "Archived")}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title" aria-label="Search projects" className="ml-auto w-full rounded-xl border border-lavender bg-white px-3.5 py-2 text-sm outline-none focus:border-electric sm:w-60" />
      </div>
      {err && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-electric/30 bg-white p-10 text-center text-ink/60">{projects.length === 0 ? "Nothing here yet. Create your first project to begin." : "No projects match."}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-lavender">
              <button onClick={() => patch(p.id, { favorite: !p.favorite })} aria-label={p.favorite ? "Remove from favourites" : "Add to favourites"} aria-pressed={p.favorite} className={`text-xl ${p.favorite ? "text-coral" : "text-ink/25 hover:text-coral"}`}>★</button>
              <Link href={`/studio/${p.id}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.title}</p>
                <p className="text-sm capitalize text-ink/60">{p.type.replace("_", " ")} · {p.chapters} chapter{p.chapters === 1 ? "" : "s"} · {p.words.toLocaleString()} words</p>
              </Link>
              <div className="flex gap-1">
                <button className={act} onClick={() => rename(p)}>Rename</button>
                <button className={act} onClick={() => patch(p.id, { archived: !p.archived })}>{p.archived ? "Restore" : "Archive"}</button>
                <button className={`${act} hover:!bg-red-50 hover:text-red-700`} onClick={() => remove(p)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
