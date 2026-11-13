import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

type Db = ReturnType<typeof drizzleNeon<typeof schema>>;
let _db: Db | null = null;

/** Neon over HTTP in production; plain Postgres when DATABASE_URL points at localhost (tests/dev). */
export function db(): Db {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    _db = drizzlePg(new Pool({ connectionString: url }), { schema }) as unknown as Db;
  } else {
    _db = drizzleNeon(neon(url), { schema });
  }
  return _db;
}
export { schema };
