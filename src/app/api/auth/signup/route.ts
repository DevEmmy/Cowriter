import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { setupHint } from "@/lib/diagnose";
import { clientIp, hit, tooMany } from "@/lib/ratelimit";
import { emailConfigured, sendEmail, siteUrl, verifyEmail } from "@/lib/email";
import { issueToken } from "@/lib/tokens";

const Body = z.object({
  name: z.string().trim().max(80).default(""),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

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
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and a password of 8+ characters." }, { status: 400 });
  const { name, email, password } = parsed.data;
  const rl = await hit(`signup:ip:${clientIp(req)}`, 10, 3600); if (!rl.ok) return tooMany(rl.retryAfter);
  const [existing] = await db().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  const [u] = await db().insert(schema.users).values({ name, email, passwordHash: await bcrypt.hash(password, 11) }).returning({ id: schema.users.id });
  if (emailConfigured()) {
    const m = verifyEmail(`${siteUrl(req)}/verify?token=${await issueToken(u.id, "verify")}`);
    await sendEmail(email, m.subject, m.text, m.html).catch((e) => console.error("verify email failed", e instanceof Error ? e.message : e));
  }
  await createSession(u.id);
  return NextResponse.json({ ok: true });
}
