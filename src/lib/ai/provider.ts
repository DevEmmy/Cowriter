// Provider-agnostic text generation. Swap providers with AI_PROVIDER (gemini | groq | mock)
// without touching any feature code.
export interface Msg { role: "user" | "assistant"; content: string }
export interface GenInput { system: string; messages: Msg[]; temperature?: number; maxOutputTokens?: number }

export class AiError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

const provider = () => (process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : process.env.GROQ_API_KEY ? "groq" : "none")).toLowerCase();
export const aiConfigured = () => provider() !== "none";
export const aiProviderName = () => provider();

async function withRetry<T>(fn: () => Promise<Response>, parse: (j: unknown) => T): Promise<T> {
  let last = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fn();
    if (res.ok) return parse(await res.json());
    last = res.status;
    if (res.status !== 429 && res.status !== 503) break;
    await new Promise((r) => setTimeout(r, 2500));
  }
  if (last === 429) throw new AiError("The free AI quota is used up for the moment. Wait a minute and try again.", 429);
  if (last === 400 || last === 403) throw new AiError("The AI service rejected the request. Check that your API key is valid and allowed to use this model.", 502);
  throw new AiError(`The AI service is unavailable right now (status ${last}). Please try again.`, 502);
}

async function gemini(i: GenInput): Promise<string> {
  const base = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  return withRetry(
    () => fetch(`${base}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: i.system }] },
        contents: i.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { temperature: i.temperature ?? 0.8, maxOutputTokens: i.maxOutputTokens ?? 4096 },
      }),
    }),
    (j) => {
      const parts = (j as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts;
      const text = parts?.map((p) => p.text ?? "").join("").trim();
      if (!text) throw new AiError("The AI returned no text. Try rephrasing your request.");
      return text;
    },
  );
}

async function groq(i: GenInput): Promise<string> {
  return withRetry(
    () => fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: i.temperature ?? 0.8,
        max_tokens: Math.min(i.maxOutputTokens ?? 4096, 8000),
        messages: [{ role: "system", content: i.system }, ...i.messages],
      }),
    }),
    (j) => {
      const text = (j as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content?.trim();
      if (!text) throw new AiError("The AI returned no text. Try rephrasing your request.");
      return text;
    },
  );
}

/** Deterministic stand-in used only by tests (AI_PROVIDER=mock). Never selected automatically. */
function mock(i: GenInput): string {
  const kind = i.system.match(/KIND:(\w+)/)?.[1];
  if (kind === "idea") return "Here you go:\n```json\n" + JSON.stringify({ refined: "A refined version of the idea.", directions: [{ title: "Direction A", summary: "A." }, { title: "Direction B", summary: "B." }, { title: "Direction C", summary: "C." }], weaknesses: ["The stakes are vague."], opportunities: ["Deepen the rivalry."], questions: ["Who is the narrator?"] }) + "\n```";
  if (kind === "characters") return JSON.stringify({ characters: [{ name: "Mock Name", role: "Lead", motivation: "Wants to belong.", conflict: "Fears being found out.", relationships: "Estranged sister.", arc: "Learns to trust." }] });
  if (kind === "plot") return JSON.stringify({ conflicts: ["Duty versus desire."], subplots: [{ title: "The letter", summary: "A hidden letter surfaces." }], arc: ["Setup", "Turn", "Resolution"], twists: [{ title: "The witness", summary: "Someone saw everything." }], themes: ["Loyalty"] });
  if (kind === "chapters") return JSON.stringify({ chapters: [{ title: "Chapter 1", summary: "The meeting." }, { title: "Chapter 2", summary: "The secret." }] });
  if (kind === "memory") return JSON.stringify({ summary: "Mock summary of the chapter.", facts: ["Mock fact one."] });
  if (kind === "biblesuggest") return JSON.stringify({ suggestions: [{ kind: "character", name: "Mock Character", body: "Appears in chapter one." }, { kind: "location", name: "Mock Harbour", body: "Where the story opens." }] });
  if (kind === "guard") {
    const t = i.messages.at(-1)?.content.split("CHAPTER TEXT:\n")[1] ?? "";
    return JSON.stringify({ issues: [{ severity: "high", category: "character", quote: t.slice(0, 40), problem: "Mock continuity problem.", reference: "Story Bible" }, { severity: "low", category: "fact", quote: "This sentence is not in the chapter at all.", problem: "Invented.", reference: "nowhere" }] });
  }
  if (kind === "analyse") { const t = i.messages.at(-1)?.content.split(":\n")[1] ?? ""; return JSON.stringify({ summary: "A mock editor summary.", tone: "Wistful", pacing: "Steady", strengths: [{ point: "Strong opening image.", evidence: t.slice(0, 30) }], improvements: [{ point: "Vary sentence openings.", evidence: "A phrase that is not in the chapter." }] }); }
  if (kind === "cover") return JSON.stringify({ template: "frame", palette: "midnight", font: "serif", tagline: "Some secrets keep the tide in.", concept: "A mock concept." });
  if (kind === "promptfields") return JSON.stringify({ context: "Inferred context.", objective: "Inferred objective.", tone: "Tender", pacing: "Slow" });
  const last = i.messages[i.messages.length - 1]?.content ?? "";
  const m = last.match(/ABOUT (\d+) WORDS/);
  if (m) return Array.from({ length: Math.ceil(Number(m[1]) / 5) }, (_, k) => `Mock sentence ${k + 1} here.`).join(" ");
  return `[mock reply] ${last.slice(0, 120)}`;
}

export async function generate(i: GenInput): Promise<string> {
  switch (provider()) {
    case "gemini": return gemini(i);
    case "groq": return groq(i);
    case "mock": return mock(i);
    default: throw new AiError("AI is not set up yet. Add a free GEMINI_API_KEY in your site settings to turn on the writing assistant.", 503);
  }
}
