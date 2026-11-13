"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { analyse, checkProse } from "@/lib/ai/textstats";
import { MODES, planSections, textToHtml, type Mode } from "@/lib/ai/expand";
import { GOAL_LABELS } from "@/lib/ai/goals";
import { countWords, htmlToText } from "@/lib/words";

type Tab = "chat" | "improve" | "expand" | "check";
interface Msg { id?: string; role: "user" | "assistant"; content: string }

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? "Something went wrong.");
  return d;
}
const selection = (e: Editor) => { const { from, to } = e.state.selection; return { from, to, text: from === to ? "" : e.state.doc.textBetween(from, to, "\n\n") }; };

export default function AiPanel({ editor, projectId, chapterId, panelBg, dark, onChanged }: { editor: Editor; projectId: string; chapterId: string; panelBg: string; dark: boolean; onChanged: () => void }) {
  const [tab, setTab] = useState<Tab>("chat");
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => { fetch("/api/ai/status").then((r) => r.json()).then((d) => setConfigured(!!d.configured)).catch(() => setConfigured(false)); }, []);
  const tabBtn = (k: Tab, l: string) => <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={`rounded-lg px-2.5 py-1 text-xs ${tab === k ? "bg-electric text-white" : "hover:bg-electric/10"}`}>{l}</button>;
  const box = `rounded-lg border p-2.5 text-sm ${dark ? "border-[#33294f]" : "border-lavender"}`;
  return (
    <aside aria-label="Co Writer assistant" className={`flex flex-col border-t md:w-[26rem] md:shrink-0 md:border-l md:border-t-0 ${panelBg}`}>
      <div className="flex flex-wrap gap-1 p-3">{tabBtn("chat", "Chat")}{tabBtn("improve", "Improve")}{tabBtn("expand", "Expand")}{tabBtn("check", "Prose check")}</div>
      {configured === false && tab !== "check" && (
        <p role="note" className="mx-3 mb-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">The AI is not connected yet. Add a free <code>GEMINI_API_KEY</code> in your site&apos;s environment variables to turn this on. Prose check works without it.</p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {tab === "chat" && <Chat editor={editor} projectId={projectId} chapterId={chapterId} box={box} />}
        {tab === "improve" && <Improve editor={editor} projectId={projectId} box={box} />}
        {tab === "expand" && <Expand editor={editor} projectId={projectId} chapterId={chapterId} box={box} onChanged={onChanged} />}
        {tab === "check" && <Check editor={editor} box={box} />}
      </div>
    </aside>
  );
}

function Chat({ editor, projectId, chapterId, box }: { editor: Editor; projectId: string; chapterId: string; box: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [useSel, setUseSel] = useState(true);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { fetch(`/api/projects/${projectId}/chat`).then((r) => r.json()).then((d) => Array.isArray(d) && setMsgs(d)).catch(() => {}); }, [projectId]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);

  async function send() {
    const message = text.trim(); if (!message || busy) return;
    const sel = useSel ? selection(editor).text : "";
    setBusy(true); setErr(""); setMsgs((m) => [...m, { role: "user", content: message }]); setText("");
    try {
      const d = await post(`/api/projects/${projectId}/chat`, { message, chapterId, selection: sel || undefined });
      setMsgs((m) => [...m, { role: "assistant", content: d.reply }]);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); setMsgs((m) => m.slice(0, -1)); setText(message); }
    setBusy(false);
  }
  async function clear() { if (!confirm("Clear this conversation? Your manuscript is not affected.")) return; await fetch(`/api/projects/${projectId}/chat`, { method: "DELETE" }); setMsgs([]); }

  return (
    <div className="space-y-2">
      {msgs.length === 0 && <p className="text-sm opacity-70">Talk about your chapter the way you would with an editor. For example: &ldquo;The dialogue feels stiff. Can you suggest a more natural version?&rdquo; Nothing is changed in your manuscript unless you insert it yourself.</p>}
      {msgs.map((m, i) => (
        <div key={i} className={`${box} ${m.role === "user" ? "ml-6 bg-electric/10" : "mr-2"}`}>
          <p className="whitespace-pre-wrap">{m.content}</p>
          {m.role === "assistant" && <button className="mt-1.5 text-xs text-electric hover:underline" onClick={() => editor.chain().focus().insertContent(textToHtml(m.content)).run()}>Insert at cursor</button>}
        </div>
      ))}
      {busy && <p role="status" className="text-sm opacity-60">Thinking…</p>}
      <div ref={end} />
      {err && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{err}</p>}
      <label className="flex items-center gap-2 text-xs opacity-80"><input type="checkbox" checked={useSel} onChange={(e) => setUseSel(e.target.checked)} /> Include my selected text</label>
      <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }} rows={3} maxLength={4000} aria-label="Message to Co Writer" placeholder="Message Co Writer (Ctrl+Enter to send)" className="w-full rounded-lg border border-electric/20 bg-transparent p-2 text-sm" />
      <div className="flex justify-between"><button onClick={clear} className="text-xs opacity-60 hover:opacity-100">Clear chat</button><button onClick={send} disabled={busy || !text.trim()} className="rounded-lg bg-electric px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Send</button></div>
    </div>
  );
}

