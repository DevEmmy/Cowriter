import { eq, and, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { stripDashes } from "./textstats";

export interface VoiceCtx { instructions: string; summary: string }

/** Merges the user's global voice with any project-specific one (project instructions come last and win). */
export async function loadVoice(userId: string, projectId?: string): Promise<VoiceCtx> {
  const scopes = projectId ? ["global", projectId] : ["global"];
  const rows = await db().select().from(schema.writingProfiles).where(and(eq(schema.writingProfiles.userId, userId), inArray(schema.writingProfiles.scope, scopes)));
  const g = rows.find((r) => r.scope === "global"), p = rows.find((r) => r.scope !== "global");
  const instructions = [g?.instructions, p?.instructions].filter(Boolean).join("\n");
  const sum = (r?: typeof g) => ((r?.analysis as { summary?: string } | null)?.summary ?? "");
  return { instructions, summary: p ? sum(p) || sum(g) : sum(g) };
}

export const wantsNoDashes = (v: VoiceCtx) => /dash/i.test(v.instructions);
/** Hard rules are enforced in code after generation, not only requested in the prompt. */
export const finish = (text: string, v: VoiceCtx) => (wantsNoDashes(v) ? stripDashes(text) : text).trim();

const CORE = `You are Co Writer, a literary writing partner. You work for the writer and never take creative ownership from them.
Rules you always follow:
- Preserve the writer's ideas, plot, character names, facts and intentions. Never invent characters, events, secrets or backstory that the writer has not established.
- Keep the writer's voice, narrative perspective and tense.
- Write natural, specific prose with varied sentence length. Avoid stock phrases and generic dramatic statements. Do not force metaphors into every paragraph.
- Do not add summaries, notes or explanations to prose you are asked to write. Return only the prose unless asked to discuss.
- If something needed is missing, ask the writer instead of guessing.`;

export function systemPrompt(v: VoiceCtx, extra = ""): string {
  return [CORE, v.summary && `The writer's voice profile:\n${v.summary}`, v.instructions && `The writer's standing instructions (follow strictly):\n${v.instructions}`, extra].filter(Boolean).join("\n\n");
}
