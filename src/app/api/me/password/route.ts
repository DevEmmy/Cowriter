import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { authed, bad } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { clear, hit, tooMany } from "@/lib/ratelimit";

/** Change password while signed in. Needs the current password; signs out other devices and keeps this one. */
export const POST = authed(async (userId, req) => {
  const p = z.object({ current: z.string().min(1), next: z.string().min(8).max(200) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Enter your current password and a new one of at least 8 characters.");
  const key = `pw:${userId}`; const r = await hit(key, 6, 900); if (!r.ok) return tooMany(r.retryAfter);
  const [u] = await db().select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!u || !(await bcrypt.compare(p.data.current, u.passwordHash))) return bad("Your current password is not correct.", 400);
  await db().update(schema.users).set({ passwordHash: await bcrypt.hash(p.data.next, 11), passwordChangedAt: new Date() }).where(eq(schema.users.id, userId));
  await clear(key);
  await createSession(userId);
  return NextResponse.json({ ok: true });
});