function Improve({ editor, projectId, box }: { editor: Editor; projectId: string; box: string }) {
  const [sel, setSel] = useState<{ from: number; to: number; text: string }>({ from: 0, to: 0, text: "" });
  const [goals, setGoals] = useState<string[]>(["rhythm"]);
  const [instruction, setInstruction] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { setSel(selection(editor)); }, [editor]);

  async function run() {
    setBusy(true); setErr(""); setOut("");
    try { setOut((await post("/api/ai/enrich", { projectId, passage: sel.text, goals, instruction })).suggestion); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed."); }
    setBusy(false);
  }
  function accept() {
    if (editor.state.doc.textBetween(sel.from, sel.to, "\n\n") !== sel.text) { setErr("The text changed since you selected it. Select the passage again."); return; }
    editor.chain().focus().insertContentAt({ from: sel.from, to: sel.to }, out.includes("\n\n") ? textToHtml(out) : out).run();
    setOut(""); setSel({ from: 0, to: 0, text: "" });
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><p className="text-sm font-medium">Selected passage</p><button className="text-xs text-electric hover:underline" onClick={() => { setSel(selection(editor)); setOut(""); setErr(""); }}>Use my current selection</button></div>
      <p className={`${box} max-h-32 overflow-y-auto whitespace-pre-wrap`}>{sel.text || <span className="opacity-60">Select text in the manuscript, then press &ldquo;Use my current selection&rdquo;.</span>}</p>
      <fieldset className="grid grid-cols-2 gap-1 text-xs"><legend className="mb-1 text-sm font-medium">What should improve?</legend>
        {Object.entries(GOAL_LABELS).map(([k, l]) => <label key={k} className="flex items-center gap-1.5"><input type="checkbox" checked={goals.includes(k)} onChange={(e) => setGoals(e.target.checked ? [...goals, k] : goals.filter((g) => g !== k))} />{l}</label>)}
      </fieldset>
      <input value={instruction} onChange={(e) => setInstruction(e.target.value)} maxLength={1000} placeholder="Anything else? (optional)" aria-label="Extra instruction" className="w-full rounded-lg border border-electric/20 bg-transparent px-2.5 py-1.5 text-sm" />
      <button onClick={run} disabled={busy || sel.text.length < 10} className="w-full rounded-lg bg-electric py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Working…" : out ? "Regenerate" : "Suggest improvement"}</button>
      {err && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{err}</p>}
      {out && (<>
        <p className="text-sm font-medium">Suggestion</p><p className={`${box} max-h-64 overflow-y-auto whitespace-pre-wrap bg-electric/5`}>{out}</p>
        <div className="flex gap-2"><button onClick={accept} className="flex-1 rounded-lg bg-green-600 py-1.5 text-sm font-semibold text-white">Accept</button><button onClick={() => setOut("")} className="flex-1 rounded-lg border border-electric/30 py-1.5 text-sm">Reject</button></div>
        <p className="text-xs opacity-60">Accept replaces only the selected passage. You can still undo with Undo or restore from History.</p>
      </>)}
    </div>
  );
}

