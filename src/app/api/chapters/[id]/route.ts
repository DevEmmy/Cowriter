import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { authed, bad } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { ownedChapter, saveChapter } from "@/lib/manuscript";

const MAX_CONTENT = 2_000_000;

export const GET = authed<{ id: string }>(async (userId, _req, { id }) => {
  const c = await ownedChapter(userId, id);
  return c ? NextResponse.json(c) : bad("Chapter not found.", 404);
});

export const PATCH = authed<{ id: string }>(async (userId, req, { id }) => {
  const p = z.object({ content: z.string().max(MAX_CONTENT).optional(), title: z.string().max(200).optional(), revision: z.number().int().min(1) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Invalid save request.");
  const r = await saveChapter(userId, id, p.data);
  if (!r) return bad("Chapter not found.", 404);
  if (!r.ok) return NextResponse.json({ error: "This chapter was changed somewhere else (another tab or device). Reload to see the latest version before editing.", conflict: true, revision: r.revision }, { status: 409 });
  return NextResponse.json(r);
});

export const DELETE = authed<{ id: string }>(async (userId, _req, { id }) => {
  const c = await ownedChapter(userId, id);
  if (!c) return bad("Chapter not found.", 404);
  await db().delete(schema.chapters).where(and(eq(schema.chapters.id, id), eq(schema.chapters.userId, userId)));
  return NextResponse.json({ ok: true });
});
