import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { setupHint } from "@/lib/diagnose";
import { requestUser } from "@/lib/requestUser";

type Ctx<P> = { params: Promise<P> };
/** Wraps a route handler: authenticates, converts thrown Responses and errors into JSON. */
export function authed<P = Record<string, never>>(fn: (userId: string, req: Request, params: P) => Promise<Response>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const userId = await requireUserId();
      return await requestUser.run({ userId }, async () => fn(userId, req, await ctx.params));
    } catch (e) {
      if (e instanceof Response) return e;
      console.error(e);
      return NextResponse.json({ error: setupHint(e) ?? "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}
export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isId = (s: string) => UUID.test(s);
