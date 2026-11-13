import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assertSessionConfigured, createSession } from "@/lib/auth";

const Body = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
    assertSessionConfigured();
    const [u] = await db().select().from(schema.users).where(eq(schema.users.email, parsed.data.email)).limit(1);
    const ok = u && (await bcrypt.compare(parsed.data.password, u.passwordHash));
    if (!ok) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    await createSession(u.id);
    return NextResponse.json({ ok: true });
  } catch {
    // Never log database errors: they can include connection credentials or user data.
    console.error("Authentication service failed during login.");
    return NextResponse.json(
      { error: "Account services are temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }
}
