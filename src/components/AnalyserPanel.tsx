"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import DetectorBox from "@/components/DetectorBox";

interface Metrics { words: number; sentences: number; paragraphs: number; avgSentence: number; longestSentence: { words: number; excerpt: string }; readingEase: number; gradeLevel: number; readingMinutes: number; dialoguePct: number; uniqueRatio: number; adverbsPer1000: number; passivePer1000: number; filterWords: Array<[string, number]>; lengthMix: { short: number; medium: number; long: number }; pacing: Array<{ words: number; dialogue: boolean }>; repeatedWords: Array<[string, number]>; pov: string; tense: string; issues: Array<{ type: string; severity: string; message: string; excerpt?: string }> }
interface Feedback { summary: string; tone: string; pacing: string; strengths: Array<{ point: string; evidence?: string }>; improvements: Array<{ point: string; evidence?: string }> }

const ease = (n: number) => (n >= 80 ? "very easy to read" : n >= 60 ? "plain and easy" : n >= 40 ? "moderately dense" : "dense");

export default function AnalyserPanel({ projectId, chapters, chapterId }: { projectId: string; chapters: Array<{ id: string; title: string }>; chapterId: string }) {
  const router = useRouter(), path = usePathname();
  const [m, setM] = useState<Metrics | null>(null), [fb, setFb] = useState<Feedback | null>(null), [note, setNote] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function run() {
    setBusy(true); setErr(""); setNote("");
    const r = await fetch(`/api/chapters/${chapterId}/analyse`, { method: "POST" });
    const d = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) return setErr(d.error ?? "Something went wrong.");
    setM(d.metrics); setFb(d.feedback); setNote(d.note ?? "");
  }
  const maxP = m ? Math.max(1, ...m.pacing.map((p) => p.words)) : 1;
  const mix = m ? m.lengthMix.short + m.lengthMix.medium + m.lengthMix.long || 1 : 1;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-0 flex-1 text-sm font-medium sm:max-w-xs">Chapter
          <select value={chapterId} onChange={(e) => router.replace(`${path}?project=${projectId}&chapter=${e.target.value}`)} className="field mt-1">{chapters.map((c) => <option key={c.id} value={c.id}>{c.title || "Untitled"}</option>)}</select></label>
        <button className="btn btn-primary w-full sm:w-auto" onClick={run} disabled={busy}>{busy ? "Analysing…" : "Analyse this chapter"}</button>
      </div>
      <div role="status" aria-live="polite">{err && <p role="alert" className="msg-err text-sm">{err}</p>}</div>

      {m && (
        <div className="space-y-5" aria-label="Analysis results">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Key numbers">
            {[["Words", m.words.toLocaleString()], ["Reading time", `${m.readingMinutes} min`], ["Avg sentence", `${m.avgSentence} words`], ["Dialogue", `${m.dialoguePct}%`], ["Readability", `${m.readingEase}/100`], ["Grade level", String(m.gradeLevel)], ["Viewpoint", m.pov], ["Tense", m.tense]].map(([l, v]) => (
              <div key={l} className="card !p-4"><p className="text-xs text-muted">{l}</p><p className="mt-1 text-lg font-bold capitalize">{v}</p></div>))}
          </section>
          <p className="text-sm text-muted">Readability {m.readingEase}/100 means this chapter is {ease(m.readingEase)}. These are measurements, not judgements. Many strong books score low or high on purpose.</p>

          <section className="card" aria-label="Pacing">
            <h2 className="font-semibold">Pacing by paragraph</h2>
            <p className="text-sm text-muted">Each bar is a paragraph, in order. Purple bars open with dialogue.</p>
            <div role="img" aria-label={`${m.paragraphs} paragraphs, longest ${maxP} words`} className="mt-3 flex h-24 items-end gap-0.5 overflow-hidden">
              {m.pacing.map((p, i) => <div key={i} title={`${p.words} words`} className={`min-w-[3px] flex-1 rounded-t ${p.dialogue ? "bg-electric" : "bg-peach"}`} style={{ height: `${Math.max(6, (p.words / maxP) * 100)}%` }} />)}
            </div>
          </section>

          <section className="card" aria-label="Sentence rhythm">
            <h2 className="font-semibold">Sentence rhythm</h2>
            <div className="mt-3 flex h-4 overflow-hidden rounded-full" role="img" aria-label={`${m.lengthMix.short} short, ${m.lengthMix.medium} medium, ${m.lengthMix.long} long sentences`}>
              <div className="bg-coral" style={{ width: `${(m.lengthMix.short / mix) * 100}%` }} /><div className="bg-electric" style={{ width: `${(m.lengthMix.medium / mix) * 100}%` }} /><div className="bg-deep" style={{ width: `${(m.lengthMix.long / mix) * 100}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted">{m.lengthMix.short} short (under 8 words), {m.lengthMix.medium} medium, {m.lengthMix.long} long (over 20). Longest sentence: {m.longestSentence.words} words.</p>
            {m.longestSentence.excerpt && <blockquote className="mt-2 border-l-4 border-peach pl-3 text-sm italic text-muted">{m.longestSentence.excerpt}…</blockquote>}
          </section>

          <section className="card" aria-label="Style signals">
            <h2 className="font-semibold">Style signals</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>Adverbs ending in -ly: {m.adverbsPer1000} per 1,000 words</li>
              <li>Possible passive phrasing: {m.passivePer1000} per 1,000 words</li>
              {m.filterWords.length > 0 && <li>Filter words (they put a narrator between reader and scene): {m.filterWords.map(([w, c]) => `${w} ×${c}`).join(", ")}</li>}
              {m.repeatedWords.length > 0 && <li>Most repeated words: {m.repeatedWords.map(([w, c]) => `${w} ×${c}`).join(", ")}</li>}
            </ul>
            {m.issues.length > 0 && <ul className="mt-3 space-y-2">{m.issues.map((i, n) => <li key={n} className="rounded-xl bg-cream p-3 text-sm"><span className="font-medium">{i.message}</span>{i.excerpt && <span className="block italic text-muted">“{i.excerpt}”</span>}</li>)}</ul>}
          </section>

          {fb ? (
            <section className="card space-y-3" aria-label="Editor feedback">
              <h2 className="font-semibold">Editor feedback <span className="text-xs font-normal text-muted">AI opinion, not fact</span></h2>
              <p>{fb.summary}</p><p className="text-sm text-muted">Tone: {fb.tone}. Pacing: {fb.pacing}</p>
              {[["What works", fb.strengths], ["What to look at", fb.improvements]].map(([label, list]) => (
                <div key={label as string}><h3 className="text-sm font-semibold text-electric-dark">{label as string}</h3>
                  <ul className="mt-1 space-y-2">{(list as Feedback["strengths"]).map((p, i) => <li key={i}>{p.point}{p.evidence && <span className="block border-l-4 border-peach pl-3 text-sm italic text-muted">{p.evidence}</span>}</li>)}</ul></div>))}
            </section>
          ) : note && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{note}</p>}
        </div>
      )}
      <DetectorBox chapterId={chapterId} />
    </div>
  );
}
