import { drizzle } from "drizzle-orm/netlify-db";
import type { PgAsyncDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "../../db/schema";

const createDb = (): PgAsyncDatabase<PgQueryResultHKT, typeof schema> => drizzle({ schema });
let client: ReturnType<typeof createDb> | undefined;

/** Netlify supplies the connection and isolates preview data automatically. */
export function db() {
  return (client ??= createDb());
}

export { schema };
