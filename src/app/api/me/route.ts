import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { authed, bad } from "@/lib/api";
import { db, schema } from "@/lib/db";

export const PATCH = authed(async (userId, req) => {
  const p = z.object({ name: z.string().trim().max(80).optional(), dailyGoal: z.number().int().min(50).max(50000).optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Enter a daily goal between 50 and 50,000 words.");
  await db().update(schema.users).set(p.data).where(eq(schema.users.id, userId));
  return NextResponse.json({ ok: true });
});
