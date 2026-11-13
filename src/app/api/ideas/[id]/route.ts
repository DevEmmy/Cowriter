import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { authed, bad, isId } from "@/lib/api";
import { db, schema } from "@/lib/db";

export const DELETE = authed<{ id: string }>(async (userId, _req, { id }) => {
  if (!isId(id)) return bad("Not found.", 404);
  const r = await db().delete(schema.ideas).where(and(eq(schema.ideas.id, id), eq(schema.ideas.userId, userId))).returning({ id: schema.ideas.id });
  return r.length ? NextResponse.json({ ok: true }) : bad("Not found.", 404);
});