function Expand({ editor, projectId, chapterId, box, onChanged }: { editor: Editor; projectId: string; chapterId: string; box: string; onChanged: () => void }) {
  const orig = countWords(editor.getHTML());
  const [target, setTarget] = useState(Math.max(300, Math.round(orig * 1.6 / 100) * 100));
  const [mode, setMode] = useState<Mode>("balanced");
  const [instruction, setInstruction] = useState("");
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [parts, setParts] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState("");
  const [baseHtml, setBaseHtml] = useState("");
  const cancel = useRef(false);

  const generated = parts.join("\n\n");
  const gw = (generated.match(/\S+/g) ?? []).length;

  async function start() {
    const html = editor.getHTML(); const base = countWords(html);
    if (base < 30) { setErr("Write at least a short draft first. Expansion develops what you already have."); return; }
    if (target <= base) { setErr("Set a target higher than the current word count."); return; }
    const secs = planSections(html, target);
    cancel.current = false; setErr(""); setParts([]); setState("running"); setTotal(secs.length); setBaseHtml(html);
    const acc: string[] = [];
    try {
      for (let i = 0; i < secs.length; i++) {
        if (cancel.current) break;
        const before = (acc[acc.length - 1] ?? secs[i - 1]?.text ?? "").split(/\s+/).slice(-180).join(" ");
        const after = (secs[i + 1]?.text ?? "").split(/\s+/).slice(0, 100).join(" ");
        const d = await post("/api/ai/expand", { projectId, mode, section: secs[i].text, wanted: secs[i].wanted, words: secs[i].words, before, after, instruction });
        acc.push(d.text); setParts([...acc]);
      }
      setState(cancel.current ? "idle" : "done");
    } catch (e) { setErr((e instanceof Error ? e.message : "Failed.") + (acc.length ? ` Sections completed so far (${acc.length} of ${secs.length}) are shown below; you can use them or try again.` : "")); setState(acc.length ? "done" : "idle"); }
  }

  const checks = state === "done" && gw ? (() => {
    const issues = checkProse(generated).filter((i) => i.severity === "warn" || i.type === "repeated-phrase");
    const near = gw >= target * 0.9 && gw <= target * 1.1;
    return { near, issues };
  })() : null;

  async function accept() {
    if (!confirm("Replace this chapter's text with the expanded version?\n\nYour current text is saved to Version History first, so you can always go back.")) return;
    if (editor.getHTML() !== baseHtml && !confirm("The chapter was edited while the expansion was running. Replace it anyway?")) return;
    const r = await fetch(`/api/chapters/${chapterId}/versions`, { method: "POST" });
    if (!r.ok) { setErr("Could not save a safety version, so nothing was replaced."); return; }
    editor.commands.setContent(textToHtml(generated)); onChanged(); setState("idle"); setParts([]);
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label>Current words<input readOnly value={orig} className="mt-1 w-full rounded-lg border border-electric/20 bg-transparent px-2 py-1.5 opacity-70" /></label>
        <label>Target words<input type="number" min={orig + 1} max={20000} value={target} onChange={(e) => setTarget(Number(e.target.value))} disabled={state === "running"} className="mt-1 w-full rounded-lg border border-electric/20 bg-transparent px-2 py-1.5" /></label>
      </div>
      <label className="block text-sm">Style<select value={mode} onChange={(e) => setMode(e.target.value as Mode)} disabled={state === "running"} className="mt-1 w-full rounded-lg border border-electric/20 bg-transparent px-2 py-1.5">{(Object.keys(MODES) as Mode[]).map((m) => <option key={m} value={m}>{MODES[m].split(":")[0]}</option>)}</select></label>
      <p className="text-xs opacity-70">{MODES[mode].split(": ")[1]}</p>
      <input value={instruction} onChange={(e) => setInstruction(e.target.value)} maxLength={1000} placeholder="Extra instruction (optional), e.g. no new characters" aria-label="Extra instruction" className="w-full rounded-lg border border-electric/20 bg-transparent px-2.5 py-1.5 text-sm" />
      {state === "running" ? <button onClick={() => { cancel.current = true; }} className="w-full rounded-lg border border-electric/40 py-2 text-sm">Stop after this section</button>
        : <button onClick={start} className="w-full rounded-lg bg-electric py-2 text-sm font-semibold text-white">{state === "done" ? "Regenerate" : "Expand chapter"}</button>}
      {err && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{err}</p>}
      {(state !== "idle" || parts.length > 0) && (
        <div className={box} aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-lavender"><div className="h-full bg-gradient-to-r from-electric to-coral" style={{ width: `${total ? (parts.length / total) * 100 : 0}%` }} /></div>
          <p className="mt-2 text-xs">Section {parts.length} of {total} · original {orig.toLocaleString()} · target {target.toLocaleString()} · generated {gw.toLocaleString()} · added {Math.max(0, gw - orig).toLocaleString()} · remaining {Math.max(0, target - gw).toLocaleString()}</p>
        </div>
      )}
      {state === "done" && parts.length > 0 && (<>
        {checks && (
          <ul className="space-y-1 text-xs">
            <li className={checks.near ? "text-green-700" : "text-amber-700"}>{checks.near ? "✓" : "!"} Length {gw.toLocaleString()} words ({checks.near ? "within 10% of the target" : "not within 10% of the target"})</li>
            {checks.issues.length === 0 ? <li className="text-green-700">✓ No repetition or long dashes found</li> : checks.issues.map((i, k) => <li key={k} className="text-amber-700">! {i.message}{i.excerpt ? ` “${i.excerpt}”` : ""}</li>)}
            <li className="opacity-70">Plot, character and timeline continuity are not checked automatically. Please read it against your story before accepting.</li>
          </ul>
        )}
        <p className="text-sm font-medium">Revised version</p>
        <div className={`${box} max-h-72 overflow-y-auto whitespace-pre-wrap bg-electric/5`}>{generated}</div>
        <details className="text-xs"><summary className="cursor-pointer text-electric">Compare with original</summary><div className={`${box} mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap`}>{htmlToText(baseHtml.replace(/<\/p>/g, "\n\n"))}</div></details>
        <div className="flex gap-2"><button onClick={accept} className="flex-1 rounded-lg bg-green-600 py-1.5 text-sm font-semibold text-white">Accept</button><button onClick={() => { setParts([]); setState("idle"); }} className="flex-1 rounded-lg border border-electric/30 py-1.5 text-sm">Reject</button></div>
      </>)}
    </div>
  );
}

