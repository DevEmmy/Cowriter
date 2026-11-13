"use client";
import { useCallback, useEffect, useState } from "react";

type Entry = { id: string; kind: string; name: string; body: string };
type Sug = { kind: string; name: string; body: string };
type Mem = { id: string; title: string; wordCount: number; state: "missing" | "stale" | "current"; basic: boolean; summary: string; facts: string[] };
const KINDS: Array<[string, string, string]> = [["character", "Characters", "Name, age, looks, motives, relationships"], ["location", "Locations", "Places and what they are like"], ["timeline", "Timeline", "Events in the order they happen"], ["rule", "World rules", "Things that must always stay true"], ["note", "Notes", "Anything else worth remembering"]];

async function api(url: string, method = "GET", body?: unknown) {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? "Something went wrong.");
  return d;
}

export default function BibleManager({ projectId }: { projectId: string }) {
  const [kind, setKind] = useState("character");
  const [entries, setEntries] = useState<Entry[]>([]), [mem, setMem] = useState<Mem[]>([]);
  const [name, setName] = useState(""), [body, setBody] = useState("");
  const [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState("");
  const [sugs, setSugs] = useState<Sug[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null), [eName, setEName] = useState(""), [eBody, setEBody] = useState("");

  const load = useCallback(async () => {
    try { setEntries((await api(`/api/projects/${projectId}/bible`)).entries); setMem((await api(`/api/projects/${projectId}/memory`)).chapters); } catch (e) { setErr((e as Error).message); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const fail = (e: unknown) => { setErr((e as Error).message); setMsg(""); };
  async function add(k = kind, n = name, b = body) {
    setErr("");
    try { const d = await api(`/api/projects/${projectId}/bible`, "POST", { kind: k, name: n, body: b }); setEntries((x) => [...x, d.entry]); setMsg(`Added ${n}.`); if (n === name) { setName(""); setBody(""); } } catch (e) { fail(e); }
  }
  async function save(id: string) {
    try { const d = await api(`/api/bible/${id}`, "PATCH", { name: eName, body: eBody }); setEntries((x) => x.map((e) => (e.id === id ? d.entry : e))); setEditing(null); setMsg("Saved."); } catch (e) { fail(e); }
  }
  async function del(e: Entry) {
    if (!confirm(`Delete "${e.name}" from the Story Bible? This cannot be undone.`)) return;
    try { await api(`/api/bible/${e.id}`, "DELETE"); setEntries((x) => x.filter((y) => y.id !== e.id)); setMsg("Deleted."); } catch (x) { fail(x); }
  }
  async function suggest() {
    setBusy("suggest"); setErr(""); setSugs(null);
    try { setSugs((await api(`/api/projects/${projectId}/bible/suggest`, "POST")).suggestions); } catch (e) { fail(e); }
    setBusy("");
  }
  async function build(ids: string[]) {
    setBusy("memory"); setErr("");
    try { for (const id of ids) { await api(`/api/chapters/${id}/memory`, "POST"); setMem((await api(`/api/projects/${projectId}/memory`)).chapters); } setMsg("Memory is up to date."); } catch (e) { fail(e); }
    setBusy("");
  }
  const list = entries.filter((e) => e.kind === kind);
  const todo = mem.filter((m) => m.state !== "current").map((m) => m.id);

  return (
    <div className="space-y-8">
      <div role="status" aria-live="polite" className="min-h-6 text-sm">{msg && <span className="msg-ok">{msg}</span>}{err && <span role="alert" className="msg-err">{err}</span>}</div>

      <section aria-label="Story Bible entries">
        <div role="tablist" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {KINDS.map(([k, l]) => <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`btn shrink-0 ${kind === k ? "btn-primary" : "btn-secondary"}`}>{l} <span className="opacity-70">{entries.filter((e) => e.kind === k).length}</span></button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="card mt-3 space-y-3">
          <label className="block text-sm font-medium">Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="field mt-1" placeholder={kind === "timeline" ? "e.g. The harbour fire" : "e.g. Adaeze"} /></label>
          <label className="block text-sm font-medium">Details<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={4000} className="field mt-1" placeholder={KINDS.find((k) => k[0] === kind)![2]} /></label>
          <button className="btn btn-primary w-full sm:w-auto" disabled={!name.trim()}>Add to Story Bible</button>
        </form>
        <ul className="mt-3 space-y-2">
          {list.length === 0 && <li className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">Nothing here yet. Add your first entry above.</li>}
          {list.map((e) => (
            <li key={e.id} className="card">
              {editing === e.id ? (
                <div className="space-y-2">
                  <input aria-label="Name" value={eName} onChange={(x) => setEName(x.target.value)} className="field" />
                  <textarea aria-label="Details" value={eBody} onChange={(x) => setEBody(x.target.value)} rows={4} className="field" />
                  <div className="flex gap-2"><button className="btn btn-primary" onClick={() => save(e.id)} disabled={!eName.trim()}>Save</button><button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button></div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-semibold">{e.name}</p>{e.body && <p className="mt-1 whitespace-pre-wrap text-muted">{e.body}</p>}</div>
                  <div className="flex shrink-0 gap-1"><button className="btn btn-secondary" onClick={() => { setEditing(e.id); setEName(e.name); setEBody(e.body); }} aria-label={`Edit ${e.name}`}>Edit</button><button className="btn btn-danger" onClick={() => del(e)} aria-label={`Delete ${e.name}`}>Delete</button></div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Find entries in manuscript" className="card">
        <h2 className="font-semibold">Find entries in my manuscript</h2>
        <p className="mt-1 text-sm text-muted">Co Writer reads your chapters and proposes characters and places it finds. Nothing is added until you choose.</p>
        <button className="btn btn-secondary mt-3" onClick={suggest} disabled={busy === "suggest"}>{busy === "suggest" ? "Reading…" : "Suggest entries"}</button>
        {sugs && (sugs.length === 0 ? <p className="mt-3 text-sm text-muted">Nothing new found.</p> : (
          <ul className="mt-3 space-y-2">{sugs.map((s, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream p-3">
              <div className="min-w-0"><p className="font-medium">{s.name} <span className="text-xs text-muted">{s.kind}</span></p><p className="text-sm text-muted">{s.body}</p></div>
              <button className="btn btn-primary" onClick={async () => { await add(s.kind, s.name, s.body); setSugs((x) => x && x.filter((y) => y !== s)); }}>Add</button>
            </li>))}</ul>))}
      </section>

      <section aria-label="Manuscript memory" className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Manuscript memory</h2><p className="text-sm text-muted">A short summary and key facts for each chapter, so Co Writer remembers your story. Rebuilt only when a chapter changes.</p></div>
          <button className="btn btn-primary" disabled={!todo.length || busy === "memory"} onClick={() => build(todo)}>{busy === "memory" ? "Building…" : todo.length ? `Update ${todo.length} chapter${todo.length > 1 ? "s" : ""}` : "All up to date"}</button>
        </div>
        <ul className="mt-3 divide-y divide-line">
          {mem.map((m) => (
            <li key={m.id} className="py-3">
              <div className="flex items-center justify-between gap-2"><p className="font-medium">{m.title || "Untitled"} <span className="text-sm text-muted">{m.wordCount.toLocaleString()} words</span></p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${m.state === "current" ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900"}`}>{m.state === "current" ? (m.basic ? "Basic summary" : "Up to date") : m.state === "stale" ? "Changed since last build" : "Not built"}</span></div>
              {m.summary && <p className="mt-1 text-sm text-muted">{m.summary}</p>}
              {m.facts.length > 0 && <ul className="mt-1 list-disc pl-5 text-sm text-muted">{m.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>}
            </li>))}
        </ul>
      </section>
    </div>
  );
}
