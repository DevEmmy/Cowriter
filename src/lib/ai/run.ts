import { NextResponse } from "next/server";
import { AiError } from "./provider";

/** Turns AI failures into clean JSON errors the UI can show. */
export async function guard(fn: () => Promise<Response>): Promise<Response> {
  try { return await fn(); }
  catch (e) {
    if (e instanceof AiError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
