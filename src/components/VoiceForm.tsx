"use client";
import { useCallback, useEffect, useState } from "react";

const CHIPS = ["Avoid em dashes.", "Use simple but rich vocabulary.", "Do not rush scenes.", "Avoid generic expressions.", "Use vivid descriptions.", "Preserve my original structure.", "Do not invent plot details.", "Do not introduce new characters."];
interface Analysis { stats?: { avgSentence: number; sentenceStdev: number; avgParagraph: number; dialoguePct: number; pov: string; tense: string }; summary?: string; at?: string }

export default function VoiceForm({ projects }: { projects: Array<{ id: string; title: string }> }) {
  const [scope, setScope] = useState("global");
  const [samples, setSamples] = useState("");
  const [instructions, setInstructions] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (s: string) => {
    const r = await fetch(`/api/voice?scope=${s}`); const d = await r.json().catch(() => ({}));
    setSamples(d.samples ?? ""); setInstructions(d.instructions ?? ""); setAnalysis(d.analysis ?? null); setMsg(null);
  }, []);
  useEffect(() => { load(scope); }, [scope, load]);

  async function save(): Promise<boolean> {
    const r = await fetch("/api/voice", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, samples, instructions }) });
    if (!r.ok) { setMsg({ ok: false, text: (await r.json().catch(() => ({}))).error ?? "Could not save." }); return false; }
    return true;
  }
  async function onSave() { setBusy(true); if (await save()) setMsg({ ok: true, text: "Saved." }); setBusy(false); }
  async function onAnalyse() {
    setBusy(true); setMsg(null);
    if (await save()) {
      const r = await fetch("/api/voice/analyse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ ok: false, text: d.error ?? "Analysis failed." });
      else { setAnalysis(d.analysis); setMsg({ ok: true, text: d.aiNote ? `Analysis saved. ${d.aiNote}` : "Analysis saved. Co Writer will now use it." }); }
    }
    setBusy(false);
  }
  const words = (samples.match(/\S+/g) ?? []).length;
  const field = "mt-1 w-full rounded-xl border border-lavender bg-white px-3.5 py-2.5 text-sm outline-none focus:border-electric";
  return (
    <div className="mt-6 space-y-5">
      <label className="block text-sm font-medium">Applies to
        <select value={scope} onChange={(e) => setScope(e.target.value)} className={field}>
          <option value="global">All my projects (global)</option>
          {projects.map((p) => <option key={p.id} value={p.id}>Only: {p.title}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">Writing samples <span className="font-normal text-ink/60">({words.toLocaleString()} words, at least 150 recommended)</span>
        <textarea value={samples} onChange={(e) => setSamples(e.target.value)} rows={10} placeholder="Paste a few pages of your own writing here." className={field} />
      </label>
      <div>
        <label htmlFor="instr" className="block text-sm font-medium">Standing instructions</label>
        <div className="mt-2 flex flex-wrap gap-1.5">{CHIPS.map((c) => <button key={c} type="button" onClick={() => !instructions.includes(c) && setInstructions((i) => (i ? i + "\n" : "") + c)} className="rounded-full bg-lavender px-3 py-1 text-xs text-electric hover:bg-electric hover:text-white">+ {c.replace(/\.$/, "")}</button>)}</div>
        <textarea id="instr" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={5} maxLength={4000} placeholder="One rule per line." className={field} />
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={onSave} disabled={busy} className="rounded-xl border border-electric px-5 py-2 text-sm font-semibold text-electric hover:bg-lavender disabled:opacity-50">Save</button>
        <button onClick={onAnalyse} disabled={busy || words < 150} className="rounded-xl bg-electric px-5 py-2 text-sm font-semibold text-white hover:bg-electric-dark disabled:opacity-50">{busy ? "Working…" : "Save and analyse my voice"}</button>
      </div>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.text}</p>}
      {analysis?.summary && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-lavender">
          <h2 className="font-semibold">Your voice profile</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink/80">{analysis.summary}</p>
        </section>
      )}
    </div>
  );
}
