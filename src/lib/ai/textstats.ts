// Pure, local text analysis. No AI calls: everything here is deterministic and testable.
export interface Issue { type: string; severity: "info" | "warn"; message: string; excerpt?: string }
export interface Analysis {
  words: number; sentences: number; avgSentence: number; sentenceStdev: number; longest: number;
  uniqueRatio: number; dialoguePct: number; avgParagraph: number; pov: string; tense: string;
  dashes: number; topOpeners: Array<[string, number]>;
}

const sentencesOf = (t: string) => (t.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter(Boolean);
const wordsOf = (t: string) => t.toLowerCase().match(/[a-z']+/g) ?? [];

export function analyse(text: string): Analysis {
  const sents = sentencesOf(text);
  const lens = sents.map((s) => wordsOf(s).length).filter((n) => n > 0);
  const words = wordsOf(text);
  const avg = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const stdev = lens.length ? Math.sqrt(lens.reduce((a, b) => a + (b - avg) ** 2, 0) / lens.length) : 0;
  const quoted = (text.match(/["“][^"”]*["”]/g) ?? []).join(" ");
  const paras = text.split(/\n\s*\n/).map((p) => wordsOf(p).length).filter(Boolean);
  const first = (re: RegExp) => words.filter((w) => re.test(w)).length;
  const fp = first(/^(i|me|my|mine|we|our)$/), tp = first(/^(he|she|they|him|her|his|their)$/);
  const past = first(/^(was|were|had|did|said|went|came|looked)$/) + words.filter((w) => w.length > 4 && w.endsWith("ed")).length * 0.5;
  const present = first(/^(is|are|am|has|does|says|goes|comes)$/);
  const openers = new Map<string, number>();
  for (const s of sents) { const w = wordsOf(s)[0]; if (w) openers.set(w, (openers.get(w) ?? 0) + 1); }
  return {
    words: words.length, sentences: lens.length, avgSentence: +avg.toFixed(1), sentenceStdev: +stdev.toFixed(1), longest: Math.max(0, ...lens),
    uniqueRatio: words.length ? +(new Set(words).size / words.length).toFixed(2) : 0,
    dialoguePct: text.length ? Math.round((quoted.length / text.length) * 100) : 0,
    avgParagraph: paras.length ? Math.round(paras.reduce((a, b) => a + b, 0) / paras.length) : 0,
    pov: fp + tp < 5 ? "unclear" : fp > tp ? "first person" : "third person",
    tense: past + present < 5 ? "unclear" : past >= present ? "past" : "present",
    dashes: (text.match(/[—–]/g) ?? []).length,
    topOpeners: [...openers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}

// Stock phrases that make prose feel generic. A prompt for the writer to look again, not a verdict.
const GENERIC = ["a testament to", "tapestry", "delve", "in the realm of", "little did", "sent shivers down", "a mix of", "couldn't help but", "the weight of", "heart hammered", "time seemed to", "a symphony of", "dance of", "palpable", "unspoken words", "silence stretched", "let out a breath she didn't know", "in that moment", "the air was thick"];

export function checkProse(text: string): Issue[] {
  const issues: Issue[] = [];
  const sents = sentencesOf(text);
  const a = analyse(text);
  if (a.dashes) issues.push({ type: "dashes", severity: "warn", message: `${a.dashes} long dash${a.dashes === 1 ? "" : "es"} found (— or –).` });

  const seen = new Map<string, number>();
  for (const s of sents) { const k = s.toLowerCase().replace(/[^a-z ]/g, "").trim(); if (k.split(" ").length >= 4) seen.set(k, (seen.get(k) ?? 0) + 1); }
  for (const [k, n] of seen) if (n > 1) issues.push({ type: "repeated-sentence", severity: "warn", message: `A sentence appears ${n} times.`, excerpt: k.slice(0, 100) });

  const w = wordsOf(text), grams = new Map<string, number>();
  for (let i = 0; i + 4 <= w.length; i++) { const g = w.slice(i, i + 4).join(" "); grams.set(g, (grams.get(g) ?? 0) + 1); }
  const common = new Set(["i did not know", "at the end of the", "one of the most", "in the middle of"]);
  [...grams.entries()].filter(([g, n]) => n >= 3 && !common.has(g)).sort((x, y) => y[1] - x[1]).slice(0, 5)
    .forEach(([g, n]) => issues.push({ type: "repeated-phrase", severity: "info", message: `The phrase appears ${n} times.`, excerpt: g }));

  let run = 1;
  for (let i = 1; i < sents.length; i++) {
    run = wordsOf(sents[i])[0] && wordsOf(sents[i])[0] === wordsOf(sents[i - 1])[0] ? run + 1 : 1;
    if (run === 3) issues.push({ type: "repeated-opener", severity: "info", message: "Three sentences in a row start with the same word.", excerpt: sents[i].slice(0, 80) });
  }
  const lower = text.toLowerCase();
  for (const g of GENERIC) { const n = lower.split(g).length - 1; if (n) issues.push({ type: "generic-phrase", severity: "info", message: `Stock phrase${n > 1 ? ` (x${n})` : ""}: consider a more specific image.`, excerpt: g }); }
  if (a.sentences >= 12 && a.sentenceStdev < 4) issues.push({ type: "flat-rhythm", severity: "info", message: `Sentence lengths barely vary (average ${a.avgSentence}, spread ${a.sentenceStdev}). Mixing short and long sentences usually reads more naturally.` });
  return issues;
}

export const stripDashes = (t: string) => t.replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",");
