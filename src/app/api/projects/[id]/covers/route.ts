import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { authed, bad } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { ownedProject } from "@/lib/manuscript";
import { designSchema } from "@/lib/cover";

export const GET = authed<{ id: string }>(async (userId, _req, { id }) => {
  if (!(await ownedProject(userId, id))) return bad("Project not found.", 404);
  return NextResponse.json({ covers: await db().select().from(schema.covers).where(eq(schema.covers.projectId, id)).orderBy(desc(schema.covers.updatedAt)) });
});
export const POST = authed<{ id: string }>(async (userId, req, { id }) => {
  if (!(await ownedProject(userId, id))) return bad("Project not found.", 404);
  const p = z.object({ name: z.string().trim().min(1, "Name this design.").max(80), design: designSchema }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad(p.error.issues[0]?.message ?? "Invalid cover.");
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(schema.covers).where(eq(schema.covers.projectId, id));
  if (n >= 20) return bad("You have 20 saved covers for this project. Delete one first.");
  const [row] = await db().insert(schema.covers).values({ userId, projectId: id, name: p.data.name, design: p.data.design }).returning();
  return NextResponse.json({ cover: row });
});
