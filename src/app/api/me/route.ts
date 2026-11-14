import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { destroySession } from "@/lib/auth";
import { clear, hit, tooMany } from "@/lib/ratelimit";
import { authed, bad } from "@/lib/api";
import { db, schema } from "@/lib/db";

export const PATCH = authed(async (userId, req) => {
  const p = z.object({ name: z.string().trim().max(80).optional(), dailyGoal: z.number().int().min(50).max(50000).optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Enter a daily goal between 50 and 50,000 words.");
  await db().update(schema.users).set(p.data).where(eq(schema.users.id, userId));
  return NextResponse.json({ ok: true });
});

/** Permanently deletes the account and everything in it (projects, chapters, versions, notes, covers). Needs the password. */
export const DELETE = authed(async (userId, req) => {
  const p = z.object({ password: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Enter your password to confirm.");
  const key = `del:${userId}`; const r = await hit(key, 5, 900); if (!r.ok) return tooMany(r.retryAfter);
  const [u] = await db().select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!u || !(await bcrypt.compare(p.data.password, u.passwordHash))) return bad("That password is not correct.");
  await db().delete(schema.users).where(eq(schema.users.id, userId)); // every table cascades from users
  await clear(key);
  await destroySession();
  return NextResponse.json({ ok: true });
});
