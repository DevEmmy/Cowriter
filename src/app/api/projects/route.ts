import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, bad } from "@/lib/api";
import { db, schema } from "@/lib/db";

export const PROJECT_TYPES = ["novel", "short_story", "screenplay", "article", "blog_post", "poetry", "custom"] as const;

export const POST = authed(async (userId, req) => {
  const p = z.object({ title: z.string().trim().min(1).max(150), type: z.enum(PROJECT_TYPES).default("novel") }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Give your project a title.");
  const [proj] = await db().insert(schema.projects).values({ userId, ...p.data }).returning({ id: schema.projects.id });
  const [ch] = await db().insert(schema.chapters).values({ projectId: proj.id, userId, title: p.data.type === "novel" ? "Chapter 1" : "Untitled", position: 0 }).returning({ id: schema.chapters.id });
  return NextResponse.json({ id: proj.id, chapterId: ch.id });
});
