import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { authed, bad } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { ownedProject } from "@/lib/manuscript";

export const PATCH = authed<{ id: string }>(async (userId, req, { id }) => {
  if (!(await ownedProject(userId, id))) return bad("Project not found.", 404);
  const p = z.object({ title: z.string().trim().min(1).max(150).optional(), favorite: z.boolean().optional(), archived: z.boolean().optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Invalid change.");
  await db().update(schema.projects).set({ ...p.data, updatedAt: new Date() }).where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)));
  return NextResponse.json({ ok: true });
});

export const DELETE = authed<{ id: string }>(async (userId, req, { id }) => {
  const proj = await ownedProject(userId, id);
  if (!proj) return bad("Project not found.", 404);
  // Deletion must be confirmed by repeating the exact title, so it cannot happen by accident.
  const body = await req.json().catch(() => null);
  if (body?.confirmTitle !== proj.title) return bad("Type the project title to confirm deletion.", 400);
  await db().delete(schema.projects).where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)));
  return NextResponse.json({ ok: true });
});
