import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { setupHint } from "@/lib/diagnose";
import { clear, clientIp, hit, tooMany } from "@/lib/ratelimit";

const Body = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: setupHint(e) ?? "Something went wrong. Please try again." }, { status: 500 });
  }
}

async function handle(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  const ip = clientIp(req);
  const byIp = await hit(`login:ip:${ip}`, 40, 900); if (!byIp.ok) return tooMany(byIp.retryAfter);
  const emailKey = `login:em:${parsed.data.email}:${ip}`;
  const byEmail = await hit(emailKey, 8, 900); if (!byEmail.ok) return tooMany(byEmail.retryAfter);
  const [u] = await db().select().from(schema.users).where(eq(schema.users.email, parsed.data.email)).limit(1);
  const ok = u && (await bcrypt.compare(parsed.data.password, u.passwordHash));
  if (!ok) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  await clear(emailKey);
  await createSession(u.id);
  return NextResponse.json({ ok: true });
}
