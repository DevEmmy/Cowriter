import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { authed, bad, isId } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { ownedProject } from "@/lib/manuscript";

const scopeOk = async (userId: string, scope: string) => scope === "global" || (isId(scope) && !!(await ownedProject(userId, scope)));

export const GET = authed(async (userId, req) => {
  const scope = new URL(req.url).searchParams.get("scope") ?? "global";
  if (!(await scopeOk(userId, scope))) return bad("Project not found.", 404);
  const [r] = await db().select().from(schema.writingProfiles).where(and(eq(schema.writingProfiles.userId, userId), eq(schema.writingProfiles.scope, scope))).limit(1);
  return NextResponse.json(r ?? { scope, samples: "", instructions: "", analysis: null });
});

export const PUT = authed(async (userId, req) => {
  const p = z.object({ scope: z.string(), samples: z.string().max(80000), instructions: z.string().max(4000) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Samples can be up to about 12,000 words and instructions up to 4,000 characters.");
  if (!(await scopeOk(userId, p.data.scope))) return bad("Project not found.", 404);
  await db().insert(schema.writingProfiles).values({ userId, ...p.data })
    .onConflictDoUpdate({ target: [schema.writingProfiles.userId, schema.writingProfiles.scope], set: { samples: p.data.samples, instructions: p.data.instructions, updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
});
