import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { authed, bad } from "@/lib/api";
import { db, schema } from "@/lib/db";

export const GET = authed(async (userId) => {
  const rows = await db().select().from(schema.savedPrompts).where(eq(schema.savedPrompts.userId, userId)).orderBy(desc(schema.savedPrompts.createdAt)).limit(100);
  return NextResponse.json({ prompts: rows });
});
export const POST = authed(async (userId, req) => {
  const p = z.object({ title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(20000) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Give the prompt a title and some content.");
  const [row] = await db().insert(schema.savedPrompts).values({ userId, ...p.data }).returning();
  return NextResponse.json({ prompt: row });
});
