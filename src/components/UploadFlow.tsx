"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX = 5 * 1024 * 1024;
const OK = ["pdf", "docx", "pptx"];
const fmt = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

export default function UploadFlow() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [fatal, setFatal] = useState("");

  function add(list: FileList | File[]) {
    const errs: string[] = [];
    const next = [...files];
    for (const f of Array.from(list)) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!OK.includes(ext)) errs.push(`${f.name}: only PDF, DOCX and PPTX are supported.`);
      else if (f.size > MAX) errs.push(`${f.name}: larger than 5 MB (${fmt(f.size)}).`);
      else if (f.size === 0) errs.push(`${f.name}: file is empty.`);
      else if (!next.some((n) => n.name === f.name && n.size === f.size)) next.push(f);
    }
    setFiles(next);
    setErrors(errs);
  }

  async function start() {
    setBusy(true); setFatal("");
    try {
      setStatus("Creating project…");
      const title = files[0].name.replace(/\.[^.]+$/, "") + (files.length > 1 ? ` +${files.length - 1}` : "");
      const pr = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
      if (!pr.ok) throw new Error((await pr.json()).error ?? "Could not create the project.");
      const { id } = await pr.json();

      for (let i = 0; i < files.length; i++) {
        setStatus(`Uploading document ${i + 1} of ${files.length}…`);
        const fd = new FormData(); fd.append("file", files[i]);
        const r = await fetch(`/api/projects/${id}/documents`, { method: "POST", body: fd });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `Upload failed for ${files[i].name}.`);
      }

      for (let guard = 0; guard < 2000; guard++) {
        const r = await fetch(`/api/projects/${id}/extract`, { method: "POST" });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.error) throw new Error(d.error ?? "Extraction failed.");
        if (d.done) break;
        setStatus(d.phase === "ocr" ? `Reading scanned page ${d.current} of ${d.total} in ${d.file}…` : `Extracting content from ${d.file}: ${d.current} of ${d.total} ${d.total > 1 ? "pages" : "document"}…`);
      }
      router.push(`/project/${id}`);
    } catch (e) {
      setFatal(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) add(e.dataTransfer.files); }}
        className={`rounded-2xl border-2 border-dashed p-12 text-center transition ${drag ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white"}`}
      >
        <p className="font-medium text-slate-900">Drag and drop your documents here</p>
        <p className="mt-1 text-sm text-slate-500">PDF, DOCX or PPTX, up to 5 MB each</p>
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="mt-5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Browse files</button>
        <input ref={input} type="file" multiple accept=".pdf,.docx,.pptx" className="hidden" onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
      </div>
      {errors.length > 0 && <ul role="alert" className="mt-4 space-y-1 rounded-lg bg-red-50 p-3 text-sm text-red-700">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      {files.length > 0 && (
        <ul className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {files.map((f) => (
            <li key={f.name + f.size} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="truncate text-slate-900">{f.name} <span className="text-slate-500">· {fmt(f.size)}</span></span>
              {!busy && <button onClick={() => setFiles(files.filter((x) => x !== f))} className="ml-4 text-slate-500 hover:text-red-600" aria-label={`Remove ${f.name}`}>Remove</button>}
            </li>
          ))}
        </ul>
      )}
      {fatal && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{fatal}</p>}
      {busy && <p role="status" className="mt-4 text-sm text-slate-600">{status}</p>}
      <button disabled={!files.length || busy} onClick={start} className="mt-6 w-full rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {busy ? "Working…" : "Extract content"}
      </button>
    </div>
  );
}
