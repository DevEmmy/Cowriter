import { getDocumentProxy } from "unpdf";
import { UnitBuilder, isListLine } from "./structure";
import type { ContentUnit, ExtractedDoc } from "@/lib/types";

interface Item { str: string; x: number; y: number; h: number; w: number }
interface Line { text: string; y: number; h: number; x: number }

const MIN_TEXT_CHARS = 40; // pages with fewer chars are treated as scanned

async function pageLines(page: Awaited<ReturnType<Awaited<ReturnType<typeof getDocumentProxy>>["getPage"]>>): Promise<Line[]> {
  const tc = await page.getTextContent();
  const items: Item[] = [];
  for (const it of tc.items as Array<{ str?: string; transform?: number[]; height?: number; width?: number }>) {
    if (!it.str || !it.str.trim() || !it.transform) continue;
    items.push({ str: it.str, x: it.transform[4], y: it.transform[5], h: Math.abs(it.height || it.transform[3] || 0), w: it.width ?? 0 });
  }
  items.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const it of items) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) < Math.max(2, it.h * 0.4)) {
      const gap = it.x - (last as Line & { end?: number }).x; void gap;
      last.text += (/\s$/.test(last.text) || /^\s/.test(it.str) ? "" : " ") + it.str;
      last.h = Math.max(last.h, it.h);
    } else lines.push({ text: it.str, y: it.y, h: it.h, x: it.x });
  }
  return lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() })).filter((l) => l.text);
}

function mode(nums: number[]): number {
  const m = new Map<number, number>();
  for (const n of nums) { const k = Math.round(n * 2) / 2; m.set(k, (m.get(k) ?? 0) + 1); }
  let best = 0, bc = -1;
  for (const [k, c] of m) if (c > bc) { best = k; bc = c; }
  return best;
}

export async function pdfPageCount(buf: Uint8Array): Promise<number> {
  const pdf = await getDocumentProxy(buf.slice());
  return pdf.numPages;
}

/** Processes pages [from, to] (1-based, inclusive) and appends units to `state`. */
export async function extractPdfPages(buf: Uint8Array, docId: string, state: ExtractedDoc, from: number, to: number): Promise<ExtractedDoc> {
  const pdf = await getDocumentProxy(buf.slice());
  const last = state.units[state.units.length - 1];
  const b = new UnitBuilder(docId, last?.section ?? [], state.units.length);
  const heights: number[] = [];
  const pages: Array<{ n: number; lines: Line[] }> = [];
  for (let n = from; n <= Math.min(to, pdf.numPages); n++) {
    const lines = await pageLines(await pdf.getPage(n));
    pages.push({ n, lines });
    for (const l of lines) heights.push(l.h);
  }
  const body = state.bodySize ?? (mode(heights) || 10);
  const newState: ExtractedDoc = { ...state, bodySize: body, ocrPages: [...state.ocrPages], warnings: [...state.warnings] };

  let para: string[] = [];
  let paraPage = from;
  let prevY = 0, prevH = 0;
  const flush = () => { if (para.length) { b.text(para.join("\n").replace(/(\w)-\n(\w)/g, "$1$2").replace(/([^\n.!?:;])\n(?![•\-–*\d(])/g, "$1 "), paraPage); para = []; } };

  for (const { n, lines } of pages) {
    const chars = lines.reduce((s, l) => s + l.text.length, 0);
    if (chars < MIN_TEXT_CHARS) { newState.ocrPages.push(n); continue; }
    paraPage = n; prevY = 0; prevH = 0;
    // drop running headers/footers: short lines at the extreme top/bottom that are only a page number
    for (const l of lines) {
      if (/^(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?$/i.test(l.text)) continue;
      const ratio = l.h / body;
      const isHeading = ratio >= 1.15 && l.text.length < 140 && !/[.,;]$/.test(l.text);
      if (isHeading) {
        flush();
        const level = ratio >= 1.8 ? 1 : ratio >= 1.4 ? 2 : 3;
        b.heading(l.text, level, n);
        continue;
      }
      const gap = prevY ? prevY - l.y : 0;
      const startsList = isListLine(l.text);
      const paraIsList = para.length > 0 && para.every(isListLine);
      if (para.length && (gap > Math.max(prevH, l.h) * 1.7 || (startsList && !paraIsList))) flush();
      if (!para.length) paraPage = n;
      para.push(l.text);
      prevY = l.y; prevH = l.h;
    }
    flush();
  }
  newState.units = [...state.units, ...b.units];
  newState.pagesDone = Math.min(to, pdf.numPages);
  newState.done = newState.pagesDone >= pdf.numPages && newState.ocrPages.length === newState.ocrDone.length;
  return newState;
}

export type { ContentUnit };
