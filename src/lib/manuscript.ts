import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isId } from "@/lib/api";
import { countWords } from "@/lib/words";

export async function ownedProject(userId: string, id: string) {
  if (!isId(id)) return null;
  const [p] = await db().select().from(schema.projects).where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId))).limit(1);
  return p ?? null;
}
export async function ownedChapter(userId: string, id: string) {
  if (!isId(id)) return null;
  const [c] = await db().select().from(schema.chapters).where(and(eq(schema.chapters.id, id), eq(schema.chapters.userId, userId))).limit(1);
  return c ?? null;
}

const AUTO_VERSION_GAP_MS = 5 * 60 * 1000;
export const today = () => new Date().toISOString().slice(0, 10);

export async function addWords(userId: string, n: number) {
  if (n <= 0) return;
  await db().insert(schema.writingStats).values({ userId, day: today(), words: n })
    .onConflictDoUpdate({ target: [schema.writingStats.userId, schema.writingStats.day], set: { words: sql`${schema.writingStats.words} + ${n}` } });
}

export async function snapshot(userId: string, c: { id: string; title: string; content: string; wordCount: number }, reason: "auto" | "manual" | "before_restore") {
  await db().insert(schema.chapterVersions).values({ chapterId: c.id, userId, title: c.title, content: c.content, wordCount: c.wordCount, reason });
}

export type SaveResult =
  | { ok: true; revision: number; wordCount: number; savedAt: string }
  | { ok: false; conflict: true; revision: number };

/**
 * Compare-and-swap save: succeeds only if the client saw the latest revision, so a stale tab
 * can never silently overwrite newer text.
 */
export async function saveChapter(userId: string, chapterId: string, input: { content?: string; title?: string; revision: number }): Promise<SaveResult | null> {
  const cur = await ownedChapter(userId, chapterId);
  if (!cur) return null;
  const content = input.content ?? cur.content;
  const title = (input.title ?? cur.title).trim().slice(0, 200) || "Untitled chapter";
  const wordCount = countWords(content);
  const now = new Date();
  const rows = await db().update(schema.chapters)
    .set({ content, title, wordCount, revision: input.revision + 1, updatedAt: now })
    .where(and(eq(schema.chapters.id, chapterId), eq(schema.chapters.userId, userId), eq(schema.chapters.revision, input.revision)))
    .returning({ revision: schema.chapters.revision });
  if (!rows.length) return { ok: false, conflict: true, revision: cur.revision };

  await addWords(userId, wordCount - cur.wordCount);
  await db().update(schema.projects).set({ updatedAt: now }).where(eq(schema.projects.id, cur.projectId));
  if (content !== cur.content) {
    const [last] = await db().select({ at: schema.chapterVersions.createdAt }).from(schema.chapterVersions)
      .where(eq(schema.chapterVersions.chapterId, chapterId)).orderBy(desc(schema.chapterVersions.createdAt)).limit(1);
    if (!last || now.getTime() - last.at.getTime() > AUTO_VERSION_GAP_MS) await snapshot(userId, { id: chapterId, title, content, wordCount }, "auto");
  }
  return { ok: true, revision: rows[0].revision, wordCount, savedAt: now.toISOString() };
}

export async function chaptersOf(projectId: string) {
  return db().select({ id: schema.chapters.id, title: schema.chapters.title, position: schema.chapters.position, wordCount: schema.chapters.wordCount })
    .from(schema.chapters).where(eq(schema.chapters.projectId, projectId)).orderBy(asc(schema.chapters.position));
}
