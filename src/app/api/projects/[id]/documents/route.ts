import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";
import { requireUserId } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { ownedProject } from "@/lib/projects";
import { fileKey, putFile } from "@/lib/storage";

// Netlify functions accept request bodies up to ~6 MB.
export const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, { mime: string; magic: number[] }> = {
  pdf: { mime: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46] },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", magic: [0x50, 0x4b, 0x03, 0x04] },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", magic: [0x50, 0x4b, 0x03, 0x04] },
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let userId: string;
  try { userId = await requireUserId(); } catch (r) { return r as Response; }
  const { id } = await ctx.params;
  const project = await ownedProject(userId, id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const type = TYPES[ext];
  if (!type) return NextResponse.json({ error: `"${file.name}": only PDF, DOCX and PPTX files are supported.` }, { status: 415 });
  if (file.size === 0) return NextResponse.json({ error: `"${file.name}" is empty.` }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: `"${file.name}" is larger than 5 MB.` }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!type.magic.every((b, i) => bytes[i] === b)) return NextResponse.json({ error: `"${file.name}" is not a valid ${ext.toUpperCase()} file.` }, { status: 415 });

  const hash = createHash("sha256").update(bytes).digest("hex");
  const [dup] = await db().select({ id: schema.documents.id }).from(schema.documents)
    .where(and(eq(schema.documents.projectId, id), eq(schema.documents.contentHash, hash))).limit(1);
  if (dup) return NextResponse.json({ ok: true, duplicate: true });

  const key = fileKey(userId, id, `${hash.slice(0, 8)}-${file.name}`);
  await putFile(key, bytes, type.mime);
  await db().insert(schema.documents).values({ projectId: id, userId, filename: file.name, mime: type.mime, size: file.size, blobKey: key, contentHash: hash });
  return NextResponse.json({ ok: true });
}
