import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { emailConfigured, resetEmail, sendEmail, siteUrl } from "@/lib/email";
import { clientIp, hit, tooMany } from "@/lib/ratelimit";
import { issueToken } from "@/lib/tokens";
import { setupHint } from "@/lib/diagnose";

const SAME = { ok: true, message: "If an account exists for that email, we have sent a link to reset the password. It can take a few minutes to arrive." };

export async function POST(req: Request) {
  try {
    if (!emailConfigured()) return NextResponse.json({ error: "Password reset by email is not set up on this site yet. Please contact the site owner." }, { status: 503 });
    const p = z.object({ email: z.string().trim().toLowerCase().email() }).safeParse(await req.json().catch(() => null));
    if (!p.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const ip = await hit(`forgot:ip:${clientIp(req)}`, 10, 3600); if (!ip.ok) return tooMany(ip.retryAfter);
    const em = await hit(`forgot:em:${p.data.email}`, 3, 3600); if (!em.ok) return NextResponse.json(SAME); // quietly stop mailing an address that is being hammered
    const [u] = await db().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, p.data.email)).limit(1);
    if (u) {
      const link = `${siteUrl(req)}/reset?token=${await issueToken(u.id, "reset")}`;
      const m = resetEmail(link);
      await sendEmail(p.data.email, m.subject, m.text, m.html).catch((e) => console.error("reset email failed", e instanceof Error ? e.message : e));
    }
    return NextResponse.json(SAME);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: setupHint(e) ?? "Something went wrong. Please try again." }, { status: 500 });
  }
}
