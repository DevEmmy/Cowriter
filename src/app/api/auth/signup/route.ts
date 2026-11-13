import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db, schema } from "@/lib/db";
import { assertSessionConfigured, createSession } from "@/lib/auth";

const Body = z.object({
  name: z.string().trim().max(80).default(""),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and a password of 8+ characters." }, { status: 400 });
    const { name, email, password } = parsed.data;
    assertSessionConfigured();
    const [u] = await db().insert(schema.users)
      .values({ name, email, passwordHash: await bcrypt.hash(password, 11) })
      .onConflictDoNothing({ target: schema.users.email })
      .returning({ id: schema.users.id });
    if (!u) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    await createSession(u.id);
    return NextResponse.json({ ok: true });
  } catch {
    // Never log database errors: they can include connection credentials or user data.
    console.error("Authentication service failed during signup.");
    return NextResponse.json(
      { error: "Account services are temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }
}
