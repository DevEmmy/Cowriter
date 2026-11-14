import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { clientIp, hit, tooMany } from "@/lib/ratelimit";
import { peekToken, spendToken } from "@/lib/tokens";
import { setupHint } from "@/lib/diagnose";

const DEAD = "This reset link has expired or was already used. Ask for a new one.";

/** GET ?token= tells the page whether the link is still good (nothing is spent). */
export async function GET(req: Request) {
  try { return NextResponse.json({ valid: await peekToken(new URL(req.url).searchParams.get("token") ?? "", "reset") }); }
  catch (e) { console.error(e); return NextResponse.json({ valid: false }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const p = z.object({ token: z.string(), password: z.string().min(8).max(200) }).safeParse(await req.json().catch(() => null));
    if (!p.success) return NextResponse.json({ error: "Choose a password of at least 8 characters." }, { status: 400 });
    const r = await hit(`reset:ip:${clientIp(req)}`, 10, 3600); if (!r.ok) return tooMany(r.retryAfter);
    const userId = await spendToken(p.data.token, "reset");
    if (!userId) return NextResponse.json({ error: DEAD }, { status: 400 });
    // A reset link proves control of the inbox, so the email also counts as verified.
    await db().update(schema.users).set({ passwordHash: await bcrypt.hash(p.data.password, 11), emailVerifiedAt: new Date(), passwordChangedAt: new Date() }).where(eq(schema.users.id, userId));
    await createSession(userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: setupHint(e) ?? "Something went wrong. Please try again." }, { status: 500 });
  }
}
