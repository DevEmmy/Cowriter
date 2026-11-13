import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { authed, bad, isId } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { ownedChapter, saveChapter, snapshot } from "@/lib/manuscript";

// Restoring first checkpoints the current text, so a restore can itself be undone.
export const POST = authed<{ id: string; vid: string }>(async (userId, req, { id, vid }) => {
  const c = await ownedChapter(userId, id);
  if (!c || !isId(vid)) return bad("Version not found.", 404);
  const [v] = await db().select().from(schema.chapterVersions).where(and(eq(schema.chapterVersions.id, vid), eq(schema.chapterVersions.chapterId, id), eq(schema.chapterVersions.userId, userId))).limit(1);
  if (!v) return bad("Version not found.", 404);
  await snapshot(userId, c, "before_restore");
  const r = await saveChapter(userId, id, { content: v.content, title: v.title, revision: c.revision });
  if (!r || !r.ok) return bad("The chapter changed while restoring. Reload and try again.", 409);
  return NextResponse.json({ ...r, content: v.content, title: v.title });
});
