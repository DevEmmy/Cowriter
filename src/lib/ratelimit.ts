import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** Best-effort client IP behind Netlify or another proxy. Used only to slow abuse, never for identity. */
export function clientIp(req: Request): string {
  const h = req.headers;
  return (h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
}

/** Counts one attempt for `key` and says whether it is still within `limit` per `windowSec`. One atomic statement, shared by every server instance. */
export async function hit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; retryAfter: number }> {
  if (process.env.RATELIMIT_DISABLED === "1") return { ok: true, retryAfter: 0 }; // for automated test suites only; never set in production
  const rows = await db().execute(sql`
    insert into rate_limits as r (key, count, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      count = case when r.window_start < now() - make_interval(secs => ${windowSec}) then 1 else r.count + 1 end,
      window_start = case when r.window_start < now() - make_interval(secs => ${windowSec}) then now() else r.window_start end
    returning count, greatest(1, ceil(extract(epoch from (r.window_start + make_interval(secs => ${windowSec}) - now()))))::int as retry`);
  const row = (rows as unknown as { rows?: Array<{ count: number; retry: number }> }).rows?.[0] ?? (rows as unknown as Array<{ count: number; retry: number }>)[0];
  if (Math.random() < 0.02) void db().execute(sql`delete from rate_limits where window_start < now() - interval '2 days'`).catch(() => {});
  return { ok: row.count <= limit, retryAfter: row.retry };
}
export const clear = (key: string) => db().execute(sql`delete from rate_limits where key = ${key}`);

export const tooMany = (retryAfter: number) =>
  new Response(JSON.stringify({ error: `Too many attempts. Please wait ${retryAfter > 90 ? Math.ceil(retryAfter / 60) + " minutes" : retryAfter + " seconds"} and try again.` }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) } });
