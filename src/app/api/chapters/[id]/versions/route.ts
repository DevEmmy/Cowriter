import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { authed, bad } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { ownedChapter, snapshot } from "@/lib/manuscript";

export const GET = authed<{ id: string }>(async (userId, _req, { id }) => {
  if (!(await ownedChapter(userId, id))) return bad("Chapter not found.", 404);
  const v = await db().select({ id: schema.chapterVersions.id, title: schema.chapterVersions.title, wordCount: schema.chapterVersions.wordCount, reason: schema.chapterVersions.reason, createdAt: schema.chapterVersions.createdAt, content: schema.chapterVersions.content })
    .from(schema.chapterVersions).where(and(eq(schema.chapterVersions.chapterId, id), eq(schema.chapterVersions.userId, userId))).orderBy(desc(schema.chapterVersions.createdAt)).limit(100);
  return NextResponse.json(v);
});

// Manual "save a version now" checkpoint.
export const POST = authed<{ id: string }>(async (userId, _req, { id }) => {
  const c = await ownedChapter(userId, id);
  if (!c) return bad("Chapter not found.", 404);
  await snapshot(userId, c, "manual");
  return NextResponse.json({ ok: true });
});
