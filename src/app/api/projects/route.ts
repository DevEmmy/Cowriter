import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function POST(req: Request) {
  let userId: string;
  try { userId = await requireUserId(); } catch (r) { return r as Response; }
  const parsed = z.object({ title: z.string().trim().min(1).max(120) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Give your project a title." }, { status: 400 });
  const [p] = await db().insert(schema.projects).values({ userId, title: parsed.data.title, status: "uploading" }).returning({ id: schema.projects.id });
  return NextResponse.json({ id: p.id });
}
