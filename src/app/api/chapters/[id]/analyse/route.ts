import { NextResponse } from "next/server";
import { authed, bad } from "@/lib/api";
import { ownedChapter } from "@/lib/manuscript";
import { guard } from "@/lib/ai/run";
import { chapterFeedback, chapterMetrics } from "@/lib/ai/analyser";
import { plain } from "@/lib/ai/story";
import { htmlToText } from "@/lib/words";

export const maxDuration = 26;

/** Measured analysis (always) plus editor-style AI feedback (when AI is set up). Nothing is saved or changed. */
export const POST = authed<{ id: string }>(async (userId, _req, { id }) => {
  const c = await ownedChapter(userId, id);
  if (!c) return bad("Chapter not found.", 404);
  const text = htmlToText(c.content.replace(/<\/p>/g, "</p>\n\n")).replace(/[ \t]+/g, " ").trim();
  if (text.split(/\s+/).length < 50) return bad("Write at least 50 words so there is something to analyse.");
  const metrics = chapterMetrics(text);
  return guard(async () => {
    let feedback = null, note: string | undefined;
    try { ({ feedback, note } = await chapterFeedback(c.title, plain(c.content))); }
    catch (e) { note = (e as Error).message; }
    return NextResponse.json({ metrics, feedback, note: note ?? null });
  });
});
