"use client";
import { useEffect, useState } from "react";

const FIELDS: Array<[string, string, boolean]> = [
  ["context", "Story context", true], ["objective", "Scene objective", false], ["characters", "Character motivations", true], ["perspective", "Narrative perspective", false],
  ["style", "Writing style", false], ["tone", "Tone", false], ["pacing", "Pacing", false], ["description", "Descriptive expectations", true],
  ["wordCount", "Target length (words)", false], ["restrictions", "Restrictions", true], ["continuity", "Continuity requirements", true], ["ending", "Desired ending", false],
];
type Saved = { id: string; title: string; body: string };

export default function PromptTool() {
  const [f, setF] = useState<Record<string, string>>({}), [rough, setRough] = useState(""), [out, setOut] = useState(""), [title, setTitle] = useState("");
  const [msg, setMsg] = useState(""), [err, setErr] = useState(""), [saved, setSaved] = useState<Saved[]>([]), [busy, setBusy] = useState(false);

  async function load() { const r = await fetch("/api/prompts"); if (r.ok) setSaved((await r.json()).prompts); }
  useEffect(() => { load(); }, []);
  async function build(fill?: string) {
    setErr(""); setMsg(""); setBusy(true);
    const r = await fetch("/api/prompts/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: f, fill }) });
    const d = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) return setErr(d.error ?? "Something went wrong.");
    setF(d.fields); setOut(d.prompt);
  }
  async function copy() { try { await navigator.clipboard.writeText(out); setMsg("Copied."); } catch { setMsg("Select the text and copy it manually."); } }
  async function save() {
    const r = await fetch("/api/prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, body: out }) });
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error ?? "Could not save.");
    setMsg("Saved."); setTitle(""); load();
  }
  async function del(id: string) { await fetch(`/api/prompts/${id}`, { method: "DELETE" }); load(); }

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <label htmlFor="rough" className="block text-sm font-medium">Describe the scene roughly and let AI suggest the empty fields (optional)</label>
        <textarea id="rough" value={rough} onChange={(e) => setRough(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-lavender p-3" />
        <button onClick={() => build(rough)} disabled={busy || !rough.trim()} className="mt-2 rounded-full bg-lavender px-4 py-1.5 text-sm font-semibold text-electric disabled:opacity-50">Suggest fields</button>
      </section>
      <section className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2">
        {FIELDS.map(([k, label, big]) => (
          <label key={k} className={`text-sm ${big ? "sm:col-span-2" : ""}`}>{label}
            {big ? <textarea aria-label={label} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-lavender p-2" />
                 : <input aria-label={label} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="mt-1 w-full rounded-xl border border-lavender p-2" />}
          </label>))}
        <button onClick={() => build()} disabled={busy} className="rounded-full bg-electric px-5 py-2 text-sm font-semibold text-white sm:col-span-2 disabled:opacity-50">Build prompt</button>
      </section>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      {out && <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-bold">Your prompt</h2>
        <textarea aria-label="Generated prompt" value={out} onChange={(e) => setOut(e.target.value)} rows={12} className="mt-2 w-full rounded-xl border border-lavender p-3 font-mono text-sm" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={copy} className="rounded-full bg-electric px-4 py-1.5 text-sm font-semibold text-white">Copy</button>
          <input aria-label="Prompt title" placeholder="Title to save under" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl border border-lavender p-1.5 text-sm" />
          <button onClick={save} disabled={!title.trim()} className="rounded-full bg-lavender px-4 py-1.5 text-sm font-semibold text-electric disabled:opacity-50">Save</button>
          <span role="status" className="text-sm text-muted">{msg}</span>
        </div></section>}
      {saved.length > 0 && <section><h2 className="text-lg font-bold">Saved prompts</h2>
        <ul className="mt-3 space-y-2">{saved.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm">
            <button onClick={() => setOut(s.body)} className="min-w-0 flex-1 truncate text-left text-sm font-medium">{s.title}</button>
            <button onClick={() => del(s.id)} aria-label={`Delete ${s.title}`} className="text-sm text-muted hover:text-red-600">Delete</button>
          </li>))}</ul></section>}
    </div>
  );
}
