"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";

const TYPES: Array<[string, string]> = [["novel", "Novel"], ["short_story", "Short story"], ["screenplay", "Screenplay"], ["article", "Article"], ["blog_post", "Blog post"], ["poetry", "Poetry collection"], ["custom", "Custom project"]];
interface Preview { title: string; chapters: Array<{ title: string; words: number }>; words: number }

/** Import a manuscript from a file or pasted text. With projectId the chapters are added to that project; otherwise a new project is made. */
export default function ImportManuscript({ projectId, label = "Import manuscript" }: { projectId?: string; label?: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("novel");
  const [single, setSingle] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const form = (dry: boolean) => {
    const f = new FormData();
    if (mode === "file" && file) f.set("file", file); else f.set("text", text);
    f.set("title", title); f.set("type", type); f.set("split", single ? "single" : "auto");
    if (projectId) f.set("projectId", projectId);
    if (dry) f.set("dryRun", "1");
    return f;
  };
  const ready = mode === "file" ? !!file : text.trim().length > 0;
  const reset = () => { setPreview(null); setError(""); };
  const close = () => { if (busy) return; setOpen(false); setFile(null); setText(""); setTitle(""); reset(); };

  async function run(dry: boolean) {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/projects/import", { method: "POST", body: form(dry) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "Could not import that."); return; }
      if (dry) { setPreview(d); return; }
      router.push(`/studio/${d.id}?chapter=${d.chapterId}`);
    } catch { setError("Could not reach the server. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary"><FileUp aria-hidden size={18} /> {label}</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Import manuscript" className="fixed inset-0 z-50 grid place-items-end bg-deep/50 p-0 sm:place-items-center sm:p-4" onKeyDown={(e) => { if (e.key === "Escape") close(); }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
            <div><h2 className="text-xl font-bold">{projectId ? "Add chapters from a file" : "Import a manuscript"}</h2>
              <p className="mt-1 text-sm text-muted">Your words are brought in exactly as written. Nothing is rewritten, and you can review the chapters before saving.</p></div>
            <div role="tablist" aria-label="Import method" className="grid grid-cols-2 gap-1 rounded-xl bg-lavender p-1">
              {([["file", "Upload a file"], ["paste", "Paste text"]] as const).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={mode === k} type="button" onClick={() => { setMode(k); reset(); }} className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${mode === k ? "bg-white text-electric shadow" : "text-muted"}`}>{l}</button>))}
            </div>
            {mode === "file" ? (
              <div>
                <input ref={fileRef} id="import-file" type="file" accept=".docx,.pdf,.txt,.md,.markdown" className="sr-only" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); reset(); if (f && !title && !projectId) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ")); }} />
                <label htmlFor="import-file" className="flex min-h-[7rem] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-electric/40 bg-cream p-4 text-center focus-within:ring-2">
                  <FileUp aria-hidden className="text-electric" />
                  <span className="mt-2 font-semibold">{file ? file.name : "Choose a file"}</span>
                  <span className="text-sm text-muted">{file ? `${(file.size / 1024).toFixed(0)} KB · tap to change` : "Word (.docx), PDF, .txt or .md · up to 4 MB"}</span>
                </label>
              </div>
            ) : (
              <label className="block text-sm font-medium">Paste your text
                <textarea value={text} onChange={(e) => { setText(e.target.value); reset(); }} rows={8} placeholder="Paste a chapter or your whole manuscript. Start a chapter with a line like “Chapter 1”." className="field mt-1 w-full" />
              </label>
            )}
            {!projectId && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium">Title<input value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} className="field mt-1 w-full" placeholder="Name your project" /></label>
                <label className="block text-sm font-medium">Type<select value={type} onChange={(e) => setType(e.target.value)} className="field mt-1 w-full">{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              </div>
            )}
            <label className="flex min-h-[44px] items-center gap-3 text-sm"><input type="checkbox" checked={single} onChange={(e) => { setSingle(e.target.checked); reset(); }} className="h-5 w-5" /> Keep everything as one chapter (don’t split)</label>
            <div aria-live="polite">
              {error && <p role="alert" className="msg-err">{error}</p>}
              {preview && (
                <div className="rounded-2xl border border-lavender p-3">
                  <p className="text-sm font-semibold">{preview.chapters.length} chapter{preview.chapters.length === 1 ? "" : "s"} · {preview.words.toLocaleString()} words</p>
                  <ol className="mt-2 max-h-40 list-decimal space-y-1 overflow-y-auto pl-5 text-sm">{preview.chapters.map((c, i) => <li key={i}>{c.title} <span className="text-muted">({c.words.toLocaleString()})</span></li>)}</ol>
                  <p className="mt-2 text-xs text-muted">Wrong split? Tick “Keep everything as one chapter”, or add “Chapter 1” style headings to your file.</p>
                </div>)}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={busy} onClick={close} className="btn btn-secondary">Cancel</button>
              {!preview ? <button type="button" disabled={busy || !ready} onClick={() => run(true)} className="btn btn-primary">{busy ? "Reading…" : "Review chapters"}</button>
                : <button type="button" disabled={busy} onClick={() => run(false)} className="btn btn-primary">{busy ? "Importing…" : projectId ? "Add to project" : "Import and open"}</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
