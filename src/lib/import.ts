/** Turns an uploaded or pasted manuscript into chapters. Nothing is rewritten: text is only cleaned into paragraphs and split at headings. */
export interface Piece { kind: "h" | "p"; html: string; text: string }
export interface ImportedChapter { title: string; content: string; words: number }

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // stays under the host's request limit
export const MAX_CHAPTERS = 300;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const strip = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
const CHAPTER_RE = /^(chapter|part|book|act)\s+([0-9]+|[ivxlcdm]+|[a-z-]+)\b[\s:.\-—–]*(.*)$/i;
const SPECIAL_RE = /^(prologue|epilogue|preface|introduction|foreword|afterword|acknowledg(e)?ments?|author'?s note)$/i;
export const looksLikeHeading = (t: string) => t.length > 0 && t.length <= 80 && (CHAPTER_RE.test(t) || SPECIAL_RE.test(t));

/** Plain text / Markdown -> pieces. Blank lines separate paragraphs; "# Title" lines and "Chapter N" lines are headings. */
export function textToPieces(raw: string, markdown = false): Piece[] {
  const out: Piece[] = [];
  const paras = raw.replace(/\r\n?/g, "\n").replace(/ /g, " ").split(/\n{2,}/);
  for (const para of paras) {
    const lines = para.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    if (!lines.length) continue;
    // A heading-looking first line followed by body text in the same block is split off.
    const first = lines[0].trim();
    const md = markdown ? first.match(/^#{1,3}\s+(.+?)\s*#*$/) : null;
    if (md || (lines.length === 1 && looksLikeHeading(first)) || (lines.length > 1 && looksLikeHeading(first) && !/[.!?"”]$/.test(first))) {
      const title = (md ? md[1] : first).replace(/[*_`]/g, "");
      out.push({ kind: "h", html: esc(title), text: title });
      lines.shift();
      if (!lines.length) continue;
    }
    const joined = lines.join(markdown ? "\n" : "\n").trim();
    const html = inline(esc(joined), markdown).replace(/\n/g, "<br>");
    out.push({ kind: "p", html, text: strip(html) });
  }
  return out;
}
const inline = (h: string, md: boolean) => (md ? h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>").replace(/(^|\s)_(.+?)_(?=\s|[.,;!?]|$)/g, "$1<em>$2</em>") : h);

/** Word's HTML (from mammoth) -> pieces, keeping only simple formatting. */
export function htmlToPieces(html: string): Piece[] {
  const out: Piece[] = [];
  const re = /<(p|h[1-6]|blockquote)(?:\s[^>]*)?>([\s\S]*?)<\/\1>|<(ul|ol)(?:\s[^>]*)?>([\s\S]*?)<\/\3>/gi;
  let m: RegExpExecArray | null;
  const clean = (h: string) => h.replace(/<(?!\/?(strong|em|u|br)\b)[^>]*>/gi, "").replace(/<(strong|em|u)\b[^>]*>/gi, "<$1>").replace(/<br[^>]*>/gi, "<br>");
  while ((m = re.exec(html))) {
    if (m[3]) { const items = [...m[4].matchAll(/<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/gi)].map((x) => `<li><p>${clean(x[1])}</p></li>`).join(""); if (strip(items)) out.push({ kind: "p", html: `<${m[3].toLowerCase()}>${items}</${m[3].toLowerCase()}>`, text: strip(items) }); continue; }
    const tag = m[1].toLowerCase(); const inner = clean(m[2]); const text = strip(inner);
    if (!text) continue;
    if (/^h[1-6]$/.test(tag)) out.push({ kind: "h", html: esc(text), text });
    else if (tag === "blockquote") out.push({ kind: "p", html: `<blockquote><p>${inner}</p></blockquote>`, text });
    else if (looksLikeHeading(text) && text.length < 60) out.push({ kind: "h", html: esc(text), text });
    else out.push({ kind: "p", html: `<p>${inner}</p>`, text });
  }
  return out;
}

const wrapP = (p: Piece) => (p.html.startsWith("<") ? p.html : `<p>${p.html}</p>`);
const words = (html: string) => (strip(html).match(/\S+/g) ?? []).length;

/** Splits pieces into chapters at headings. mode "single" keeps everything as one chapter. */
export function splitChapters(pieces: Piece[], mode: "auto" | "single", fallbackTitle: string): ImportedChapter[] {
  const make = (title: string, body: Piece[]): ImportedChapter => { const content = body.map(wrapP).join(""); return { title: title.slice(0, 150) || "Untitled chapter", content, words: words(content) }; };
  if (mode === "single" || !pieces.some((p) => p.kind === "h")) return [make(fallbackTitle, pieces)];
  const chapters: ImportedChapter[] = [];
  let title = ""; let body: Piece[] = []; let started = false;
  const flush = () => { if (!started && !body.length) return; if (!started) { const c = make("Beginning", body); if (c.words) chapters.push(c); } else if (body.length || title) chapters.push(make(title, body)); };
  for (const p of pieces) {
    if (p.kind === "h") { flush(); title = p.text; body = []; started = true; }
    else body.push(p);
  }
  flush();
  // a heading with nothing under it (e.g. a "Part One" divider) folds into the next chapter's title
  const merged: ImportedChapter[] = [];
  let carry = "";
  for (const c of chapters) {
    if (c.words === 0) { carry = carry ? `${carry} · ${c.title}` : c.title; continue; }
    merged.push(carry ? { ...c, title: `${carry} · ${c.title}`.slice(0, 150) } : c); carry = "";
  }
  return merged.length ? merged : [make(fallbackTitle, pieces)];
}

export type FileKind = "docx" | "pdf" | "txt" | "md";
export function kindOf(name: string): FileKind | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return ext === "docx" ? "docx" : ext === "pdf" ? "pdf" : ext === "md" || ext === "markdown" ? "md" : ext === "txt" || ext === "text" ? "txt" : null;
}

/** Re-flow PDF text lines into paragraphs: short lines that end a sentence close a paragraph. */
export function pdfTextToPieces(raw: string): Piece[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim());
  const max = Math.max(1, ...lines.map((l) => l.length));
  const paras: string[] = []; let cur = "";
  for (const l of lines) {
    if (!l) { if (cur) paras.push(cur); cur = ""; continue; }
    if (looksLikeHeading(l)) { if (cur) paras.push(cur); paras.push(l); cur = ""; continue; }
    cur = cur ? (cur.endsWith("-") && /^[a-z]/.test(l) ? cur.slice(0, -1) + l : `${cur} ${l}`) : l;
    if (l.length < max * 0.7 && /[.!?"”]$/.test(l)) { paras.push(cur); cur = ""; }
  }
  if (cur) paras.push(cur);
  return textToPieces(paras.join("\n\n"));
}

export async function parseFile(buf: Buffer, name: string): Promise<Piece[]> {
  const kind = kindOf(name);
  if (!kind) throw new Error("Unsupported file. Use .docx, .pdf, .txt or .md.");
  if (kind === "txt" || kind === "md") return textToPieces(buf.toString("utf8").replace(/^﻿/, ""), kind === "md");
  if (kind === "docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.convertToHtml({ buffer: buf }, { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) });
    return htmlToPieces(value);
  }
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  const t = (Array.isArray(text) ? text.join("\n") : text).trim();
  if (!t) throw new Error("This PDF has no selectable text (it may be scanned images). Export it as DOCX or TXT, or paste the text instead.");
  return pdfTextToPieces(t);
}
