import { z } from "zod";
import { analyse, checkProse, type Issue } from "./textstats";
import { generateJson } from "./json";
import { aiConfigured } from "./provider";
import { quoteInText } from "./story";

const STOP = new Set("the a an and or but if then of to in on at by for with from as is was were be been being it its he she they them his her their i me my we our you your that this these those not no so than too very just had has have do did does would could should will can may might said there what when where who whom which while into out up down over after before again about because also".split(" "));
const FILTER = ["felt", "saw", "heard", "noticed", "realized", "realised", "seemed", "wondered", "watched", "thought", "knew", "decided", "began to", "started to"];

export const syllables = (w: string): number => {
  const s = w.toLowerCase().replace(/[^a-z]/g, "");
  if (!s) return 0;
  const g = s.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, g ? g.length : 1);
};

export interface ChapterMetrics {
  words: number; sentences: number; paragraphs: number; avgSentence: number; longestSentence: { words: number; excerpt: string };
  readingEase: number; gradeLevel: number; readingMinutes: number; dialoguePct: number; uniqueRatio: number;
  adverbsPer1000: number; passivePer1000: number; filterWords: Array<[string, number]>;
  lengthMix: { short: number; medium: number; long: number };
  pacing: Array<{ words: number; dialogue: boolean }>;
  repeatedWords: Array<[string, number]>;
  pov: string; tense: string; issues: Issue[];
}

export function chapterMetrics(text: string): ChapterMetrics {
  const base = analyse(text);
  const sents = (text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+["')\]”’]*|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter(Boolean);
  const wl = (s: string) => s.match(/[A-Za-zÀ-ÿ'’]+/g) ?? [];
  const words = wl(text), n = Math.max(1, words.length);
  const lens = sents.map((s) => wl(s).length).filter(Boolean);
  const longest = sents.reduce((m, s) => (wl(s).length > wl(m).length ? s : m), "");
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  const asl = lens.length ? n / lens.length : 0;
  const ease = lens.length ? 206.835 - 1.015 * asl - 84.6 * (syl / n) : 0;
  const grade = lens.length ? 0.39 * asl + 11.8 * (syl / n) - 15.59 : 0;
  const lower = text.toLowerCase();
  const adverbs = words.filter((w) => w.length > 4 && w.toLowerCase().endsWith("ly") && !/^(only|family|early|lonely|friendly|really|reply|belly|jelly|ugly|holy|silly|lovely|likely)$/i.test(w)).length;
  const passive = (lower.match(/\b(was|were|been|being|is|are|be)\s+(\w+ed|\w+en)\b/g) ?? []).length;
  const filter = FILTER.map((f) => [f, (lower.match(new RegExp(`\\b${f}\\b`, "g")) ?? []).length] as [string, number]).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const freq = new Map<string, number>();
  for (const w of words) { const k = w.toLowerCase(); if (k.length > 3 && !STOP.has(k)) freq.set(k, (freq.get(k) ?? 0) + 1); }
  const paras = text.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
  return {
    words: words.length, sentences: lens.length, paragraphs: paras.length, avgSentence: +asl.toFixed(1),
    longestSentence: { words: wl(longest).length, excerpt: longest.slice(0, 160) },
    readingEase: Math.round(Math.max(0, Math.min(100, ease))), gradeLevel: +Math.max(0, grade).toFixed(1), readingMinutes: Math.max(1, Math.round(words.length / 230)),
    dialoguePct: base.dialoguePct, uniqueRatio: base.uniqueRatio,
    adverbsPer1000: Math.round((adverbs / n) * 1000), passivePer1000: Math.round((passive / n) * 1000), filterWords: filter,
    lengthMix: { short: lens.filter((l) => l < 8).length, medium: lens.filter((l) => l >= 8 && l <= 20).length, long: lens.filter((l) => l > 20).length },
    pacing: paras.slice(0, 200).map((p) => ({ words: wl(p).length, dialogue: /^["“‘']/.test(p) })),
    repeatedWords: [...freq.entries()].filter(([, c]) => c >= 4).sort((a, b) => b[1] - a[1]).slice(0, 8),
    pov: base.pov, tense: base.tense, issues: checkProse(text),
  };
}

const point = z.object({ point: z.string().min(1).max(500), evidence: z.string().max(400).optional() });
export const feedbackSchema = z.object({ summary: z.string().min(1).max(900), tone: z.string().max(300), pacing: z.string().max(400), strengths: z.array(point).max(6), improvements: z.array(point).max(8) });
export type Feedback = z.infer<typeof feedbackSchema>;

export async function chapterFeedback(title: string, text: string): Promise<{ feedback: Feedback | null; note?: string }> {
  if (!aiConfigured()) return { feedback: null, note: "AI is not set up, so only the measured analysis is shown." };
  const fb = await generateJson(
    `KIND:analyse\nYou are a developmental editor giving honest, specific feedback on ONE chapter. Judge only what is on the page. Be concrete; no flattery and no generic advice. Do not rewrite the chapter. Where you can, give "evidence": a short phrase copied EXACTLY from the chapter.\nReply with ONLY JSON: {"summary":string,"tone":string (emotional tone),"pacing":string,"strengths":[{"point","evidence"}],"improvements":[{"point","evidence"}]}`,
    [{ role: "user", content: `Chapter "${title}":\n${text.slice(0, 40000)}` }], feedbackSchema, { temperature: 0.4, maxOutputTokens: 2200 });
  const keep = (p: { point: string; evidence?: string }) => ({ point: p.point, evidence: p.evidence && quoteInText(text, p.evidence) ? p.evidence : undefined });
  return { feedback: { ...fb, strengths: fb.strengths.map(keep), improvements: fb.improvements.map(keep) } };
}
