import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, bad } from "@/lib/api";
import { ownedProject } from "@/lib/manuscript";
import { aiConfigured } from "@/lib/ai/provider";
import { generateJson } from "@/lib/ai/json";
import { guard } from "@/lib/ai/run";
import { memoryOf } from "@/lib/ai/story";
import { FONTS, PALETTES, PALETTE_KEYS, TEMPLATES } from "@/lib/cover";

export const maxDuration = 26;
const out = z.object({ template: z.enum(TEMPLATES), palette: z.enum(PALETTE_KEYS), font: z.enum(FONTS), tagline: z.string().max(160), concept: z.string().max(600) });

/** AI suggests a layout, palette and tagline. It does not make images; the Cover Studio draws the cover itself. */
export const POST = authed<{ id: string }>(async (userId, req, { id }) => {
  const proj = await ownedProject(userId, id);
  if (!proj) return bad("Project not found.", 404);
  if (!aiConfigured()) return bad("AI is not set up yet. You can still design the cover yourself.", 503);
  const p = z.object({ genre: z.string().trim().max(80).optional(), mood: z.string().trim().max(200).optional() }).safeParse(await req.json().catch(() => ({})));
  const mem = await memoryOf(id);
  const about = mem.map((m) => m.summary).join(" ").slice(0, 3000);
  return guard(async () => {
    const r = await generateJson(
      `KIND:cover\nYou advise on a book cover design. Choose from fixed options only. Never invent plot. template one of ${TEMPLATES.join(", ")}; palette one of ${Object.keys(PALETTES).join(", ")}; font one of ${FONTS.join(", ")}.\nReply with ONLY JSON: {"template","palette","font","tagline":string (a short line for the cover, from the story's themes),"concept":string (2 sentences on why this look fits)}`,
      [{ role: "user", content: `Title: ${proj.title}\nGenre: ${p.success ? p.data.genre ?? "" : ""}\nMood: ${p.success ? p.data.mood ?? "" : ""}\nStory so far: ${about || "(not summarised yet)"}` }], out, { temperature: 0.7, maxOutputTokens: 600 });
    return NextResponse.json({ suggestion: r });
  });
});
