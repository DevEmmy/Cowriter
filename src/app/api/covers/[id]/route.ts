import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { authed, bad, isId } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { designSchema } from "@/lib/cover";

const own = (userId: string, id: string) => and(eq(schema.covers.id, id), eq(schema.covers.userId, userId));
export const PATCH = authed<{ id: string }>(async (userId, req, { id }) => {
  if (!isId(id)) return bad("Not found.", 404);
  const p = z.object({ name: z.string().trim().min(1).max(80).optional(), design: designSchema.optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Invalid cover.");
  const [row] = await db().update(schema.covers).set({ ...p.data, updatedAt: new Date() }).where(own(userId, id)).returning();
  return row ? NextResponse.json({ cover: row }) : bad("Not found.", 404);
});
export const DELETE = authed<{ id: string }>(async (userId, _req, { id }) => {
  if (!isId(id)) return bad("Not found.", 404);
  const r = await db().delete(schema.covers).where(own(userId, id)).returning({ id: schema.covers.id });
  return r.length ? NextResponse.json({ ok: true }) : bad("Not found.", 404);
});
