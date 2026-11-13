import { createHash } from "node:crypto";
import { z } from "zod";
import { and, asc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { htmlToText } from "@/lib/words";
import { analyse } from "./textstats";
import { generateJson } from "./json";
import { aiConfigured } from "./provider";

export const BIBLE_KINDS = ["character", "location", "timeline", "rule", "note"] as const;
export type BibleKind = (typeof BIBLE_KINDS)[number];
const KIND_LABEL: Record<BibleKind, string> = { character: "Characters", location: "Locations", timeline: "Timeline", rule: "World rules", note: "Notes" };

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);
export const plain = (html: string) => htmlToText(html).replace(/\s+/g, " ").trim();
export const hashOf = (text: string) => createHash("sha1").update(text).digest("hex");

export async function bibleOf(projectId: string) {
  return db().select().from(schema.bibleEntries).where(eq(schema.bibleEntries.projectId, projectId)).orderBy(asc(schema.bibleEntries.kind), asc(schema.bibleEntries.position), asc(schema.bibleEntries.createdAt));
}
export function bibleText(entries: Array<{ kind: string; name: string; body: string }>, cap = 7000): string {
  const out: string[] = [];
  for (const k of BIBLE_KINDS) {
    const list = entries.filter((e) => e.kind === k);
    if (list.length) out.push(`${KIND_LABEL[k]}:\n` + list.map((e) => `- ${e.name}${e.body ? `: ${clip(e.body.replace(/\s+/g, " "), 600)}` : ""}`).join("\n"));
  }
  return clip(out.join("\n\n"), cap);
}

/** Chapter memory: summary + facts, in chapter order. */
export async function memoryOf(projectId: string, excludeChapterId?: string) {
  const rows = await db().select({ chapterId: schema.chapters.id, title: schema.chapters.title, position: schema.chapters.position, summary: schema.chapterMemory.summary, facts: schema.chapterMemory.facts })
    .from(schema.chapterMemory).innerJoin(schema.chapters, eq(schema.chapters.id, schema.chapterMemory.chapterId))
    .where(excludeChapterId ? and(eq(schema.chapterMemory.projectId, projectId), ne(schema.chapterMemory.chapterId, excludeChapterId)) : eq(schema.chapterMemory.projectId, projectId))
    .orderBy(asc(schema.chapters.position));
  return rows as Array<{ chapterId: string; title: string; position: number; summary: string; facts: string[] }>;
}
export function memoryText(rows: Array<{ title: string; summary: string; facts: string[] }>, cap = 9000): string {
  return clip(rows.map((r) => `${r.title}: ${r.summary}${r.facts.length ? `\n  Established: ${r.facts.join(" ")}` : ""}`).join("\n"), cap);
}

/** Context shared with the chat assistant so it knows the story without the writer re-explaining it. */
export async function storyContext(projectId: string, excludeChapterId?: string): Promise<string> {
  const [bible, mem] = await Promise.all([bibleOf(projectId), memoryOf(projectId, excludeChapterId)]);
  const parts = [];
  if (bible.length) parts.push(`Story Bible (established by the writer; treat as true):\n${bibleText(bible, 5000)}`);
  if (mem.length) parts.push(`Summaries of other chapters (generated from the manuscript):\n${memoryText(mem, 6000)}`);
  return parts.join("\n\n");
}

// ---------- Manuscript memory ----------
const memorySchema = z.object({ summary: z.string().min(1).max(1500), facts: z.array(z.string().min(1).max(300)).max(15) });

