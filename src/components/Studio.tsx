"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontFamily, FontSize } from "@tiptap/extension-text-style";
import { countWords, htmlToText } from "@/lib/words";
import AiPanel from "@/components/AiPanel";

interface Ch { id: string; title: string; wordCount: number }
interface Current { id: string; title: string; content: string; revision: number; wordCount: number }
interface Version { id: string; title: string; wordCount: number; reason: string; createdAt: string; content: string }
type Status = "saved" | "saving" | "unsaved" | "error" | "conflict";

const FONTS: Array<[string, string]> = [["Default", ""], ["Serif", "Georgia, serif"], ["Sans", "Arial, sans-serif"], ["Mono", "Courier New, monospace"], ["Garamond", "Garamond, serif"]];
const SIZES = ["14px", "16px", "18px", "20px", "24px", "28px"];
const draftKey = (id: string) => `cowriter-draft-${id}`;

export default function Studio({ project, chapters, chapter, openAi = false }: { project: { id: string; title: string; type: string }; chapters: Ch[]; chapter: Current | null; openAi?: boolean }) {
  const router = useRouter();
  const [list, setList] = useState(chapters);
  const [title, setTitle] = useState(chapter?.title ?? "");
  const [status, setStatus] = useState<Status>("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [words, setWords] = useState(chapter?.wordCount ?? 0);
  const [chars, setChars] = useState(0);
  const [dark, setDark] = useState(false);
  const [focus, setFocus] = useState(false);
  const [panel, setPanel] = useState<"none" | "history" | "find" | "ai">(openAi ? "ai" : "none");
  const [recovered, setRecovered] = useState<string | null>(null);

  const rev = useRef(chapter?.revision ?? 1);
  const dirty = useRef(false);
  const inflight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef(title);
  const chapterId = chapter?.id;

  useEffect(() => { try { setDark(localStorage.getItem("cowriter-dark") === "1"); } catch {} }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, TextStyle, FontFamily, FontSize, TextAlign.configure({ types: ["heading", "paragraph"] })],
    content: chapter?.content ?? "",
    editorProps: { attributes: { "aria-label": "Manuscript", "data-placeholder": "Start writing…" } },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setWords(countWords(html));
      setChars(htmlToText(html).replace(/\s/g, "").length);
      markDirty(html);
    },
  });

  // ---- Autosave -------------------------------------------------------
  const save = useCallback(async () => {
    if (!editor || !chapterId || inflight.current || !dirty.current) return;
    inflight.current = true;
    dirty.current = false;
    setStatus("saving");
    const html = editor.getHTML();
    try {
      const r = await fetch(`/api/chapters/${chapterId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: html, title: titleRef.current, revision: rev.current }), keepalive: html.length < 60000 });
      const d = await r.json().catch(() => ({}));
      if (r.status === 409) { setStatus("conflict"); setErrMsg(d.error ?? "This chapter changed elsewhere."); dirty.current = true; return; }
      if (!r.ok) throw new Error(d.error ?? "Save failed");
      rev.current = d.revision;
      setSavedAt(new Date(d.savedAt));
      setList((l) => l.map((c) => (c.id === chapterId ? { ...c, title: titleRef.current, wordCount: d.wordCount } : c)));
      if (!dirty.current) { setStatus("saved"); try { localStorage.removeItem(draftKey(chapterId)); } catch {} }
    } catch (e) {
      dirty.current = true;
      setStatus("error"); setErrMsg(e instanceof Error ? e.message : "Could not reach the server.");
      setTimeout(() => save(), 5000); // keep retrying; the local backup protects the text meanwhile
    } finally {
      inflight.current = false;
      if (dirty.current && status !== "conflict") schedule();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, chapterId]);

  function schedule() { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(save, 1200); }
  function markDirty(html?: string) {
    dirty.current = true;
    setStatus((s) => (s === "conflict" ? s : "unsaved"));
    if (chapterId && html !== undefined) { try { localStorage.setItem(draftKey(chapterId), JSON.stringify({ html, title: titleRef.current, rev: rev.current, at: Date.now() })); } catch {} }
    schedule();
  }

  // Recover a local backup if a previous session ended before the server confirmed the save.
  useEffect(() => {
    if (!chapterId || !chapter) return;
    try {
      const raw = localStorage.getItem(draftKey(chapterId));
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.html && d.html !== chapter.content && d.rev === chapter.revision) setRecovered(d.html);
      else localStorage.removeItem(draftKey(chapterId));
    } catch {}
  }, [chapterId, chapter]);

  useEffect(() => {
    if (editor) { const h = editor.getHTML(); setWords(countWords(h)); setChars(htmlToText(h).replace(/\s/g, "").length); }
  }, [editor]);

  useEffect(() => {
    const flush = () => { if (document.visibilityState === "hidden") save(); };
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ""; } };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("beforeunload", warn);
    return () => { document.removeEventListener("visibilitychange", flush); window.removeEventListener("beforeunload", warn); };
  }, [save]);

  async function goTo(id: string) {
    if (timer.current) clearTimeout(timer.current);
    await save();
    if (dirty.current) { if (!confirm("Your latest changes are not saved yet. Leave anyway? A local backup is kept on this device.")) return; }
    router.push(`/studio/${project.id}?chapter=${id}`);
  }

  // ---- Chapters -------------------------------------------------------
  async function addChapter() {
    await save();
    const r = await fetch(`/api/projects/${project.id}/chapters`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) router.push(`/studio/${project.id}?chapter=${d.id}`); else alert(d.error ?? "Could not add a chapter.");
  }
  async function deleteChapter() {
    if (!chapter || list.length < 2) return;
    if (!confirm(`Delete "${title}" and its version history? This cannot be undone.`)) return;
    const r = await fetch(`/api/chapters/${chapter.id}`, { method: "DELETE" });
    if (r.ok) { dirty.current = false; router.push(`/studio/${project.id}`); } else alert("Could not delete the chapter.");
  }
  async function move(id: string, dir: -1 | 1) {
    const i = list.findIndex((c) => c.id === id), j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]];
    setList(next);
    const r = await fetch(`/api/projects/${project.id}/chapters`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: next.map((c) => c.id) }) });
    if (!r.ok) { setList(list); alert("Could not reorder. Please refresh."); }
  }
  function onTitle(v: string) { setTitle(v); titleRef.current = v; setList((l) => l.map((c) => (c.id === chapterId ? { ...c, title: v } : c))); markDirty(editor?.getHTML()); }

  const bg = dark ? "bg-[#17112b] text-[#ece8fa]" : "bg-cream text-ink";
  const panelBg = dark ? "bg-[#211a3a] border-[#33294f]" : "bg-white border-lavender";
  const total = list.reduce((s, c) => s + c.wordCount, 0);

  if (!chapter) return (
    <div className="grid min-h-screen place-items-center"><div className="text-center"><p>This project has no chapters yet.</p><button onClick={addChapter} className="mt-4 rounded-xl bg-electric px-5 py-2 font-semibold text-white">Add the first chapter</button></div></div>
  );

  return (
    <div className={`flex min-h-screen flex-col pb-20 md:pb-0 ${bg}`}>
      <header className={`flex flex-wrap items-center gap-3 border-b px-4 py-2.5 ${panelBg}`}>
        <Link href="/projects" className="text-sm opacity-70 hover:opacity-100">← Projects</Link>
        <span className="font-semibold">{project.title}</span>
        <StatusPill status={status} savedAt={savedAt} errMsg={errMsg} />
        <div className="ml-auto flex flex-wrap items-center gap-1 text-sm">
          <span className="mr-2 opacity-70" aria-live="polite">{words.toLocaleString()} words · {chars.toLocaleString()} characters</span>
          <span className="hidden items-center gap-1 md:flex">
            <Btn onClick={() => setPanel(panel === "ai" ? "none" : "ai")} on={panel === "ai"}>AI</Btn>
            <Btn onClick={() => setPanel(panel === "find" ? "none" : "find")} on={panel === "find"}>Find</Btn>
            <Btn onClick={() => setPanel(panel === "history" ? "none" : "history")} on={panel === "history"}>History</Btn>
            <ToolLinks projectId={project.id} chapterId={chapter.id} />
          </span>
          <Btn onClick={() => { const v = !dark; setDark(v); try { localStorage.setItem("cowriter-dark", v ? "1" : "0"); } catch {} }}>{dark ? "Light" : "Dark"}</Btn>
          <span className="hidden md:inline"><Btn on={focus} onClick={() => { const v = !focus; setFocus(v); if (v) document.documentElement.requestFullscreen?.().catch(() => {}); else if (document.fullscreenElement) document.exitFullscreen(); }}>{focus ? "Exit full screen" : "Full screen"}</Btn></span>
        </div>
      </header>

      {(status === "conflict" || status === "error") && (
        <div role="alert" className="flex flex-wrap items-center gap-3 bg-red-50 px-4 py-2 text-sm text-red-800">
          <span>{status === "conflict" ? errMsg : `Not saved yet: ${errMsg}. Your text is backed up on this device and we will keep retrying.`}</span>
          {status === "conflict" && <button className="rounded-lg bg-red-700 px-3 py-1 text-white" onClick={() => location.reload()}>Reload latest</button>}
        </div>
      )}
      {recovered && (
        <div role="status" className="flex flex-wrap items-center gap-3 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span>Unsaved text from your last session was found on this device.</span>
          <button className="rounded-lg bg-amber-700 px-3 py-1 text-white" onClick={() => { editor?.commands.setContent(recovered); setRecovered(null); markDirty(recovered); }}>Restore it</button>
          <button className="rounded-lg px-3 py-1 underline" onClick={() => { try { localStorage.removeItem(draftKey(chapter.id)); } catch {} setRecovered(null); }}>Discard</button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {!focus && (
          <nav aria-label="Chapters" className={`border-b p-3 md:w-64 md:shrink-0 md:border-b-0 md:border-r ${panelBg}`}>
            <p className="px-2 pb-2 text-xs uppercase tracking-wide opacity-60">Chapters · {total.toLocaleString()} words</p>
            <ol className="max-h-48 space-y-0.5 overflow-y-auto md:max-h-none">
              {list.map((c, i) => (
                <li key={c.id} className={`group flex items-center rounded-lg ${c.id === chapter.id ? (dark ? "bg-[#33294f]" : "bg-lavender") : ""}`}>
                  <button onClick={() => goTo(c.id)} aria-current={c.id === chapter.id ? "page" : undefined} className="min-w-0 flex-1 px-2.5 py-2 text-left text-sm">
                    <span className="block truncate font-medium">{c.title || "Untitled"}</span><span className="text-xs opacity-60">{c.wordCount.toLocaleString()} words</span>
                  </button>
                  <span className="flex pr-1 opacity-60 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                    <button aria-label={`Move ${c.title} up`} disabled={i === 0} onClick={() => move(c.id, -1)} className="px-1 disabled:opacity-20">↑</button>
                    <button aria-label={`Move ${c.title} down`} disabled={i === list.length - 1} onClick={() => move(c.id, 1)} className="px-1 disabled:opacity-20">↓</button>
                  </span>
                </li>
              ))}
            </ol>
            <button onClick={addChapter} className="mt-3 w-full rounded-lg border border-dashed border-electric/50 py-2 text-sm text-electric hover:bg-electric/10">+ Add chapter</button>
            {list.length > 1 && <button onClick={deleteChapter} className="mt-2 w-full rounded-lg py-1.5 text-xs opacity-60 hover:text-red-600 hover:opacity-100">Delete this chapter</button>}
          </nav>
        )}

        <main className="min-w-0 flex-1">
          <Toolbar editor={editor} dark={dark} />
          <div className="mx-auto max-w-3xl px-5 py-8">
            <input value={title} onChange={(e) => onTitle(e.target.value)} aria-label="Chapter title" maxLength={200} className="mb-6 w-full bg-transparent text-3xl font-bold outline-none placeholder:opacity-40" placeholder="Chapter title" />
            <div className="manuscript"><EditorContent editor={editor} /></div>
          </div>
        </main>

        {panel === "history" && <History chapterId={chapter.id} dark={dark} panelBg={panelBg} onRestore={(v, r) => { editor?.commands.setContent(v.content); setTitle(v.title); titleRef.current = v.title; rev.current = r.revision; dirty.current = false; setStatus("saved"); setSavedAt(new Date(r.savedAt)); setWords(r.wordCount); setList((l) => l.map((c) => (c.id === chapter.id ? { ...c, title: v.title, wordCount: r.wordCount } : c))); }} saveBefore={save} />}
        {panel === "ai" && editor && <AiPanel editor={editor} projectId={project.id} chapterId={chapter.id} panelBg={panelBg} dark={dark} onChanged={() => markDirty(editor.getHTML())} />}
        {panel === "find" && editor && <Find editor={editor} panelBg={panelBg} />}
      </div>
      <nav aria-label="Studio actions" className={`pb-safe fixed inset-x-0 bottom-0 z-30 border-t md:hidden ${panelBg}`}>
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {([["AI", "ai"], ["Find", "find"], ["History", "history"]] as const).map(([l, k]) => (
            <li key={k}><button onClick={() => setPanel(panel === k ? "none" : k)} aria-pressed={panel === k} className={`min-h-14 w-full text-sm font-medium ${panel === k ? "text-electric" : ""}`}>{l}</button></li>))}
          <li className="relative"><ToolLinks projectId={project.id} chapterId={chapter.id} up /></li>
        </ul>
      </nav>
    </div>
  );
}

function ToolLinks({ projectId, chapterId, up }: { projectId: string; chapterId: string; up?: boolean }) {
  const links: Array<[string, string]> = [["Story Bible", `/bible?project=${projectId}`], ["Story Guard", `/guard?project=${projectId}&chapter=${chapterId}`], ["Chapter Analyser", `/analyser?project=${projectId}&chapter=${chapterId}`], ["Export", `/library?project=${projectId}`], ["Dashboard", "/dashboard"]];
  return (
    <details className="relative">
      <summary className={`flex cursor-pointer list-none items-center justify-center rounded-lg px-3 ${up ? "min-h-14 text-sm font-medium" : "py-1.5 hover:bg-electric/10"}`}>Tools</summary>
      <ul className={`absolute right-0 z-40 w-52 rounded-xl border border-line bg-white p-1 text-ink shadow-xl ${up ? "bottom-full mb-2" : "top-full mt-1"}`}>
        {links.map(([l, h]) => <li key={l}><Link href={h} className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-lavender">{l}</Link></li>)}
      </ul>
    </details>
  );
}

function Btn({ children, onClick, on }: { children: React.ReactNode; onClick: () => void; on?: boolean }) {
  return <button onClick={onClick} aria-pressed={on} className={`rounded-lg px-3 py-1.5 ${on ? "bg-electric text-white" : "hover:bg-electric/10"}`}>{children}</button>;
}

function StatusPill({ status, savedAt, errMsg }: { status: Status; savedAt: Date | null; errMsg: string }) {
  const map: Record<Status, [string, string]> = { saved: ["Saved", "bg-green-100 text-green-800"], saving: ["Saving…", "bg-amber-100 text-amber-800"], unsaved: ["Unsaved changes", "bg-amber-100 text-amber-800"], error: ["Not saved", "bg-red-100 text-red-800"], conflict: ["Out of date", "bg-red-100 text-red-800"] };
  const [label, cls] = map[status];
  return <span role="status" title={status === "error" || status === "conflict" ? errMsg : ""} className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>{label}{status === "saved" && savedAt ? ` · ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</span>;
}

function Toolbar({ editor, dark }: { editor: Editor | null; dark: boolean }) {
  if (!editor) return <div className="h-12" />;
  const b = (label: string, active: boolean, run: () => void, aria: string) => (
    <button key={aria} type="button" aria-label={aria} aria-pressed={active} onMouseDown={(e) => e.preventDefault()} onClick={run} className={`min-w-8 rounded-md px-2 py-1 text-sm ${active ? "bg-electric text-white" : "hover:bg-electric/10"}`}>{label}</button>
  );
  const c = () => editor.chain().focus();
  const sel = "rounded-md border border-electric/20 bg-transparent px-1.5 py-1 text-sm";
  return (
    <div role="toolbar" aria-label="Formatting" className={`sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b px-3 py-1.5 ${dark ? "border-[#33294f] bg-[#211a3a]" : "border-lavender bg-white"}`}>
      {b("B", editor.isActive("bold"), () => c().toggleBold().run(), "Bold")}
      {b("I", editor.isActive("italic"), () => c().toggleItalic().run(), "Italic")}
      {b("U", editor.isActive("underline"), () => c().toggleUnderline().run(), "Underline")}
      <span className="mx-1 h-5 w-px bg-electric/20" />
      {b("H1", editor.isActive("heading", { level: 1 }), () => c().toggleHeading({ level: 1 }).run(), "Heading 1")}
      {b("H2", editor.isActive("heading", { level: 2 }), () => c().toggleHeading({ level: 2 }).run(), "Heading 2")}
      {b("H3", editor.isActive("heading", { level: 3 }), () => c().toggleHeading({ level: 3 }).run(), "Heading 3")}
      {b("¶", editor.isActive("paragraph"), () => c().setParagraph().run(), "Paragraph")}
      <span className="mx-1 h-5 w-px bg-electric/20" />
      {b("Left", editor.isActive({ textAlign: "left" }), () => c().setTextAlign("left").run(), "Align left")}
      {b("Center", editor.isActive({ textAlign: "center" }), () => c().setTextAlign("center").run(), "Align centre")}
      {b("Right", editor.isActive({ textAlign: "right" }), () => c().setTextAlign("right").run(), "Align right")}
      {b("Justify", editor.isActive({ textAlign: "justify" }), () => c().setTextAlign("justify").run(), "Justify")}
      <span className="mx-1 h-5 w-px bg-electric/20" />
      {b("• List", editor.isActive("bulletList"), () => c().toggleBulletList().run(), "Bulleted list")}
      {b("1. List", editor.isActive("orderedList"), () => c().toggleOrderedList().run(), "Numbered list")}
      {b("Quote", editor.isActive("blockquote"), () => c().toggleBlockquote().run(), "Block quote")}
      <span className="mx-1 h-5 w-px bg-electric/20" />
      <select aria-label="Font" className={sel} value={(editor.getAttributes("textStyle").fontFamily as string) ?? ""} onChange={(e) => (e.target.value ? c().setFontFamily(e.target.value).run() : c().unsetFontFamily().run())}>
        {FONTS.map(([l, v]) => <option key={l} value={v}>{l}</option>)}
      </select>
      <select aria-label="Font size" className={sel} value={(editor.getAttributes("textStyle").fontSize as string) ?? ""} onChange={(e) => (e.target.value ? c().setFontSize(e.target.value).run() : c().unsetFontSize().run())}>
        <option value="">Size</option>{SIZES.map((s) => <option key={s} value={s}>{s.replace("px", "")}</option>)}
      </select>
      <span className="mx-1 h-5 w-px bg-electric/20" />
      {b("Undo", false, () => c().undo().run(), "Undo")}
      {b("Redo", false, () => c().redo().run(), "Redo")}
    </div>
  );
}

function History({ chapterId, dark, panelBg, onRestore, saveBefore }: { chapterId: string; dark: boolean; panelBg: string; saveBefore: () => Promise<void>; onRestore: (v: Version, r: { revision: number; savedAt: string; wordCount: number }) => void }) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const r = await fetch(`/api/chapters/${chapterId}/versions`);
    setVersions(r.ok ? await r.json() : []);
  }, [chapterId]);
  useEffect(() => { saveBefore().then(load); }, [load, saveBefore]);

  async function checkpoint() {
    await saveBefore();
    const r = await fetch(`/api/chapters/${chapterId}/versions`, { method: "POST" });
    setMsg(r.ok ? "Version saved." : "Could not save a version."); if (r.ok) load();
  }
  async function restore(v: Version) {
    if (!confirm(`Restore the version from ${new Date(v.createdAt).toLocaleString()}?\n\nYour current text is saved as a version first, so you can switch back.`)) return;
    await saveBefore();
    const r = await fetch(`/api/chapters/${chapterId}/versions/${v.id}/restore`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(d.error ?? "Could not restore."); return; }
    onRestore(v, d); setMsg("Restored. Your previous text is in the list."); load();
  }
  const label: Record<string, string> = { auto: "Autosave", manual: "Saved by you", before_restore: "Before a restore" };
  return (
    <aside aria-label="Version history" className={`border-t p-4 md:w-80 md:shrink-0 md:overflow-y-auto md:border-l md:border-t-0 ${panelBg}`}>
      <div className="flex items-center justify-between"><h2 className="font-semibold">Version history</h2><button onClick={checkpoint} className="rounded-lg bg-electric px-3 py-1 text-xs font-semibold text-white">Save version now</button></div>
      {msg && <p role="status" className="mt-2 text-xs text-electric">{msg}</p>}
      {versions === null ? <p className="mt-4 text-sm opacity-60">Loading…</p> : versions.length === 0 ? <p className="mt-4 text-sm opacity-60">No versions yet. They are saved automatically as you write.</p> : (
        <ul className="mt-3 space-y-2">
          {versions.map((v) => (
            <li key={v.id} className={`rounded-xl border p-3 text-sm ${dark ? "border-[#33294f]" : "border-lavender"}`}>
              <p className="font-medium">{new Date(v.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
              <p className="text-xs opacity-60">{label[v.reason] ?? v.reason} · {v.wordCount.toLocaleString()} words</p>
              <div className="mt-2 flex gap-2">
                <button className="text-xs text-electric hover:underline" onClick={() => setOpen(open === v.id ? null : v.id)}>{open === v.id ? "Hide preview" : "Preview"}</button>
                <button className="text-xs text-coral hover:underline" onClick={() => restore(v)}>Restore</button>
              </div>
              {open === v.id && <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-line rounded-lg bg-electric/5 p-2 text-xs">{htmlToText(v.content).slice(0, 3000) || "(empty)"}</p>}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function Find({ editor, panelBg }: { editor: Editor; panelBg: string }) {
  const [q, setQ] = useState("");
  const [rep, setRep] = useState("");
  const [idx, setIdx] = useState(0);
  const [info, setInfo] = useState("");

  const matches = useCallback(() => {
    const out: Array<{ from: number; to: number }> = [];
    if (!q) return out;
    const needle = q.toLowerCase();
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      const hay = node.text.toLowerCase();
      for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) out.push({ from: pos + i, to: pos + i + needle.length });
    });
    return out;
  }, [editor, q]);

  function go(dir: 1 | -1) {
    const m = matches();
    if (!m.length) { setInfo(q ? "No matches" : ""); return; }
    const n = (idx + dir + m.length) % m.length; setIdx(n);
    editor.chain().focus().setTextSelection(m[n]).scrollIntoView().run();
    setInfo(`${n + 1} of ${m.length}`);
  }
  function replaceOne() {
    const m = matches(); if (!m.length) return;
    const cur = m[Math.min(idx, m.length - 1)];
    editor.chain().focus().insertContentAt(cur, rep).run();
    setInfo(`Replaced 1. ${Math.max(0, m.length - 1)} left`);
  }
  function replaceAll() {
    const m = matches(); if (!m.length) return;
    if (!confirm(`Replace all ${m.length} matches of "${q}"? You can undo with Undo, and a version is kept in History.`)) return;
    const chain = editor.chain().focus();
    for (const r of [...m].reverse()) chain.insertContentAt(r, rep);
    chain.run(); setInfo(`Replaced ${m.length}`);
  }
  const inp = "w-full rounded-lg border border-electric/20 bg-transparent px-2.5 py-1.5 text-sm";
  return (
    <aside aria-label="Find and replace" className={`space-y-2 border-t p-4 md:w-72 md:shrink-0 md:border-l md:border-t-0 ${panelBg}`}>
      <h2 className="font-semibold">Find and replace</h2>
      <input value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); setInfo(""); }} onKeyDown={(e) => e.key === "Enter" && go(e.shiftKey ? -1 : 1)} placeholder="Find" aria-label="Find" className={inp} />
      <input value={rep} onChange={(e) => setRep(e.target.value)} placeholder="Replace with" aria-label="Replace with" className={inp} />
      <div className="flex flex-wrap gap-1.5 text-xs">
        <button onClick={() => go(-1)} className="rounded-md bg-electric/10 px-2.5 py-1">Previous</button>
        <button onClick={() => go(1)} className="rounded-md bg-electric/10 px-2.5 py-1">Next</button>
        <button onClick={replaceOne} className="rounded-md bg-electric/10 px-2.5 py-1">Replace</button>
        <button onClick={replaceAll} className="rounded-md bg-electric px-2.5 py-1 text-white">Replace all</button>
      </div>
      <p role="status" className="text-xs opacity-70">{info}</p>
    </aside>
  );
}
