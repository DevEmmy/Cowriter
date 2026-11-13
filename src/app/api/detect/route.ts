import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, bad } from "@/lib/api";
import { ownedChapter } from "@/lib/manuscript";
import { guard } from "@/lib/ai/run";
import { runDetector } from "@/lib/detectors";
import { plain } from "@/lib/ai/story";

export const maxDuration = 26;

/** Sends ONE of the user's own chapters to a detector they have connected. Never sends anything else. */
export const POST = authed(async (userId, req) => {
  const p = z.object({ chapterId: z.string(), provider: z.string() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Choose a chapter and a detector.");
  const c = await ownedChapter(userId, p.data.chapterId);
  if (!c) return bad("Chapter not found.", 404);
  const text = plain(c.content);
  if (text.split(" ").length < 50) return bad("Write at least 50 words before checking.");
  return guard(async () => NextResponse.json({ result: await runDetector(p.data.provider, text.slice(0, 50000)), words: text.split(" ").length }));
});
