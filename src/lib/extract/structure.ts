import type { ContentUnit, UnitKind } from "@/lib/types";

const LIST_RE = /^\s*(?:[•◦▪●■\-–*]|\(?\d{1,3}[.)]|\(?[a-zA-Z][.)])\s+/;
const CAPTION_RE = /^(figure|fig\.|table|chart|diagram|plate)\s+\d+[.:)]?/i;
const REF_HEAD_RE = /^(references?|bibliography|works cited|citations?)$/i;
const FOOTNOTE_RE = /^(\d{1,3}|[*†‡§])\s+[A-Z].{15,}/;

export const isListLine = (s: string) => LIST_RE.test(s);

export function looksLikeEquation(s: string): boolean {
  const t = s.trim();
  if (t.length < 3 || t.length > 160) return false;
  const math = (t.match(/[=≈≠≤≥∑∫√∂∆±×÷^_∞πλμσθαβγ]/g) ?? []).length;
  const words = t.split(/\s+/).filter((w) => /^[A-Za-z]{4,}$/.test(w)).length;
  return math >= 2 && words <= 3;
}

/**
 * Turns an ordered stream of raw blocks into typed content units while tracking the
 * heading path. Nothing is dropped: unknown text becomes a paragraph.
 */
export class UnitBuilder {
  units: ContentUnit[] = [];
  private path: string[] = [];
  private inRefs = false;
  private n = 0;
  constructor(private docId: string, startPath: string[] = [], private startCount = 0) {
    this.path = [...startPath];
    this.n = startCount;
  }
  get currentPath() { return [...this.path]; }

  private push(u: Omit<ContentUnit, "id" | "docId" | "section"> & { section?: string[] }) {
    const id = `${this.docId}-u${++this.n}`;
    this.units.push({ id, docId: this.docId, section: this.path.slice(), ...u });
  }

  heading(text: string, level: number, page: number | null) {
    const t = text.replace(/\s+/g, " ").trim();
    if (!t) return;
    const lvl = Math.max(1, Math.min(level, 6));
    this.path = this.path.slice(0, lvl - 1);
    while (this.path.length < lvl - 1) this.path.push("");
    this.path.push(t);
    this.inRefs = REF_HEAD_RE.test(t.replace(/^\d+(\.\d+)*\s*/, ""));
    this.push({ kind: "heading", level: lvl, text: t, page });
  }

  text(raw: string, page: number | null, extra: Partial<ContentUnit> = {}) {
    const text = raw.replace(/[ \t]+\n/g, "\n").trim();
    if (!text) return;
    let kind: UnitKind = "paragraph";
    const lines = text.split("\n").filter(Boolean);
    if (this.inRefs) kind = "reference";
    else if (CAPTION_RE.test(text) && text.length < 400) kind = "caption";
    else if (lines.length > 1 && lines.every((l) => LIST_RE.test(l))) kind = "list";
    else if (lines.length === 1 && looksLikeEquation(text)) kind = "equation";
    else if (lines.length === 1 && FOOTNOTE_RE.test(text) && text.length < 300 && extra.note === "bottom") kind = "footnote";
    this.push({ kind, text, page, ...extra, note: extra.note === "bottom" ? undefined : extra.note });
  }

  table(rows: string[][], page: number | null) {
    const clean = rows.map((r) => r.map((c) => c.replace(/\s+/g, " ").trim()));
    if (!clean.some((r) => r.some(Boolean))) return;
    this.push({ kind: "table", text: clean.map((r) => r.join(" | ")).join("\n"), rows: clean, page });
  }

  flag(text: string, page: number | null, note: string) {
    this.push({ kind: "paragraph", text, page, uncertain: true, note });
  }
}
