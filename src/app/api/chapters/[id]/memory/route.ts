import { NextResponse } from "next/server";
import { authed, bad } from "@/lib/api";
import { ownedChapter } from "@/lib/manuscript";
import { guard } from "@/lib/ai/run";
import { refreshMemory } from "@/lib/ai/story";

export const maxDuration = 26;

export const POST = authed<{ id: string }>(async (userId, req, { id }) => {
  const c = await ownedChapter(userId, id);
  if (!c) return bad("Chapter not found.", 404);
  const force = new URL(req.url).searchParams.get("force") === "1";
  return guard(async () => NextResponse.json(await refreshMemory(userId, c, force)));
});
