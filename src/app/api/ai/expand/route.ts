import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, bad } from "@/lib/api";
import { ownedProject } from "@/lib/manuscript";
import { generate } from "@/lib/ai/provider";
import { finish, loadVoice, systemPrompt } from "@/lib/ai/prompts";
import { MODES } from "@/lib/ai/expand";
import { guard } from "@/lib/ai/run";

export const maxDuration = 26;

// Expands ONE section. The browser drives the loop section by section so each request stays short
// and a failure only costs one section.
export const POST = authed(async (userId, req) => {
  const p = z.object({
    projectId: z.string(), mode: z.enum(Object.keys(MODES) as [keyof typeof MODES, ...Array<keyof typeof MODES>]),
    section: z.string().min(1).max(9000), wanted: z.number().int().min(10).max(2500), words: z.number().int().min(1),
    before: z.string().max(2500).default(""), after: z.string().max(1500).default(""), instruction: z.string().max(1000).default(""),
  }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Invalid expansion request.");
  if (!(await ownedProject(userId, p.data.projectId))) return bad("Project not found.", 404);
  const voice = await loadVoice(userId, p.data.projectId);
  const d = p.data;
  return guard(async () => {
    const text = await generate({
      system: systemPrompt(voice, `Task: expand a section of a chapter. ${MODES[d.mode]}
Keep every event, fact, name and the order of events. Do not add new characters, plot developments or revelations. Develop what is already there with meaningful detail; never pad, repeat a point, or restate earlier text. Match the existing voice, perspective and tense. Output only the expanded section as plain paragraphs separated by blank lines.`),
      messages: [{ role: "user", content: `${d.before ? `The text just before this section (for continuity only, do not rewrite it):\n${d.before}\n\n` : ""}${d.after ? `The text that follows this section (do not reach into it):\n${d.after}\n\n` : ""}${d.instruction ? `Extra instruction from the writer: ${d.instruction}\n\n` : ""}Expand the section below from ${d.words} words to ABOUT ${d.wanted} WORDS.\n\nSECTION:\n${d.section}` }],
      temperature: 0.8, maxOutputTokens: Math.min(8000, Math.ceil(d.wanted * 2.2) + 300),
    });
    return NextResponse.json({ text: finish(text, voice) });
  });
});
