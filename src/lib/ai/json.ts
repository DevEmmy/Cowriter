import type { ZodType } from "zod";
import { AiError, generate, type Msg } from "./provider";

/** Finds the first balanced JSON object in model output (models often wrap it in prose or code fences). */
export function extractJson(text: string): unknown {
  const s = text.replace(/```(?:json)?/gi, "");
  const start = s.indexOf("{");
  if (start < 0) throw new Error("no json");
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return JSON.parse(s.slice(start, i + 1));
  }
  throw new Error("unterminated json");
}

/** Asks for JSON, validates it against a schema, and retries once with the validation problem. */
export async function generateJson<T>(system: string, messages: Msg[], schema: ZodType<T>, opts: { temperature?: number; maxOutputTokens?: number } = {}): Promise<T> {
  let msgs = messages, lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await generate({ system, messages: msgs, temperature: opts.temperature ?? 0.8, maxOutputTokens: opts.maxOutputTokens ?? 4000 });
    try {
      const parsed = schema.safeParse(extractJson(text));
      if (parsed.success) return parsed.data;
      lastErr = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (e) { lastErr = e instanceof Error ? e.message : "invalid json"; }
    msgs = [...messages, { role: "assistant", content: text.slice(0, 3000) }, { role: "user", content: `That was not valid. Problem: ${lastErr}. Reply again with ONLY the corrected JSON object, no other text.` }];
  }
  throw new AiError("The AI answered in an unexpected format. Please try again.", 502);
}
