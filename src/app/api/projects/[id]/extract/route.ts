import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";
import { extractStep } from "@/lib/extract/run";

export const maxDuration = 26;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  let userId: string;
  try { userId = await requireUserId(); } catch (r) { return r as Response; }
  const { id } = await ctx.params;
  if (!(await ownedProject(userId, id))) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  try {
    return NextResponse.json(await extractStep(userId, id));
  } catch (e) {
    return NextResponse.json({ done: false, error: e instanceof Error ? e.message : "Extraction failed." }, { status: 500 });
  }
}
