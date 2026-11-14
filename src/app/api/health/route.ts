import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
/** Reports only whether the database answers. Also called daily by Vercel Cron so a free Supabase project is never idle long enough to pause. */
export async function GET() {
  try { await db().execute(sql`select 1`); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ ok: false }, { status: 503 }); }
}
