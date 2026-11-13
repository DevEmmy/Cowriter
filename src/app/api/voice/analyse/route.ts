import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { authed, bad } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { analyse } from "@/lib/ai/textstats";
import { aiConfigured, generate } from "@/lib/ai/provider";
import { guard } from "@/lib/ai/run";

export const maxDuration = 26;

export const POST = authed(async (userId, req) => {
  const p = z.object({ scope: z.string() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Invalid request.");
  const [row] = await db().select().from(schema.writingProfiles).where(and(eq(schema.writingProfiles.userId, userId), eq(schema.writingProfiles.scope, p.data.scope))).limit(1);
  if (!row || row.samples.trim().split(/\s+/).length < 150) return bad("Add at least 150 words of your own writing so the analysis has something to learn from.");
  const stats = analyse(row.samples);
  const local = `Sentences average ${stats.avgSentence} words (varying by about ${stats.sentenceStdev}). Paragraphs average ${stats.avgParagraph} words. About ${stats.dialoguePct}% of the text is dialogue. Point of view looks ${stats.pov}; tense looks ${stats.tense}. Vocabulary variety ${stats.uniqueRatio}.`;
  let summary = local, aiNote: string | null = null;
  if (aiConfigured()) {
    const res = await guard(async () => {
      const text = await generate({
        system: "You analyse a writer's style from samples. Describe it so another writer could imitate it. Be concrete and specific to these samples. Never quote more than 8 consecutive words from them.",
        messages: [{ role: "user", content: `Measured facts: ${local}\n\nWrite a style profile of 150 to 220 words covering: sentence rhythm, vocabulary level, tone, narrative perspective, dialogue style, how descriptions are built, pacing, and emotional expression. Plain prose, no headings, no bullet points.\n\nSAMPLES:\n${row.samples.slice(0, 40000)}` }],
        temperature: 0.3, maxOutputTokens: 700,
      });
      return NextResponse.json({ text });
    });
    if (res.ok) summary = `${local}\n${(await res.json()).text}`; else aiNote = (await res.json()).error;
  } else aiNote = "AI is not set up, so only measured statistics were saved.";
  const analysis = { stats, summary, at: new Date().toISOString() };
  await db().update(schema.writingProfiles).set({ analysis, updatedAt: new Date() }).where(eq(schema.writingProfiles.id, row.id));
  return NextResponse.json({ analysis, aiNote });
});
