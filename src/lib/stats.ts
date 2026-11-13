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

/** Numbers for the Writing Analytics page: 30 days of words, streaks, goal days and per-project totals. */
export async function analyticsFor(userId: string, dailyGoal: number) {
  const since = new Date(Date.now() - 365 * 86400000);
  const rows = await db().select({ day: schema.writingStats.day, words: schema.writingStats.words }).from(schema.writingStats).where(and(eq(schema.writingStats.userId, userId), gte(schema.writingStats.day, dayStr(since))));
  const by = new Map(rows.map((r) => [r.day, r.words]));
  const days = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - (29 - i)); const k = dayStr(d); return { day: k, label: d.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" }), words: by.get(k) ?? 0 }; });
  const total30 = days.reduce((a, d) => a + d.words, 0), active = days.filter((d) => d.words > 0);
  const best = days.reduce((m, d) => (d.words > m.words ? d : m), days[0]);
  let longest = 0, run = 0;
  for (let i = 0; i < 365; i++) { const d = new Date(); d.setUTCDate(d.getUTCDate() - (364 - i)); if ((by.get(dayStr(d)) ?? 0) > 0) { run++; longest = Math.max(longest, run); } else run = 0; }
  const perProject = await db().select({ id: schema.projects.id, title: schema.projects.title, words: sql<number>`coalesce(sum(${schema.chapters.wordCount}),0)::int`, chapters: sql<number>`count(${schema.chapters.id})::int`, updatedAt: schema.projects.updatedAt })
    .from(schema.projects).leftJoin(schema.chapters, eq(schema.chapters.projectId, schema.projects.id)).where(eq(schema.projects.userId, userId)).groupBy(schema.projects.id).orderBy(desc(sql`coalesce(sum(${schema.chapters.wordCount}),0)`));
  const all = await dashboardStats(userId);
  return { days, total30, activeDays: active.length, avgPerActiveDay: active.length ? Math.round(total30 / active.length) : 0, best, goalDays: days.filter((d) => d.words >= dailyGoal).length, longestStreak: longest, streak: all.streak, totalWords: all.totalWords, perProject };
}
