import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { authed, bad, isId } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { chaptersOf, ownedProject } from "@/lib/manuscript";

export const POST = authed<{ id: string }>(async (userId, req, { id }) => {
  if (!(await ownedProject(userId, id))) return bad("Project not found.", 404);
  const existing = await chaptersOf(id);
  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 200) : `Chapter ${existing.length + 1}`;
  const [ch] = await db().insert(schema.chapters).values({ projectId: id, userId, title, position: existing.length }).returning({ id: schema.chapters.id });
  return NextResponse.json({ id: ch.id });
});

// Reorder: body { ids: [...] } must be exactly this project's chapters.
export const PUT = authed<{ id: string }>(async (userId, req, { id }) => {
  if (!(await ownedProject(userId, id))) return bad("Project not found.", 404);
  const p = z.object({ ids: z.array(z.string()).max(2000) }).safeParse(await req.json().catch(() => null));
  if (!p.success || !p.data.ids.every(isId)) return bad("Invalid order.");
  const existing = (await chaptersOf(id)).map((c) => c.id).sort();
  if (JSON.stringify([...p.data.ids].sort()) !== JSON.stringify(existing)) return bad("Chapter list is out of date. Refresh and try again.", 409);
  for (let i = 0; i < p.data.ids.length; i++)
    await db().update(schema.chapters).set({ position: i }).where(and(eq(schema.chapters.id, p.data.ids[i]), eq(schema.chapters.userId, userId)));
  return NextResponse.json({ ok: true });
});
