import { z } from "zod";

const s = z.string().min(1).max(1500);
const titled = z.object({ title: s, summary: s });
export const SCHEMAS = {
  idea: z.object({ refined: s, directions: z.array(titled).min(1).max(5), weaknesses: z.array(s).max(8), opportunities: z.array(s).max(8), questions: z.array(s).max(8) }),
  characters: z.object({ characters: z.array(z.object({ name: s, role: s, motivation: s, conflict: s, relationships: s, arc: s })).min(1).max(8) }),
  plot: z.object({ conflicts: z.array(s).max(8), subplots: z.array(titled).max(8), arc: z.array(s).max(12), twists: z.array(titled).max(8), themes: z.array(s).max(8) }),
  chapters: z.object({ chapters: z.array(titled).min(1).max(60) }),
} as const;
export type Kind = keyof typeof SCHEMAS;
export const KINDS = Object.keys(SCHEMAS) as Kind[];

const SHAPES: Record<Kind, string> = {
  idea: `{"refined": string (the idea restated clearly, same story), "directions": [{"title","summary"}] (exactly 3 alternative directions), "weaknesses": [string], "opportunities": [string], "questions": [string] (questions the writer should answer)}`,
  characters: `{"characters": [{"name","role","motivation","conflict","relationships","arc"}]} (develop the characters the writer mentions; only propose new ones if asked, and label them as suggestions in "role")`,
  plot: `{"conflicts": [string], "subplots": [{"title","summary"}], "arc": [string] (ordered story beats), "twists": [{"title","summary"}], "themes": [string]}`,
  chapters: `{"chapters": [{"title","summary"}]} (a chapter-by-chapter breakdown following the story the writer described, in order)`,
};

export function ideaSystem(kind: Kind, context: string): string {
  return `KIND:${kind}
You are Co Writer's Idea Lab. Everything you produce is a SUGGESTION for the writer to accept or ignore. Never contradict or replace the storyline, names, facts or intentions the writer has already established; build on them.
${context ? `Existing project context:\n${context}\n` : ""}Reply with ONLY one JSON object, no commentary, matching exactly this shape:
${SHAPES[kind]}`;
}

export const PROMPT_FIELDS = ["context", "objective", "characters", "perspective", "style", "tone", "pacing", "description", "wordCount", "restrictions", "continuity", "ending"] as const;
export const promptInput = z.object(Object.fromEntries(PROMPT_FIELDS.map((f) => [f, z.string().max(3000).optional()])) as Record<(typeof PROMPT_FIELDS)[number], z.ZodOptional<z.ZodString>>);
const LABELS: Record<(typeof PROMPT_FIELDS)[number], string> = {
  context: "Story context", objective: "Scene objective", characters: "Character motivations", perspective: "Narrative perspective", style: "Writing style",
  tone: "Tone", pacing: "Pacing", description: "Descriptive expectations", wordCount: "Target length", restrictions: "Restrictions (do not do)", continuity: "Continuity requirements", ending: "Desired ending",
};
/** Assembles the prompt locally; nothing is invented for fields the writer left empty. */
export function buildPrompt(f: z.infer<typeof promptInput>, voice: string): string {
  const parts = PROMPT_FIELDS.filter((k) => f[k]?.trim()).map((k) => `${LABELS[k]}:\n${f[k]!.trim()}`);
  if (voice.trim()) parts.push(`Writer's voice rules:\n${voice.trim()}`);
  return [`Write the following scene as the author's co-writer. Preserve the author's ideas and established facts. Return only prose.`, ...parts].join("\n\n");
}
