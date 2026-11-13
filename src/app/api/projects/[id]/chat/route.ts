import { NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { authed, bad, isId } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { ownedChapter, ownedProject, chaptersOf } from "@/lib/manuscript";
import { generate } from "@/lib/ai/provider";
import { finish, loadVoice, systemPrompt } from "@/lib/ai/prompts";
import { htmlToText } from "@/lib/words";
import { guard } from "@/lib/ai/run";

export const maxDuration = 26;
const HISTORY = 16;

export const GET = authed<{ id: string }>(async (userId, _req, { id }) => {
  if (!(await ownedProject(userId, id))) return bad("Project not found.", 404);
  const rows = await db().select({ id: schema.messages.id, role: schema.messages.role, content: schema.messages.content, createdAt: schema.messages.createdAt })
    .from(schema.messages).where(and(eq(schema.messages.projectId, id), eq(schema.messages.userId, userId))).orderBy(asc(schema.messages.createdAt)).limit(200);
  return NextResponse.json(rows);
});

export const DELETE = authed<{ id: string }>(async (userId, _req, { id }) => {
  if (!(await ownedProject(userId, id))) return bad("Project not found.", 404);
  await db().delete(schema.messages).where(and(eq(schema.messages.projectId, id), eq(schema.messages.userId, userId)));
  return NextResponse.json({ ok: true });
});

export const POST = authed<{ id: string }>(async (userId, req, { id }) => {
  const proj = await ownedProject(userId, id);
  if (!proj) return bad("Project not found.", 404);
  const p = z.object({ message: z.string().trim().min(1).max(4000), chapterId: z.string().optional(), selection: z.string().max(12000).optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Write a message of up to 4,000 characters.");
  const chapter = p.data.chapterId && isId(p.data.chapterId) ? await ownedChapter(userId, p.data.chapterId) : null;
  if (chapter && chapter.projectId !== id) return bad("Chapter not found.", 404);

  const voice = await loadVoice(userId, id);
  const chapters = await chaptersOf(id);
  const body = chapter ? htmlToText(chapter.content).replace(/\s+/g, " ").trim().split(" ").slice(0, 9000).join(" ") : "";
  const context = [
    `Project: "${proj.title}" (${proj.type.replace("_", " ")}). Chapters: ${chapters.map((c) => `${c.title} (${c.wordCount} words)`).join("; ")}.`,
    chapter && `The writer is working on "${chapter.title}". Its current text follows between the markers.\n<<<CHAPTER\n${body}\nCHAPTER>>>`,
    p.data.selection && `The writer has selected this passage:\n<<<SELECTION\n${p.data.selection}\nSELECTION>>>`,
    "Only chapter text you can see above counts as established story. Treat your own earlier suggestions as suggestions, not as facts. When you propose rewritten text, make clear it is a suggestion; the writer decides what to use. Be conversational and concise unless asked for prose.",
  ].filter(Boolean).join("\n\n");

  const prior = await db().select().from(schema.messages).where(and(eq(schema.messages.projectId, id), eq(schema.messages.userId, userId))).orderBy(desc(schema.messages.createdAt)).limit(HISTORY);
  const history = prior.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  return guard(async () => {
    const reply = finish(await generate({ system: systemPrompt(voice, context), messages: [...history, { role: "user", content: p.data.message }], temperature: 0.8, maxOutputTokens: 3000 }), voice);
    // Save only after the model answered, so a failed call leaves no orphan half-conversation.
    await db().insert(schema.messages).values([{ userId, projectId: id, chapterId: chapter?.id ?? null, role: "user", content: p.data.message }]);
    await db().insert(schema.messages).values([{ userId, projectId: id, chapterId: chapter?.id ?? null, role: "assistant", content: reply }]);
    return NextResponse.json({ reply });
  });
});
