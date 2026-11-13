import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { setupHint } from "@/lib/diagnose";

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
  const [u] = await db().select().from(schema.users).where(eq(schema.users.email, parsed.data.email)).limit(1);
  const ok = u && (await bcrypt.compare(parsed.data.password, u.passwordHash));
  if (!ok) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  await createSession(u.id);
  return NextResponse.json({ ok: true });
}
