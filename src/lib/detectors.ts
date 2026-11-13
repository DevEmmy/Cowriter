import { z } from "zod";
import { AiError } from "@/lib/ai/provider";

/**
 * External AI-text detectors. Co Writer never estimates detector scores itself: a number is shown ONLY when
 * the provider returned it. If a provider is not configured, it reports that and nothing else.
 * Both adapters are written from the vendors' public API documentation; set the key to enable them.
 */
export interface DetectorResult { provider: string; aiProbability: number; humanProbability: number | null; verdict: string | null; checkedAt: string }
interface Detector { id: string; name: string; envKey: string; signup: string; run: (text: string, key: string) => Promise<Omit<DetectorResult, "provider" | "checkedAt">> }

const num = z.number().min(0).max(1);
const gptzero = z.object({ documents: z.array(z.object({ completely_generated_prob: num.optional(), predicted_class: z.string().optional(), class_probabilities: z.object({ ai: num.optional(), human: num.optional() }).partial().optional() }).passthrough()).min(1) }).passthrough();
const originality = z.object({ score: z.object({ ai: num, original: num.optional() }).passthrough() }).passthrough();

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  let r: Response;
  try { r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) }); }
  catch { throw new AiError("The detector service could not be reached. Please try again.", 502); }
  if (r.status === 401 || r.status === 403) throw new AiError("The detector rejected the API key. Check it in your environment settings.", 502);
  if (r.status === 402 || r.status === 429) throw new AiError("The detector says you are out of credits or sending too fast.", 429);
  if (!r.ok) throw new AiError(`The detector returned an error (${r.status}).`, 502);
  return r.json().catch(() => { throw new AiError("The detector returned an unreadable response.", 502); });
}

export const DETECTORS: Detector[] = [
  { id: "gptzero", name: "GPTZero", envKey: "GPTZERO_API_KEY", signup: "https://gptzero.me/api", run: async (text, key) => {
    const raw = await post(`${process.env.GPTZERO_BASE_URL ?? "https://api.gptzero.me"}/v2/predict/text`, { "x-api-key": key }, { document: text, multilingual: false });
    const p = gptzero.safeParse(raw); if (!p.success) throw new AiError("GPTZero answered in a format Co Writer does not recognise, so no result is shown.", 502);
    const doc = p.data.documents[0], ai = doc.class_probabilities?.ai ?? doc.completely_generated_prob;
    if (ai === undefined) throw new AiError("GPTZero did not return a score, so no result is shown.", 502);
    return { aiProbability: ai, humanProbability: doc.class_probabilities?.human ?? null, verdict: doc.predicted_class ?? null };
  } },
  { id: "originality", name: "Originality.ai", envKey: "ORIGINALITY_API_KEY", signup: "https://originality.ai/api", run: async (text, key) => {
    const raw = await post(`${process.env.ORIGINALITY_BASE_URL ?? "https://api.originality.ai"}/api/v1/scan/ai`, { "X-OAI-API-KEY": key }, { content: text, aiModelVersion: "1" });
    const p = originality.safeParse(raw); if (!p.success) throw new AiError("Originality.ai answered in a format Co Writer does not recognise, so no result is shown.", 502);
    return { aiProbability: p.data.score.ai, humanProbability: p.data.score.original ?? null, verdict: null };
  } },
];

export const detectorStatus = () => DETECTORS.map((d) => ({ id: d.id, name: d.name, envKey: d.envKey, signup: d.signup, configured: !!process.env[d.envKey]?.trim() }));

export async function runDetector(id: string, text: string): Promise<DetectorResult> {
  const d = DETECTORS.find((x) => x.id === id);
  if (!d) throw new AiError("Unknown detector.", 400);
  const key = process.env[d.envKey]?.trim();
  if (!key) throw new AiError(`${d.name} is not connected. Add ${d.envKey} in your environment settings.`, 503);
  return { provider: d.name, ...(await d.run(text, key)), checkedAt: new Date().toISOString() };
}
