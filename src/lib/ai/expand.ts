import { htmlToText, countWords } from "@/lib/words";

export const MODES = {
  moderate: "Moderate Expansion: develop scenes without significantly changing pacing.",
  literary: "Rich Literary Expansion: improve descriptions, emotional depth, sensory details and narrative flow.",
  cinematic: "Cinematic Expansion: let scenes unfold through movement, dialogue, atmosphere and visual storytelling.",
  emotional: "Emotional Expansion: develop internal thoughts, emotional reactions and character relationships.",
  suspense: "Suspense Expansion: strengthen anticipation, tension and scene endings.",
  balanced: "Balanced Expansion: combine descriptive richness, dialogue, emotional development and plot progression.",
} as const;
export type Mode = keyof typeof MODES;

export interface Section { text: string; words: number; wanted: number }

/** Splits a chapter into sections of roughly `chunk` words on paragraph boundaries, and spreads the extra words evenly. */
export function planSections(html: string, targetWords: number, chunk = 280): Section[] {
  const paras = html.split(/<\/p>|<\/h[1-6]>|<\/blockquote>/i).map((p) => htmlToText(p).trim()).filter(Boolean);
  const total = paras.reduce((n, p) => n + (p.match(/\S+/g)?.length ?? 0), 0);
  if (!total) return [];
  const secs: Section[] = [];
  let buf: string[] = [], n = 0;
  for (const p of paras) {
    const w = p.match(/\S+/g)!.length;
    buf.push(p); n += w;
    if (n >= chunk) { secs.push({ text: buf.join("\n\n"), words: n, wanted: 0 }); buf = []; n = 0; }
  }
  if (buf.length) { if (secs.length && n < chunk / 3) { secs[secs.length - 1].text += "\n\n" + buf.join("\n\n"); secs[secs.length - 1].words += n; } else secs.push({ text: buf.join("\n\n"), words: n, wanted: 0 }); }
  const ratio = targetWords / total;
  let left = targetWords;
  secs.forEach((s, i) => { s.wanted = i === secs.length - 1 ? Math.max(left, s.words) : Math.round(s.words * ratio); left -= s.wanted; });
  return secs;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const textToHtml = (t: string) => t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, " ")}</p>`).join("");
export { countWords };