function Check({ editor, box }: { editor: Editor; box: string }) {
  const [text, setText] = useState("");
  const run = useCallback(() => setText(editor.getText({ blockSeparator: "\n\n" })), [editor]);
  useEffect(run, [run]);
  const a = analyse(text); const issues = checkProse(text);
  const row = (k: string, v: string | number) => <div className="flex justify-between"><dt className="opacity-70">{k}</dt><dd className="font-medium">{v}</dd></div>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><p className="text-sm font-medium">Natural prose check</p><button onClick={run} className="text-xs text-electric hover:underline">Refresh</button></div>
      {a.words < 50 ? <p className="text-sm opacity-70">Write at least 50 words to see an analysis.</p> : (<>
        <dl className={`${box} space-y-1 text-xs`}>
          {row("Words", a.words)}{row("Average sentence", `${a.avgSentence} words`)}{row("Sentence variety", a.sentenceStdev)}{row("Longest sentence", `${a.longest} words`)}
          {row("Dialogue", `${a.dialoguePct}%`)}{row("Average paragraph", `${a.avgParagraph} words`)}{row("Perspective", a.pov)}{row("Tense", a.tense)}
        </dl>
        <p className="text-sm font-medium">Things to look at</p>
        {issues.length === 0 ? <p className="text-sm text-green-700">Nothing stood out.</p> : (
          <ul className="space-y-1.5">{issues.map((i, k) => <li key={k} className={`${box} text-xs ${i.severity === "warn" ? "border-amber-300" : ""}`}>{i.message}{i.excerpt && <span className="block opacity-70">“{i.excerpt}”</span>}</li>)}</ul>
        )}
      </>)}
      <p className="rounded-lg bg-electric/5 p-2 text-xs opacity-80">This is a style check run on your device. It is not an AI-detector score, and no external detector is connected, so no detector results are shown. These tools can disagree with each other and flag human writing, so use this as a prompt to revise, not a guarantee.</p>
    </div>
  );
}