function basicMemory(text: string) {
  const sents = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const names = new Map<string, number>();
  for (const m of text.matchAll(/(?<![.!?]\s)(?<!^)\b[A-Z][a-z]{2,}\b/g)) names.set(m[0], (names.get(m[0]) ?? 0) + 1);
  const top = [...names.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
  return { summary: clip(sents.slice(0, 2).join(" ").trim(), 400), facts: top.length ? [`Names that recur: ${top.join(", ")}.`] : [] };
}

export interface MemoryResult { chapterId: string; skipped: boolean; basic: boolean }
/** Rebuilds a chapter's memory only when its text has changed since the last build (or the last one was basic and AI is now available). */
export async function refreshMemory(userId: string, chapter: { id: string; projectId: string; title: string; content: string }, force = false): Promise<MemoryResult> {
  const text = plain(chapter.content);
  const hash = hashOf(text);
  const [cur] = await db().select().from(schema.chapterMemory).where(eq(schema.chapterMemory.chapterId, chapter.id)).limit(1);
  if (cur && cur.contentHash === hash && !force && !(cur.basic && aiConfigured())) return { chapterId: chapter.id, skipped: true, basic: cur.basic };
  let mem: { summary: string; facts: string[] }, basic = false;
  if (text.split(" ").length < 40) { mem = { summary: text ? clip(text, 300) : "This chapter is empty.", facts: [] }; basic = true; }
  else if (aiConfigured()) {
    mem = await generateJson(
      `KIND:memory\nYou build a continuity memory of one chapter for a novelist. Use ONLY what the chapter text states. Do not infer, speculate or add anything.\nReply with ONLY a JSON object: {"summary": string (3 to 5 sentences of what happens), "facts": [string] (up to 15 concrete established facts: who is where, relationships, dates, objects, promises, secrets revealed, physical details)}`,
      [{ role: "user", content: `Chapter "${chapter.title}":\n${clip(text, 40000)}` }], memorySchema, { temperature: 0.2, maxOutputTokens: 1800 });
  } else { mem = basicMemory(text); basic = true; }
  const row = { chapterId: chapter.id, userId, projectId: chapter.projectId, summary: mem.summary, facts: mem.facts, basic, contentHash: hash, updatedAt: new Date() };
  await db().insert(schema.chapterMemory).values(row).onConflictDoUpdate({ target: schema.chapterMemory.chapterId, set: { summary: row.summary, facts: row.facts, basic, contentHash: hash, updatedAt: row.updatedAt } });
  return { chapterId: chapter.id, skipped: false, basic };
}

// ---------- Story Guard ----------
export interface GuardIssue { source: "local" | "ai"; severity: "low" | "medium" | "high"; category: string; quote: string; problem: string; reference?: string }

/** Edit distance where swapping two neighbouring letters counts as one edit ("Adeaze" for "Adaeze"). */
export function levenshtein(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
const normQ = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
export const quoteInText = (text: string, quote: string) => quote.trim().length >= 8 && normQ(text).includes(normQ(quote));

function sentenceAround(text: string, idx: number): string {
  const start = Math.max(text.lastIndexOf(". ", idx) + 2, text.lastIndexOf("? ", idx) + 2, text.lastIndexOf("! ", idx) + 2, 0);
  const endRel = text.slice(idx).search(/[.!?](\s|$)/);
  return text.slice(start, endRel < 0 ? undefined : idx + endRel + 1).trim().slice(0, 240);
}

/** Deterministic checks that need no AI: near-miss character names. */
export function localGuard(text: string, characterNames: string[]): GuardIssue[] {
  const issues: GuardIssue[] = [];
  const tokens = new Set<string>();
  for (const n of characterNames) for (const t of n.split(/\s+/)) if (t.length >= 4) tokens.add(t);
  const known = new Set([...tokens].map((t) => t.toLowerCase()));
  const seen = new Set<string>();
  for (const m of text.matchAll(/\b[A-Z][a-zA-Z'’-]{3,}\b/g)) {
    const w = m[0], lw = w.toLowerCase();
    if (known.has(lw) || seen.has(lw)) continue;
    for (const t of tokens) {
      const d = levenshtein(lw, t.toLowerCase());
      if (d > 0 && d <= (t.length >= 7 ? 2 : 1) && w[0] === t[0]) {
        seen.add(lw);
        issues.push({ source: "local", severity: "low", category: "character", quote: sentenceAround(text, m.index ?? 0), problem: `"${w}" looks like a possible misspelling of the character name "${t}".`, reference: `Story Bible: ${t}` });
        break;
      }
    }
  }
  return issues.slice(0, 6);
}

const aiGuardSchema = z.object({ issues: z.array(z.object({ severity: z.enum(["low", "medium", "high"]), category: z.string().min(1).max(40), quote: z.string().min(1).max(400), problem: z.string().min(1).max(600), reference: z.string().max(400).optional() })).max(15) });

export interface GuardResult { issues: GuardIssue[]; usedAi: boolean; dropped: number; note?: string }

export async function runGuard(userId: string, chapter: { id: string; projectId: string; title: string; content: string }): Promise<GuardResult> {
  const text = plain(chapter.content);
  const [bible, memory, others] = await Promise.all([
    bibleOf(chapter.projectId), memoryOf(chapter.projectId, chapter.id),
    db().select({ content: schema.chapters.content }).from(schema.chapters).where(and(eq(schema.chapters.projectId, chapter.projectId), ne(schema.chapters.id, chapter.id))).limit(40),
  ]);
  const issues: GuardIssue[] = localGuard(text, bible.filter((b) => b.kind === "character").map((b) => b.name));
  // Point of view and tense drift against the rest of the manuscript (only when both sides are clear).
  const me = analyse(text);
  const tally = (f: (a: ReturnType<typeof analyse>) => string) => { const c = new Map<string, number>(); for (const o of others) { const t = plain(o.content); if (t.split(" ").length < 150) continue; const v = f(analyse(t)); if (v !== "unclear") c.set(v, (c.get(v) ?? 0) + 1); } return [...c.entries()].sort((a, b) => b[1] - a[1])[0]; };
  for (const [label, mine, f] of [["point of view", me.pov, (a: ReturnType<typeof analyse>) => a.pov], ["tense", me.tense, (a: ReturnType<typeof analyse>) => a.tense]] as const) {
    const top = tally(f);
    if (top && mine !== "unclear" && top[0] !== mine && top[1] >= 2) issues.push({ source: "local", severity: "medium", category: "voice", quote: text.slice(0, 120), problem: `This chapter reads as ${mine} ${label}, but ${top[1]} other chapters read as ${top[0]}. Check this is intentional.`, reference: "Rest of manuscript" });
  }
  let usedAi = false, dropped = 0, note: string | undefined;
  if (!aiConfigured()) note = "AI is not set up, so only name and voice checks ran. Add GEMINI_API_KEY to enable full continuity checking.";
  else if (!bible.length && !memory.length) note = "Add Story Bible entries or build chapter memory so there is something to check this chapter against.";
  else {
    const ai = await generateJson(
      `KIND:guard\nYou are Story Guard, a continuity editor. Compare the CHAPTER against the Story Bible and the summaries of other chapters. Report ONLY real contradictions or continuity breaks (names, ages, appearances, locations, timeline order, established rules, facts that conflict). Never report style or taste. Never invent facts. Each issue needs a "quote" copied EXACTLY, word for word, from the chapter text, and a "reference" naming what it conflicts with. If there are none, return {"issues": []}.\nReply with ONLY JSON: {"issues":[{"severity":"low|medium|high","category":"character|timeline|location|rule|fact","quote":string,"problem":string,"reference":string}]}`,
      [{ role: "user", content: `STORY BIBLE:\n${bibleText(bible) || "(empty)"}\n\nOTHER CHAPTERS:\n${memoryText(memory) || "(none)"}\n\nCHAPTER TEXT:\n${clip(text, 40000)}` }], aiGuardSchema, { temperature: 0.1, maxOutputTokens: 2500 });
    usedAi = true;
    for (const i of ai.issues) { if (quoteInText(text, i.quote)) issues.push({ source: "ai", ...i }); else dropped++; }
  }
  const order = { high: 0, medium: 1, low: 2 };
  return { issues: issues.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 20), usedAi, dropped, note };
}

// ---------- Bible suggestions ----------
export const suggestSchema = z.object({ suggestions: z.array(z.object({ kind: z.enum(BIBLE_KINDS), name: z.string().min(1).max(120), body: z.string().max(1500) })).max(20) });
