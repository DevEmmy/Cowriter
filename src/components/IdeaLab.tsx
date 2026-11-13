"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Proj = { id: string; title: string };
type Idea = { id: string; kind: string; input: string; projectId: string | null; result: Record<string, unknown>; createdAt: string };
const TABS: Array<[string, string, string]> = [
  ["idea", "Develop an idea", "Describe a story idea, even a rough one."],
  ["characters", "Characters", "Name your characters and what you know about them."],
  ["plot", "Plot", "Describe your story so far or where it is heading."],
  ["chapters", "Chapter breakdown", "Describe the story to break into chapters."],
];

function Titled({ items }: { items: Array<{ title: string; summary: string }> }) {
  return <ul className="mt-1 space-y-2">{items.map((x, i) => <li key={i}><span className="font-semibold">{x.title}.</span> {x.summary}</li>)}</ul>;
}
function List({ items }: { items: string[] }) {
  return <ul className="mt-1 list-disc space-y-1 pl-5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
}
function Sec({ label, children }: { label: string; children: React.ReactNode }) {
  return <section className="mt-4"><h4 className="text-sm font-semibold text-electric">{label}</h4>{children}</section>;
}

function Result({ kind, r }: { kind: string; r: Record<string, any> }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (kind === "idea") return <>
    <Sec label="Refined idea"><p className="mt-1">{r.refined}</p></Sec>
    <Sec label="Three possible directions"><Titled items={r.directions} /></Sec>
    <Sec label="Weaknesses to consider"><List items={r.weaknesses} /></Sec>
    <Sec label="Opportunities"><List items={r.opportunities} /></Sec>
    <Sec label="Questions for you"><List items={r.questions} /></Sec></>;
  if (kind === "characters") return <>{r.characters.map((c: Record<string, string>, i: number) => (
    <div key={i} className="mt-4 rounded-xl bg-cream p-4"><h4 className="font-bold">{c.name} <span className="text-sm font-normal text-muted">{c.role}</span></h4>
      <p className="mt-2"><b>Motivation:</b> {c.motivation}</p><p><b>Conflict:</b> {c.conflict}</p><p><b>Relationships:</b> {c.relationships}</p><p><b>Possible arc:</b> {c.arc}</p></div>))}</>;
  if (kind === "plot") return <>
    <Sec label="Conflicts"><List items={r.conflicts} /></Sec><Sec label="Subplots"><Titled items={r.subplots} /></Sec>
    <Sec label="Story arc"><ol className="mt-1 list-decimal space-y-1 pl-5">{r.arc.map((x: string, i: number) => <li key={i}>{x}</li>)}</ol></Sec>
    <Sec label="Possible twists"><Titled items={r.twists} /></Sec><Sec label="Themes"><List items={r.themes} /></Sec></>;
  return <ol className="mt-4 space-y-2">{r.chapters.map((c: { title: string; summary: string }, i: number) => <li key={i}><span className="font-semibold">{c.title}.</span> {c.summary}</li>)}</ol>;
}

export default function IdeaLab({ projects }: { projects: Proj[] }) {
  const router = useRouter();
  const [kind, setKind] = useState("idea"), [input, setInput] = useState(""), [pid, setPid] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [cur, setCur] = useState<Idea | null>(null);
  const [hist, setHist] = useState<Idea[]>([]);

  async function loadHist() { const r = await fetch("/api/ideas"); if (r.ok) setHist((await r.json()).ideas); }
  async function run() {
    setBusy(true); setErr("");
    const r = await fetch("/api/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, input, projectId: pid || undefined }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error ?? "Something went wrong.");
    setCur(d.idea); loadHist(); router.refresh();
  }
  async function del(id: string) { await fetch(`/api/ideas/${id}`, { method: "DELETE" }); if (cur?.id === id) setCur(null); loadHist(); }
  useEffect(() => { loadHist(); }, []);
  const tab = TABS.find((t) => t[0] === kind)!;

  return (
    <div className="mt-6">
      <div role="tablist" className="flex flex-wrap gap-2">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`rounded-full px-4 py-1.5 text-sm ${kind === k ? "bg-electric text-white" : "bg-lavender text-electric"}`}>{l}</button>)}
      </div>
      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium" htmlFor="idea-input">{tab[2]}</label>
        <textarea id="idea-input" value={input} onChange={(e) => setInput(e.target.value)} rows={6} maxLength={6000} className="mt-2 w-full rounded-xl border border-lavender p-3" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-sm">Use project context (optional){" "}
            <select value={pid} onChange={(e) => setPid(e.target.value)} className="ml-1 rounded-lg border border-lavender p-1.5">
              <option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select></label>
          <button onClick={run} disabled={busy || input.trim().length < 10} className="rounded-full bg-electric px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Thinking…" : "Generate suggestions"}</button>
        </div>
        {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      </div>

      {cur && <article aria-label="Result" className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-xs text-muted">Suggestions only. Nothing here changes your manuscript.</p>
        <Result kind={cur.kind} r={cur.result} />
      </article>}

      {hist.length > 0 && <section className="mt-8"><h2 className="text-lg font-bold">Earlier ideas</h2>
        <ul className="mt-3 space-y-2">{hist.map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm">
            <button onClick={() => setCur(h)} className="min-w-0 flex-1 truncate text-left text-sm"><span className="mr-2 rounded-full bg-lavender px-2 py-0.5 text-xs text-electric">{TABS.find((t) => t[0] === h.kind)?.[1] ?? h.kind}</span>{h.input}</button>
            <button onClick={() => del(h.id)} aria-label="Delete idea" className="text-sm text-muted hover:text-red-600">Delete</button>
          </li>))}</ul></section>}
    </div>
  );
}
