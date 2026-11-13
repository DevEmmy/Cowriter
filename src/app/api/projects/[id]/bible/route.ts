import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { authed, bad } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { ownedProject } from "@/lib/manuscript";
import { BIBLE_KINDS, bibleOf } from "@/lib/ai/story";

export const GET = authed<{ id: string }>(async (userId, _req, { id }) => {
  if (!(await ownedProject(userId, id))) return bad("Project not found.", 404);
  return NextResponse.json({ entries: await bibleOf(id) });
});

export const POST = authed<{ id: string }>(async (userId, req, { id }) => {
  if (!(await ownedProject(userId, id))) return bad("Project not found.", 404);
  const p = z.object({ kind: z.enum(BIBLE_KINDS), name: z.string().trim().min(1, "Give the entry a name.").max(120), body: z.string().max(4000).default("") }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad(p.error.issues[0]?.message ?? "Invalid entry.");
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(schema.bibleEntries).where(eq(schema.bibleEntries.projectId, id));
  if (n >= 300) return bad("This Story Bible is full (300 entries). Remove some entries first.");
  const [row] = await db().insert(schema.bibleEntries).values({ userId, projectId: id, ...p.data, position: n }).returning();
  return NextResponse.json({ entry: row });
});
