import { AlignmentType, Document, HeadingLevel, Packer, PageBreak, Paragraph, TextRun } from "docx";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { type Block, blockText, htmlToBlocks } from "./blocks";
import { FONT_BOLD, FONT_BOLDITALIC, FONT_ITALIC, FONT_REGULAR } from "./fonts";

export interface ExportChapter { title: string; content: string }
export interface ExportInput { title: string; author: string; chapters: ExportChapter[] }

// ---------- TXT ----------
export function toTxt({ title, author, chapters }: ExportInput): string {
  const out: string[] = [title.toUpperCase(), author && `by ${author}`, ""].filter((x) => x !== undefined) as string[];
  for (const c of chapters) {
    out.push("", "", c.title || "Untitled", "");
    for (const bl of htmlToBlocks(c.content)) {
      const t = blockText(bl).trim();
      out.push(bl.type === "hr" ? "* * *" : bl.type === "li" ? `${bl.ordered ? `${bl.ordered}.` : "-"} ${t}` : bl.type === "quote" ? `    ${t}` : t, "");
    }
  }
  return out.join("\n").replace(/\n{4,}/g, "\n\n\n").trim() + "\n";
}

// ---------- DOCX ----------
const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED } as const;
const runs = (bl: Block) => bl.runs.map((r) => (r.text === "\n" ? new TextRun({ break: 1 }) : new TextRun({ text: r.text, bold: r.bold, italics: r.italic, underline: r.underline ? {} : undefined })));

export async function toDocx({ title, author, chapters }: ExportInput): Promise<Buffer> {
  const kids: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { before: 3600, after: 240 }, children: [new TextRun({ text: title })] }),
    ...(author ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: author, size: 28 })] })] : []),
  ];
  chapters.forEach((c, n) => {
    kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { after: 360 }, children: [new TextRun({ text: c.title || `Chapter ${n + 1}` })] }));
    for (const bl of htmlToBlocks(c.content)) {
      if (bl.type === "hr") kids.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("* * *")] }));
      else if (bl.type === "h1" || bl.type === "h2" || bl.type === "h3") kids.push(new Paragraph({ heading: bl.type === "h1" ? HeadingLevel.HEADING_2 : bl.type === "h2" ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4, children: runs(bl) }));
      else if (bl.type === "li") kids.push(new Paragraph({ bullet: bl.ordered ? undefined : { level: 0 }, children: [...(bl.ordered ? [new TextRun(`${bl.ordered}. `)] : []), ...runs(bl)] }));
      else if (bl.type === "quote") kids.push(new Paragraph({ indent: { left: 720 }, spacing: { after: 160 }, children: runs(bl).map((r) => r) }));
      else kids.push(new Paragraph({ alignment: bl.align ? ALIGN[bl.align] : undefined, spacing: { after: 160, line: 360 }, indent: { firstLine: 360 }, children: runs(bl) }));
    }
  });
  const doc = new Document({ creator: author || "Co Writer", title, styles: { default: { document: { run: { font: "Georgia", size: 24 } } } }, sections: [{ children: kids }] });
  void PageBreak;
  return Packer.toBuffer(doc);
}

// ---------- PDF ----------
const PAGE = { w: 432, h: 648, m: 54 }; // 6x9 inch trade paperback
const SIZE = 11.5, LEAD = 17;

