import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, bad } from "@/lib/api";
import { ownedProject } from "@/lib/manuscript";
import { generate } from "@/lib/ai/provider";
import { finish, loadVoice, systemPrompt } from "@/lib/ai/prompts";
import { guard } from "@/lib/ai/run";

export const maxDuration = 26;
export const GOALS: Record<string, string> = {
  rhythm: "improve sentence rhythm and variety", imagery: "strengthen imagery with specific, concrete details", vocabulary: "enrich vocabulary while keeping it simple and natural",
  flow: "improve paragraph flow and transitions", emotion: "strengthen emotional delivery through thought, reaction and body language", dialogue: "make the dialogue sound more natural",
  atmosphere: "develop atmosphere through the setting and senses", repetition: "remove repetition", show: "show instead of tell",
};

export const POST = authed(async (userId, req) => {
  const p = z.object({ projectId: z.string(), passage: z.string().trim().min(10).max(9000), goals: z.array(z.string()).max(9).default([]), instruction: z.string().max(1000).default("") }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Select a passage of at least a few words (up to about 1,500 words).");
  if (!(await ownedProject(userId, p.data.projectId))) return bad("Project not found.", 404);
  const goals = p.data.goals.map((g) => GOALS[g]).filter(Boolean);
  if (!goals.length && !p.data.instruction.trim()) return bad("Choose at least one improvement or describe what you want.");
  const voice = await loadVoice(userId, p.data.projectId);
  return guard(async () => {
    const text = await generate({
      system: systemPrompt(voice, "Task: improve the passage. Keep every fact, event, name and the meaning exactly. Keep roughly the same length unless asked otherwise. Return only the improved passage."),
      messages: [{ role: "user", content: `Improve this passage. Goals: ${[...goals, p.data.instruction.trim()].filter(Boolean).join("; ")}.\n\nPASSAGE:\n${p.data.passage}` }],
      temperature: 0.7, maxOutputTokens: 3000,
    });
    return NextResponse.json({ suggestion: finish(text, voice) });
  });
});
