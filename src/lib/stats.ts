import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const dayStr = (d: Date) => d.toISOString().slice(0, 10);

export async function dashboardStats(userId: string) {
  const since = new Date(Date.now() - 120 * 86400000);
  const rows = await db().select({ day: schema.writingStats.day, words: schema.writingStats.words })
    .from(schema.writingStats).where(and(eq(schema.writingStats.userId, userId), gte(schema.writingStats.day, dayStr(since))));
  const byDay = new Map(rows.map((r) => [r.day, r.words]));
  const todayKey = dayStr(new Date());
  // Streak counts back from today, or from yesterday if nothing has been written yet today.
  let streak = 0;
  const cursor = new Date();
  if (!(byDay.get(todayKey) ?? 0)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while ((byDay.get(dayStr(cursor)) ?? 0) > 0) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setUTCDate(d.getUTCDate() - (6 - i));
    return { day: dayStr(d), label: d.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" }), words: byDay.get(dayStr(d)) ?? 0 };
  });
  const [tot] = await db().select({ words: sql<number>`coalesce(sum(${schema.chapters.wordCount}),0)::int`, chapters: sql<number>`count(*)::int` })
    .from(schema.chapters).where(eq(schema.chapters.userId, userId));
  const [pc] = await db().select({ n: sql<number>`count(*)::int` }).from(schema.projects).where(and(eq(schema.projects.userId, userId), eq(schema.projects.archived, false)));
  const recent = await db().select({ id: schema.projects.id, title: schema.projects.title, type: schema.projects.type, favorite: schema.projects.favorite, updatedAt: schema.projects.updatedAt })
    .from(schema.projects).where(and(eq(schema.projects.userId, userId), eq(schema.projects.archived, false))).orderBy(desc(schema.projects.updatedAt)).limit(6);
  const activity = await db().select({ id: schema.chapters.id, projectId: schema.chapters.projectId, title: schema.chapters.title, words: schema.chapters.wordCount, at: schema.chapters.updatedAt })
    .from(schema.chapters).where(eq(schema.chapters.userId, userId)).orderBy(desc(schema.chapters.updatedAt)).limit(6);
  return { todayWords: byDay.get(todayKey) ?? 0, streak, week, totalWords: tot.words, totalChapters: tot.chapters, projectCount: pc.n, recent, activity };
}
