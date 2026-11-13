import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { authed, bad, isId } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { MAX_CHAPTERS, MAX_FILE_BYTES, parseFile, splitChapters, textToPieces } from "@/lib/import";
import { PROJECT_TYPES } from "../route";

export const maxDuration = 26;

/** Import a manuscript from an uploaded file or pasted text. dryRun=1 only previews the chapter split; nothing is saved. */
export const POST = authed(async (userId, req) => {
  const form = await req.formData().catch(() => null);
  if (!form) return bad("Could not read the upload.");
  const file = form.get("file"); const pasted = String(form.get("text") ?? "");
  const mode = form.get("split") === "single" ? "single" : "auto";
  const dry = form.get("dryRun") === "1";
  const into = String(form.get("projectId") ?? "");
  let fileName = "";
  let pieces;
  try {
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) return bad("That file is over 4 MB. Split it into parts, or paste the text instead.");
      fileName = file.name;
      pieces = await parseFile(Buffer.from(await file.arrayBuffer()), file.name);
    } else if (pasted.trim()) {
      if (pasted.length > 3_000_000) return bad("That text is too long to paste. Upload it as a file in parts.");
      pieces = textToPieces(pasted);
    } else return bad("Choose a file or paste your text.");
  } catch (e) {
    return bad(e instanceof Error && /Unsupported|no selectable/.test(e.message) ? e.message : "Could not read that file. Try saving it as .docx or .txt and upload again.");
  }
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  const title = String(form.get("title") ?? "").trim().slice(0, 150) || base || "Imported manuscript";
  const chapters = splitChapters(pieces, mode, into ? "Imported text" : "Chapter 1");
  const total = chapters.reduce((n, c) => n + c.words, 0);
  if (!total) return bad("No text was found in that file.");
  if (chapters.length > MAX_CHAPTERS) return bad(`That would make ${chapters.length} chapters (the limit is ${MAX_CHAPTERS}). Choose "keep as one chapter" or split the file.`);
  const summary = chapters.map((c) => ({ title: c.title, words: c.words }));
  if (dry) return NextResponse.json({ title, chapters: summary, words: total });

  let projectId = into;
  let start = 0;
  if (into) {
    if (!isId(into)) return bad("Project not found.", 404);
    const [p] = await db().select({ id: schema.projects.id }).from(schema.projects).where(and(eq(schema.projects.id, into), eq(schema.projects.userId, userId)));
    if (!p) return bad("Project not found.", 404);
    const [m] = await db().select({ n: sql<number>`coalesce(max(${schema.chapters.position}), -1)::int` }).from(schema.chapters).where(eq(schema.chapters.projectId, into));
    start = m.n + 1;
  } else {
    const type = String(form.get("type") ?? "novel");
    if (!(PROJECT_TYPES as readonly string[]).includes(type)) return bad("Choose a project type.");
    const [proj] = await db().insert(schema.projects).values({ userId, title, type }).returning({ id: schema.projects.id });
    projectId = proj.id;
  }
  const rows = await db().insert(schema.chapters).values(chapters.map((c, i) => ({ projectId, userId, title: c.title, content: c.content, wordCount: c.words, position: start + i }))).returning({ id: schema.chapters.id, position: schema.chapters.position });
  await db().update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, projectId));
  rows.sort((a, b) => a.position - b.position);
  return NextResponse.json({ id: projectId, chapterId: rows[0].id, chapters: summary, words: total });
});
