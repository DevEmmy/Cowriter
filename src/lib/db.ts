import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

type Db = ReturnType<typeof drizzleNeon<typeof schema>>;
let _db: Db | null = null;

/**
 * Works with any Postgres: Neon (HTTP driver) or anything else (Supabase, Aiven, Railway, local...)
 * through a small pooled connection suited to serverless functions.
 * Remote connections always use TLS with certificate verification. If your provider signs with its
 * own certificate authority, set DATABASE_CA to that CA certificate (PEM text).
 */
export function db(): Db {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const host = new URL(url).hostname;
  if (host.endsWith("neon.tech")) {
    _db = drizzleNeon(neon(url), { schema });
  } else {
    const local = host === "localhost" || host === "127.0.0.1";
    const ca = process.env.DATABASE_CA?.replace(/\\n/g, "\n");
    const pool = new Pool({ connectionString: url, max: 1, ssl: local ? undefined : ca ? { ca } : true });
    _db = drizzlePg(pool, { schema }) as unknown as Db;
  }
  return _db;
}
export { schema };
