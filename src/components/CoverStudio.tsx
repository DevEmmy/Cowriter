"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PALETTES, TEMPLATES, FONTS, coverSvg, defaultDesign, designSchema, type Design } from "@/lib/cover";

type Saved = { id: string; name: string; design: Design };
const TLABEL: Record<string, string> = { bold: "Bold", frame: "Framed", split: "Split", circle: "Circle", minimal: "Minimal", waves: "Waves" };

async function api(url: string, method = "GET", body?: unknown) {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? "Something went wrong.");
  return d;
}
const download = (href: string, name: string) => { const a = document.createElement("a"); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };

export default function CoverStudio({ projectId, title, author }: { projectId: string; title: string; author: string }) {
  const [d, setD] = useState<Design>(defaultDesign(title, author));
  const [saved, setSaved] = useState<Saved[]>([]), [name, setName] = useState("My cover");
  const [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [concept, setConcept] = useState("");
  const [genre, setGenre] = useState(""), [mood, setMood] = useState("");
  const svg = useMemo(() => coverSvg(d), [d]);
  const set = <K extends keyof Design>(k: K, v: Design[K]) => setD((x) => ({ ...x, [k]: v }));
  const fail = (e: unknown) => { setErr((e as Error).message); setMsg(""); };

  const load = useCallback(async () => { try { setSaved((await api(`/api/projects/${projectId}/covers`)).covers); } catch (e) { fail(e); } }, [projectId]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setErr(""); const ok = designSchema.safeParse(d); if (!ok.success) return setErr("Add a title first.");
    try { await api(`/api/projects/${projectId}/covers`, "POST", { name, design: d }); setMsg("Saved."); load(); } catch (e) { fail(e); }
  }
  async function del(c: Saved) { if (!confirm(`Delete the saved cover "${c.name}"?`)) return; try { await api(`/api/covers/${c.id}`, "DELETE"); load(); } catch (e) { fail(e); } }
  async function suggest() {
    setBusy(true); setErr(""); setConcept("");
    try { const { suggestion: s } = await api(`/api/projects/${projectId}/covers/suggest`, "POST", { genre, mood }); setD((x) => ({ ...x, template: s.template, palette: s.palette, font: s.font, tagline: x.tagline || s.tagline })); setConcept(s.concept); } catch (e) { fail(e); }
    setBusy(false);
  }
  const slug = (d.title.replace(/[^\w ]+/g, "").trim().replace(/\s+/g, "-") || "cover").slice(0, 50);
  function svgFile() { download(URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })), `${slug}-cover.svg`); }
  function pngFile() {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = 1200; c.height = 1800;
      c.getContext("2d")!.drawImage(img, 0, 0, 1200, 1800);
      c.toBlob((b) => { if (b) download(URL.createObjectURL(b), `${slug}-cover.png`); else setErr("Could not create the image in this browser. Try the SVG download."); }, "image/png");
    };
    img.onerror = () => setErr("Could not create the image in this browser. Try the SVG download.");
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
      <div>
        <div className="mx-auto w-full max-w-xs overflow-hidden rounded-xl shadow-xl ring-1 ring-line" data-testid="cover-preview" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="mx-auto mt-4 grid max-w-xs grid-cols-2 gap-2">
          <button className="btn btn-primary" onClick={pngFile}>Download PNG</button>
          <button className="btn btn-secondary" onClick={svgFile}>Download SVG</button>
        </div>
      </div>

      <div className="space-y-5">
        <div role="status" aria-live="polite" className="min-h-6 text-sm">{msg && <span className="msg-ok">{msg}</span>}{err && <span role="alert" className="msg-err">{err}</span>}</div>
        <section className="card space-y-3">
          {([["title", "Title", 120], ["subtitle", "Subtitle", 160], ["author", "Author name", 80], ["tagline", "Tagline", 160]] as const).map(([k, l, max]) => (
            <label key={k} className="block text-sm font-medium">{l}<input value={d[k]} onChange={(e) => set(k, e.target.value)} maxLength={max} className="field mt-1" /></label>))}
        </section>
        <section className="card" aria-label="Layout">
          <h2 className="font-semibold">Layout</h2>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">{TEMPLATES.map((t) => <button key={t} aria-pressed={d.template === t} onClick={() => set("template", t)} className={`btn !px-2 ${d.template === t ? "btn-primary" : "btn-secondary"}`}>{TLABEL[t]}</button>)}</div>
          <h2 className="mt-4 font-semibold">Colours</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(PALETTES).map(([k, p]) => (
            <button key={k} aria-pressed={d.palette === k} onClick={() => set("palette", k)} className={`flex min-h-11 items-center gap-2 rounded-xl border-2 px-2 text-left text-sm ${d.palette === k ? "border-electric bg-lavender" : "border-line bg-white"}`}>
              <span aria-hidden className="h-6 w-6 shrink-0 rounded-full" style={{ background: `linear-gradient(135deg, ${p.bg1}, ${p.bg2})`, boxShadow: `inset 0 0 0 3px ${p.accent}` }} />{p.name}</button>))}</div>
          <h2 className="mt-4 font-semibold">Lettering</h2>
          <div className="mt-2 grid grid-cols-3 gap-2">{FONTS.map((f) => <button key={f} aria-pressed={d.font === f} onClick={() => set("font", f)} className={`btn ${d.font === f ? "btn-primary" : "btn-secondary"}`}>{f === "serif" ? "Classic" : f === "sans" ? "Modern" : "Strong"}</button>)}</div>
        </section>

        <section className="card" aria-label="AI suggestion">
          <h2 className="font-semibold">Suggest a look</h2>
          <p className="text-sm text-muted">Co Writer picks a layout, colours and a tagline from your story. It does not generate artwork, and you can change everything.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2"><input aria-label="Genre" placeholder="Genre (optional)" value={genre} onChange={(e) => setGenre(e.target.value)} className="field" /><input aria-label="Mood" placeholder="Mood (optional)" value={mood} onChange={(e) => setMood(e.target.value)} className="field" /></div>
          <button className="btn btn-secondary mt-3" onClick={suggest} disabled={busy}>{busy ? "Thinking…" : "Suggest a look"}</button>
          {concept && <p className="mt-2 text-sm">{concept}</p>}
        </section>

        <section className="card" aria-label="Saved covers">
          <h2 className="font-semibold">Save this design</h2>
          <div className="mt-2 flex flex-wrap gap-2"><input aria-label="Design name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="field min-w-0 flex-1" /><button className="btn btn-primary" onClick={save} disabled={!name.trim()}>Save</button></div>
          {saved.length > 0 && <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{saved.map((c) => (
            <li key={c.id} className="space-y-2"><button onClick={() => setD(c.design)} aria-label={`Open ${c.name}`} className="block w-full overflow-hidden rounded-lg ring-1 ring-line" dangerouslySetInnerHTML={{ __html: coverSvg(c.design) }} />
              <div className="flex items-center justify-between gap-1 text-sm"><span className="truncate font-medium">{c.name}</span><button className="btn btn-danger !min-h-9 !px-3" onClick={() => del(c)} aria-label={`Delete ${c.name}`}>Delete</button></div></li>))}</ul>}
        </section>
      </div>
    </div>
  );
}
