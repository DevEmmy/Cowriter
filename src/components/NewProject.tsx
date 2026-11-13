"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPES: Array<[string, string]> = [["novel", "Novel"], ["short_story", "Short story"], ["screenplay", "Screenplay"], ["article", "Article"], ["blog_post", "Blog post"], ["poetry", "Poetry collection"], ["custom", "Custom project"]];

export default function NewProject({ label = "Start Writing" }: { label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("novel");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const r = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, type }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? "Could not create the project."); setBusy(false); return; }
    router.push(`/studio/${d.id}?chapter=${d.chapterId}`);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-2xl bg-gradient-to-r from-electric to-coral px-6 py-3 font-semibold text-white shadow-lg shadow-electric/25 transition hover:brightness-110">{label}</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="New project" className="fixed inset-0 z-50 grid place-items-center bg-deep/50 p-4" onClick={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
          <form onSubmit={create} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-7 shadow-2xl">
            <h2 className="text-xl font-bold">New project</h2>
            <label className="block text-sm font-medium">Title
              <input autoFocus required maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-lavender bg-cream px-3.5 py-2.5 outline-none focus:border-electric" />
            </label>
            <label className="block text-sm font-medium">Type
              <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded-xl border border-lavender bg-cream px-3.5 py-2.5">
                {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-xl px-4 py-2 text-sm text-ink/70 hover:bg-lavender">Cancel</button>
              <button disabled={busy || !title.trim()} className="rounded-xl bg-electric px-5 py-2 text-sm font-semibold text-white hover:bg-electric-dark disabled:opacity-50">{busy ? "Creating…" : "Create and write"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
