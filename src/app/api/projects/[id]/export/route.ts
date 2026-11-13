import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { authed, bad, isId } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { ownedProject } from "@/lib/manuscript";
import { toDocx, toPdf, toTxt } from "@/lib/export/build";

export const maxDuration = 26;
const TYPES = { docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pdf: "application/pdf", txt: "text/plain; charset=utf-8" } as const;

/** Downloads the manuscript (or one chapter) as DOCX, PDF or TXT. */
export const GET = authed<{ id: string }>(async (userId, req, { id }) => {
  const proj = await ownedProject(userId, id);
  if (!proj) return bad("Project not found.", 404);
  const q = new URL(req.url).searchParams;
  const format = q.get("format") as keyof typeof TYPES;
  if (!(format in TYPES)) return bad("Choose docx, pdf or txt.");
  let chapters = await db().select({ id: schema.chapters.id, title: schema.chapters.title, content: schema.chapters.content }).from(schema.chapters).where(eq(schema.chapters.projectId, id)).orderBy(asc(schema.chapters.position));
  const only = q.get("chapter");
  if (only) { if (!isId(only)) return bad("Chapter not found.", 404); chapters = chapters.filter((c) => c.id === only); if (!chapters.length) return bad("Chapter not found.", 404); }
  if (!chapters.some((c) => c.content.trim())) return bad("There is nothing to export yet. Write something first.");
  const [u] = await db().select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const input = { title: proj.title, author: u?.name ?? "", chapters };
  const data = format === "txt" ? toTxt(input) : format === "docx" ? await toDocx(input) : await toPdf(input);
  const safe = proj.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "manuscript";
  return new NextResponse(data as BodyInit, { headers: { "Content-Type": TYPES[format], "Content-Disposition": `attachment; filename="${safe}.${format}"; filename*=UTF-8''${encodeURIComponent(proj.title)}.${format}`, "Cache-Control": "no-store" } });
});
