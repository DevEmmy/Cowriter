import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq, asc } from "drizzle-orm";
import { authed, bad, isId } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { generateJson } from "@/lib/ai/json";
import { aiConfigured } from "@/lib/ai/provider";
import { guard } from "@/lib/ai/run";
import { loadVoice, systemPrompt } from "@/lib/ai/prompts";
import { KINDS, SCHEMAS, ideaSystem } from "@/lib/ai/ideas";
import { ownedProject } from "@/lib/manuscript";
import { htmlToText } from "@/lib/words";

export const maxDuration = 26;

export const GET = authed(async (userId) => {
  const rows = await db().select().from(schema.ideas).where(eq(schema.ideas.userId, userId)).orderBy(desc(schema.ideas.createdAt)).limit(50);
  return NextResponse.json({ ideas: rows });
});

const body = z.object({ kind: z.enum(KINDS as [string, ...string[]]), input: z.string().trim().min(10, "Describe your idea in a sentence or two.").max(6000), projectId: z.string().optional() });

export const POST = authed(async (userId, req) => {
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return bad(p.error.issues[0]?.message ?? "Invalid request.");
  const { kind, input, projectId } = p.data;
  if (!aiConfigured()) return bad("AI is not set up yet. Add GEMINI_API_KEY in your environment settings.", 503);
  let context = "";
  if (projectId) {
    if (!isId(projectId)) return bad("Invalid project.");
    const proj = await ownedProject(userId, projectId);
    if (!proj) return bad("Project not found.", 404);
    const chs = (await db().select({ title: schema.chapters.title, content: schema.chapters.content }).from(schema.chapters).where(eq(schema.chapters.projectId, projectId)).orderBy(asc(schema.chapters.position))).filter((c) => c.content.trim());
    context = `Title: ${proj.title}\n` + chs.slice(-3).map((c) => `${c.title}: ${htmlToText(c.content).slice(0, 1200)}`).join("\n");
  }
  const voice = await loadVoice(userId, projectId);
  return guard(async () => {
    const result = await generateJson(systemPrompt(voice, ideaSystem(kind as keyof typeof SCHEMAS, context)), [{ role: "user", content: input }], SCHEMAS[kind as keyof typeof SCHEMAS] as z.ZodType<unknown>);
    const [row] = await db().insert(schema.ideas).values({ userId, projectId: projectId ?? null, kind, input, result: result as object }).returning();
    return NextResponse.json({ idea: row });
  });
});
