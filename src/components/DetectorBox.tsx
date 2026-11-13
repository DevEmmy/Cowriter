"use client";
import { useEffect, useState } from "react";

type Det = { id: string; name: string; configured: boolean; envKey: string; signup: string };
type Res = { provider: string; aiProbability: number; humanProbability: number | null; verdict: string | null; checkedAt: string };

export default function DetectorBox({ chapterId }: { chapterId: string }) {
  const [dets, setDets] = useState<Det[] | null>(null), [res, setRes] = useState<Res | null>(null), [busy, setBusy] = useState(""), [err, setErr] = useState("");
  useEffect(() => { fetch("/api/detectors").then((r) => r.json()).then((d) => setDets(d.detectors)).catch(() => setDets([])); }, []);
  useEffect(() => { setRes(null); setErr(""); }, [chapterId]);
  async function run(id: string) {
    setBusy(id); setErr(""); setRes(null);
    const r = await fetch("/api/detect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chapterId, provider: id }) });
    const d = await r.json().catch(() => ({})); setBusy("");
    if (!r.ok) return setErr(d.error ?? "Something went wrong.");
    setRes(d.result);
  }
  const live = (dets ?? []).filter((d) => d.configured);
  return (
    <section className="card" aria-label="AI detector check">
      <h2 className="font-semibold">AI detector check <span className="text-xs font-normal text-muted">optional, third party</span></h2>
      <p className="mt-1 text-sm text-muted">Sends this chapter to an outside detector you have connected, and shows exactly what it answers. Co Writer never guesses a detector score. Detectors are unreliable and often wrongly flag human writing, so treat any result as one weak signal.</p>
      {dets && live.length === 0 && (
        <div className="mt-3 rounded-xl bg-cream p-3 text-sm"><p className="font-medium">No detector is connected.</p>
          <p className="mt-1 text-muted">These services need their own (usually paid) API key. To connect one, add its key as an environment variable and redeploy:</p>
          <ul className="mt-2 list-disc pl-5">{dets.map((d) => <li key={d.id}><span className="font-medium">{d.name}</span>: variable <code className="rounded bg-lavender px-1">{d.envKey}</code> (get a key at {d.signup.replace("https://", "")})</li>)}</ul></div>)}
      {live.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{live.map((d) => <button key={d.id} className="btn btn-secondary" disabled={!!busy} onClick={() => run(d.id)}>{busy === d.id ? "Checking…" : `Check with ${d.name}`}</button>)}</div>}
      <div role="status" aria-live="polite">{err && <p role="alert" className="msg-err mt-2 text-sm">{err}</p>}</div>
      {res && (
        <div className="mt-3 rounded-xl bg-lavender/60 p-4" aria-label="Detector result">
          <p className="text-sm text-muted">Returned by {res.provider} on {new Date(res.checkedAt).toLocaleString()}</p>
          <p className="mt-1 text-2xl font-bold">{Math.round(res.aiProbability * 100)}% likely AI-written <span className="text-sm font-normal text-muted">(as reported)</span></p>
          {res.humanProbability !== null && <p className="text-sm">Human: {Math.round(res.humanProbability * 100)}%</p>}
          {res.verdict && <p className="text-sm">Provider verdict: {res.verdict}</p>}
        </div>)}
    </section>
  );
}
