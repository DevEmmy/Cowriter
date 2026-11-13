import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { authed, bad } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { ownedProject } from "@/lib/manuscript";
import { aiConfigured } from "@/lib/ai/provider";
import { generateJson } from "@/lib/ai/json";
import { guard } from "@/lib/ai/run";
import { bibleOf, memoryOf, memoryText, plain, suggestSchema } from "@/lib/ai/story";

export const maxDuration = 26;

/** Proposes Story Bible entries found in the manuscript. Nothing is saved: the writer adds the ones they want. */
export const POST = authed<{ id: string }>(async (userId, _req, { id }) => {
  if (!(await ownedProject(userId, id))) return bad("Project not found.", 404);
  if (!aiConfigured()) return bad("AI is not set up yet. You can still add entries yourself.", 503);
  const [existing, mem, chs] = await Promise.all([bibleOf(id), memoryOf(id), db().select({ title: schema.chapters.title, content: schema.chapters.content }).from(schema.chapters).where(eq(schema.chapters.projectId, id)).orderBy(asc(schema.chapters.position))]);
  const source = mem.length ? memoryText(mem, 12000) : chs.map((c) => `${c.title}: ${plain(c.content).slice(0, 2500)}`).join("\n").slice(0, 12000);
  if (source.trim().length < 80) return bad("Write a little more first, so there is something to read.");
  return guard(async () => {
    const r = await generateJson(
      `KIND:biblesuggest\nYou list story elements that are ALREADY established in the manuscript, for the writer's Story Bible. Use only what the text states; never invent. Skip anything already in the bible. kind is one of character, location, timeline, rule, note.\nReply with ONLY JSON: {"suggestions":[{"kind":string,"name":string,"body":string (one or two sentences of what the text establishes)}]}`,
      [{ role: "user", content: `ALREADY IN THE BIBLE: ${existing.map((e) => e.name).join(", ") || "(nothing)"}\n\nMANUSCRIPT:\n${source}` }], suggestSchema, { temperature: 0.2, maxOutputTokens: 2500 });
    const have = new Set(existing.map((e) => e.name.toLowerCase()));
    return NextResponse.json({ suggestions: r.suggestions.filter((s) => !have.has(s.name.toLowerCase())) });
  });
});
