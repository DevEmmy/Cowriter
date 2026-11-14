import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { authed, bad } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { emailConfigured, sendEmail, siteUrl, verifyEmail } from "@/lib/email";
import { hit, tooMany } from "@/lib/ratelimit";
import { issueToken, spendToken } from "@/lib/tokens";
import { setupHint } from "@/lib/diagnose";

/** POST {token} confirms an address from the emailed link (works even if the person is not logged in on this device). */
export async function POST(req: Request) {
  try {
    const p = z.object({ token: z.string() }).safeParse(await req.json().catch(() => null));
    if (!p.success) return bad("This confirmation link is not valid.");
    const userId = await spendToken(p.data.token, "verify");
    if (!userId) return bad("This confirmation link has expired or was already used. Log in and ask for a new one.");
    await db().update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, userId));
    return NextResponse.json({ ok: true });
  } catch (e) { console.error(e); return NextResponse.json({ error: setupHint(e) ?? "Something went wrong. Please try again." }, { status: 500 }); }
}

/** PUT sends (or re-sends) the confirmation email to the logged-in person. */
export const PUT = authed(async (userId, req) => {
  if (!emailConfigured()) return bad("Email is not set up on this site yet.", 503);
  const [u] = await db().select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!u) return bad("Not found.", 404);
  if (u.emailVerifiedAt) return NextResponse.json({ ok: true, already: true });
  const r = await hit(`verify:${userId}`, 3, 3600); if (!r.ok) return tooMany(r.retryAfter);
  const m = verifyEmail(`${siteUrl(req)}/verify?token=${await issueToken(userId, "verify")}`);
  try { await sendEmail(u.email, m.subject, m.text, m.html); } catch (e) { console.error("verify email failed", e instanceof Error ? e.message : e); return bad("We could not send the email just now. Please try again in a few minutes.", 502); }
  return NextResponse.json({ ok: true });
});
