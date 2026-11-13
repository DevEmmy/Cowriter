import { GoogleGenAI } from "@google/genai";

export const geminiConfigured = () => !!process.env.GEMINI_API_KEY;
export const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let client: GoogleGenAI | null = null;
export function gemini() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  return (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));
}

/** Transcribes one page of a (scanned) PDF. Returns raw text; never summarises. */
export async function ocrPdfPage(pdf: Uint8Array, page: number): Promise<string> {
  const res = await gemini().models.generateContent({
    model: MODEL,
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType: "application/pdf", data: Buffer.from(pdf).toString("base64") } },
        { text: `Transcribe ALL text on page ${page} of this PDF exactly as written. Keep headings on their own lines, lists as lines starting with "- ", and table rows as cells separated by " | ". Separate paragraphs with a blank line. Do not summarise, correct, translate or add anything. Write [illegible] where text cannot be read. If the page has no text, output nothing. Output only the transcription.` },
      ],
    }],
    config: { temperature: 0 },
  });
  return (res.text ?? "").trim();
}
