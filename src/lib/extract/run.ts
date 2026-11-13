import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getFile } from "@/lib/storage";
import { extractPdfPages, pdfPageCount } from "./pdf";
import { extractDocx } from "./docx";
import { extractPptx } from "./pptx";
import { UnitBuilder } from "./structure";
import { geminiConfigured, ocrPdfPage } from "@/lib/ai/gemini";
import type { ExtractedDoc } from "@/lib/types";

const PAGES_PER_STEP = 6;

export interface StepResult {
  done: boolean;
  file?: string;
  phase?: "reading" | "ocr";
  current?: number;
  total?: number;
  error?: string;
}

/** Runs ONE small unit of extraction work and persists it, so any request can be retried or resumed. */
export async function extractStep(userId: string, projectId: string): Promise<StepResult> {
  const docs = await db().select().from(schema.documents)
    .where(and(eq(schema.documents.projectId, projectId), eq(schema.documents.userId, userId)))
    .orderBy(schema.documents.createdAt);
  const doc = docs.find((d) => !(d.extracted as ExtractedDoc | null)?.done);
  if (!doc) {
    await db().update(schema.projects).set({ status: "extracted", updatedAt: new Date() })
      .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)));
    return { done: true };
  }
  const bytes = await getFile(doc.blobKey);
  if (!bytes) return { done: false, file: doc.filename, error: "Stored file could not be found." };
  const buf = Buffer.from(bytes);
  const ext = doc.filename.split(".").pop()!.toLowerCase();
  let st = doc.extracted as ExtractedDoc | null;
  let result: StepResult;

  if (ext === "pdf") {
    const u8 = new Uint8Array(buf);
    st ??= { done: false, format: "pdf", pageCount: await pdfPageCount(u8), pagesDone: 0, ocrPages: [], ocrDone: [], units: [], warnings: [] };
    if (st.pagesDone < st.pageCount) {
      const from = st.pagesDone + 1;
      st = await extractPdfPages(u8, doc.id.slice(0, 8), st, from, from + PAGES_PER_STEP - 1);
      result = { done: false, file: doc.filename, phase: "reading", current: st.pagesDone, total: st.pageCount };
    } else {
      const cur: ExtractedDoc = st;
      const page = cur.ocrPages.find((p) => !cur.ocrDone.includes(p))!;
      const b = new UnitBuilder(doc.id.slice(0, 8), st.units[st.units.length - 1]?.section ?? [], st.units.length);
      if (!geminiConfigured()) {
        b.flag(`[Page ${page} looks scanned and could not be read: OCR is not configured]`, page, "Scanned page not read");
        st.warnings.push(`Page ${page} is scanned and was not read.`);
      } else {
        try {
          const text = await ocrPdfPage(u8, page);
          const blocks = text.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);
          if (!blocks.length) b.flag(`[Page ${page} appears to contain no text]`, page, "Blank or image-only page");
          for (const t of blocks) b.text(t, page, { uncertain: true, note: "Read by OCR: please verify against the original" });
        } catch (e) {
          b.flag(`[Page ${page} could not be read by OCR]`, page, "OCR failed");
          st.warnings.push(`OCR failed on page ${page}: ${e instanceof Error ? e.message : "unknown error"}`);
        }
      }
      st = { ...st, units: [...st.units, ...b.units], ocrDone: [...st.ocrDone, page] };
      result = { done: false, file: doc.filename, phase: "ocr", current: st.ocrDone.length, total: st.ocrPages.length };
    }
    const fin: ExtractedDoc = st;
    st.done = fin.pagesDone >= fin.pageCount && fin.ocrPages.every((p) => fin.ocrDone.includes(p));
  } else if (ext === "docx") {
    st = await extractDocx(buf, doc.id.slice(0, 8));
    result = { done: false, file: doc.filename, phase: "reading", current: 1, total: 1 };
  } else if (ext === "pptx") {
    st = await extractPptx(buf, doc.id.slice(0, 8));
    result = { done: false, file: doc.filename, phase: "reading", current: 1, total: 1 };
  } else {
    return { done: false, file: doc.filename, error: "Unsupported file type." };
  }

  await db().update(schema.documents)
    .set({ extracted: st, pageCount: st.pageCount || null })
    .where(eq(schema.documents.id, doc.id));
  return result;
}