export async function toPdf({ title, author, chapters }: ExportInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(title); pdf.setAuthor(author || ""); pdf.setCreator("Co Writer");
  const load = (b64: string) => pdf.embedFont(Buffer.from(b64, "base64"), { subset: true });
  const [reg, bold, ital, boldItal] = await Promise.all([load(FONT_REGULAR), load(FONT_BOLD), load(FONT_ITALIC), load(FONT_BOLDITALIC)]);
  const supported = new Set(reg.getCharacterSet());
  const clean = (s: string) => Array.from(s.replace(/ /g, " ").replace(/[​-‏﻿]/g, "")).map((ch) => (supported.has(ch.codePointAt(0)!) || ch === " " ? ch : "?")).join("");
  const pick = (r: { bold?: boolean; italic?: boolean }): PDFFont => (r.bold && r.italic ? boldItal : r.bold ? bold : r.italic ? ital : reg);

  let page = pdf.addPage([PAGE.w, PAGE.h]), y = PAGE.h - PAGE.m;
  const body = PAGE.w - PAGE.m * 2;
  const fresh = () => { page = pdf.addPage([PAGE.w, PAGE.h]); y = PAGE.h - PAGE.m; };
  const ensure = (h: number) => { if (y - h < PAGE.m) fresh(); };
  const centered = (text: string, font: PDFFont, size: number, at: number) => { const w = font.widthOfTextAtSize(text, size); page.drawText(text, { x: (PAGE.w - w) / 2, y: at, size, font, color: rgb(0.12, 0.09, 0.22) }); };

  // title page
  const wrapPlain = (text: string, font: PDFFont, size: number, width: number) => { const lines: string[] = []; let line = ""; for (const w of text.split(/\s+/)) { const t = line ? `${line} ${w}` : w; if (font.widthOfTextAtSize(t, size) > width && line) { lines.push(line); line = w; } else line = t; } if (line) lines.push(line); return lines; };
  let ty = PAGE.h * 0.62;
  for (const ln of wrapPlain(clean(title), bold, 26, body)) { centered(ln, bold, 26, ty); ty -= 34; }
  if (author) centered(clean(author), ital, 14, ty - 16);

  for (const [n, c] of chapters.entries()) {
    fresh();
    y -= 40;
    for (const ln of wrapPlain(clean(c.title || `Chapter ${n + 1}`), bold, 18, body)) { ensure(26); centered(ln, bold, 18, y); y -= 26; }
    y -= 18;
    for (const bl of htmlToBlocks(c.content)) {
      if (bl.type === "hr") { ensure(LEAD * 2); centered("*   *   *", reg, SIZE, y - LEAD / 2); y -= LEAD * 2; continue; }
      const head = bl.type === "h1" ? 16 : bl.type === "h2" ? 14 : bl.type === "h3" ? 12.5 : 0;
      const indentL = bl.type === "quote" ? 22 : bl.type === "li" ? 18 : 0;
      const first = bl.type === "p" && !bl.align ? 16 : 0;
      const size = head || SIZE, lead = head ? head * 1.4 : LEAD;
      // words with their style, so bold/italic runs wrap correctly
      const words: Array<{ t: string; f: PDFFont; u?: boolean; nl?: boolean }> = [];
      if (bl.type === "li") words.push({ t: bl.ordered ? `${bl.ordered}.` : "•", f: reg }, { t: " ", f: reg });
      for (const r of bl.runs) {
        if (r.text === "\n") { words.push({ t: "", f: reg, nl: true }); continue; }
        const f = head ? bold : bl.type === "quote" ? pick({ ...r, italic: true }) : pick(r);
        for (const w of clean(r.text).split(/(\s+)/)) if (w && !/^\s+$/.test(w)) words.push({ t: w, f, u: r.underline }); else if (w) words.push({ t: " ", f });
      }
      const lines: Array<typeof words> = []; let cur: typeof words = [], wLine = 0, firstLine = true;
      const avail = () => body - indentL - (firstLine ? first : 0);
      for (const w of words) {
        if (w.nl) { lines.push(cur); cur = []; wLine = 0; firstLine = false; continue; }
        const wd = w.f.widthOfTextAtSize(w.t, size);
        if (w.t === " " && cur.length === 0) continue;
        if (wLine + wd > avail() && cur.length && w.t !== " ") { while (cur.length && cur[cur.length - 1].t === " ") cur.pop(); lines.push(cur); cur = []; wLine = 0; firstLine = false; if (w.t === " ") continue; }
        cur.push(w); wLine += wd;
      }
      if (cur.length) lines.push(cur);
      if (head) { y -= 6; }
      lines.forEach((ln, idx) => {
        ensure(lead);
        const trimmed = ln.filter((w, k) => !(w.t === " " && (k === 0 || k === ln.length - 1)));
        const total = trimmed.reduce((a, w) => a + w.f.widthOfTextAtSize(w.t, size), 0);
        let x = PAGE.m + indentL + (idx === 0 ? first : 0);
        if (bl.align === "center") x = PAGE.m + (body - total) / 2; else if (bl.align === "right") x = PAGE.m + body - total;
        y -= lead;
        for (const w of trimmed) { page.drawText(w.t, { x, y, size, font: w.f, color: rgb(0.1, 0.08, 0.18) }); const wd = w.f.widthOfTextAtSize(w.t, size); if (w.u) page.drawLine({ start: { x, y: y - 1.5 }, end: { x: x + wd, y: y - 1.5 }, thickness: 0.5, color: rgb(0.1, 0.08, 0.18) }); x += wd; }
      });
      y -= head ? 6 : bl.type === "li" ? 3 : bl.type === "quote" ? 6 : 0;
    }
  }
  // page numbers (not on the title page)
  const pages = pdf.getPages();
  pages.forEach((p, k) => { if (k === 0) return; const t = String(k); p.drawText(t, { x: (PAGE.w - reg.widthOfTextAtSize(t, 9.5)) / 2, y: PAGE.m / 2, size: 9.5, font: reg, color: rgb(0.35, 0.3, 0.45) }); });
  return pdf.save();
}
