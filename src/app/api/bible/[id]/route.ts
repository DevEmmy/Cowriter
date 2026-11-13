import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { authed, bad, isId } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { BIBLE_KINDS } from "@/lib/ai/story";

const own = (userId: string, id: string) => and(eq(schema.bibleEntries.id, id), eq(schema.bibleEntries.userId, userId));

export const PATCH = authed<{ id: string }>(async (userId, req, { id }) => {
  if (!isId(id)) return bad("Not found.", 404);
  const p = z.object({ kind: z.enum(BIBLE_KINDS).optional(), name: z.string().trim().min(1).max(120).optional(), body: z.string().max(4000).optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Invalid entry.");
  const [row] = await db().update(schema.bibleEntries).set({ ...p.data, updatedAt: new Date() }).where(own(userId, id)).returning();
  return row ? NextResponse.json({ entry: row }) : bad("Not found.", 404);
});
export const DELETE = authed<{ id: string }>(async (userId, _req, { id }) => {
  if (!isId(id)) return bad("Not found.", 404);
  const r = await db().delete(schema.bibleEntries).where(own(userId, id)).returning({ id: schema.bibleEntries.id });
  return r.length ? NextResponse.json({ ok: true }) : bad("Not found.", 404);
});
