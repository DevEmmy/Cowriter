import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { authed, bad } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { ownedProject } from "@/lib/manuscript";
import { hashOf, plain } from "@/lib/ai/story";

/** Memory status for every chapter: built, out of date (chapter changed since), or missing. */
export const GET = authed<{ id: string }>(async (userId, _req, { id }) => {
  if (!(await ownedProject(userId, id))) return bad("Project not found.", 404);
  const chs = await db().select({ id: schema.chapters.id, title: schema.chapters.title, content: schema.chapters.content, wordCount: schema.chapters.wordCount }).from(schema.chapters).where(eq(schema.chapters.projectId, id)).orderBy(asc(schema.chapters.position));
  const mem = new Map((await db().select().from(schema.chapterMemory).where(eq(schema.chapterMemory.projectId, id))).map((m) => [m.chapterId, m]));
  return NextResponse.json({ chapters: chs.map((c) => { const m = mem.get(c.id); return { id: c.id, title: c.title, wordCount: c.wordCount, state: !m ? "missing" : m.contentHash === hashOf(plain(c.content)) ? "current" : "stale", basic: m?.basic ?? false, summary: m?.summary ?? "", facts: (m?.facts as string[]) ?? [], updatedAt: m?.updatedAt ?? null }; }) });
});
