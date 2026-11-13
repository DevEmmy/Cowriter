import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, bad } from "@/lib/api";
import { loadVoice } from "@/lib/ai/prompts";
import { buildPrompt, promptInput, PROMPT_FIELDS } from "@/lib/ai/ideas";
import { aiConfigured } from "@/lib/ai/provider";
import { generateJson } from "@/lib/ai/json";
import { guard } from "@/lib/ai/run";

export const maxDuration = 26;

/** Builds a structured prompt from the writer's fields. With `fill`, AI suggests values only for EMPTY fields from a rough description. */
export const POST = authed(async (userId, req) => {
  const p = z.object({ fields: promptInput, fill: z.string().max(4000).optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Invalid request.");
  const voice = await loadVoice(userId);
  let fields = p.data.fields;
  if (p.data.fill?.trim()) {
    if (!aiConfigured()) return bad("AI is not set up yet, so fields cannot be suggested. You can still fill them in yourself.", 503);
    const res = await guard(async () => {
      const sug = await generateJson(`KIND:promptfields\nFrom the writer's rough description, suggest values for these prompt fields: ${PROMPT_FIELDS.join(", ")}. Only include fields the description supports; never invent plot facts. Reply with ONLY a JSON object of string values.`, [{ role: "user", content: p.data.fill! }], promptInput);
      return NextResponse.json({ sug });
    });
    if (!res.ok) return res;
    const sug = (await res.json()).sug as Record<string, string | undefined>;
    fields = { ...sug, ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v?.trim())) } as typeof fields;
  }
  return NextResponse.json({ fields, prompt: buildPrompt(fields, voice.instructions) });
});
