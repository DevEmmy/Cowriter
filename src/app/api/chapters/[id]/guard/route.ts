import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { authed, bad } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { ownedChapter } from "@/lib/manuscript";
import { guard } from "@/lib/ai/run";
import { runGuard } from "@/lib/ai/story";

export const maxDuration = 26;

export const GET = authed<{ id: string }>(async (userId, _req, { id }) => {
  const c = await ownedChapter(userId, id);
  if (!c) return bad("Chapter not found.", 404);
  const [r] = await db().select().from(schema.guardReports).where(eq(schema.guardReports.chapterId, id)).orderBy(desc(schema.guardReports.createdAt)).limit(1);
  return NextResponse.json({ report: r ?? null });
});

/** Runs Story Guard on a chapter. Reports suggestions only; the manuscript is never changed. */
export const POST = authed<{ id: string }>(async (userId, _req, { id }) => {
  const c = await ownedChapter(userId, id);
  if (!c) return bad("Chapter not found.", 404);
  if (c.content.trim().length < 20) return bad("This chapter is empty. Write something first.");
  return guard(async () => {
    const r = await runGuard(userId, c);
    const [row] = await db().insert(schema.guardReports).values({ userId, projectId: c.projectId, chapterId: c.id, issues: { issues: r.issues, dropped: r.dropped, note: r.note ?? null }, usedAi: r.usedAi }).returning();
    return NextResponse.json({ report: row });
  });
});
