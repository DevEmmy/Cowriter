import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const TTL = { reset: 60 * 60_000, verify: 24 * 60 * 60_000 } as const;
export type Kind = keyof typeof TTL;

/** Makes a fresh one-time token, voiding any earlier unused ones of the same kind for that user. */
export async function issueToken(userId: string, kind: Kind): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db().update(schema.authTokens).set({ usedAt: new Date() }).where(and(eq(schema.authTokens.userId, userId), eq(schema.authTokens.kind, kind), isNull(schema.authTokens.usedAt)));
  await db().insert(schema.authTokens).values({ userId, kind, tokenHash: hash(token), expiresAt: new Date(Date.now() + TTL[kind]) });
  return token;
}

/** Atomically spends a token. Returns the user id, or null if it is unknown, expired or already used. */
export async function spendToken(token: string, kind: Kind): Promise<string | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const [row] = await db().update(schema.authTokens).set({ usedAt: new Date() })
    .where(and(eq(schema.authTokens.tokenHash, hash(token)), eq(schema.authTokens.kind, kind), isNull(schema.authTokens.usedAt), gt(schema.authTokens.expiresAt, new Date())))
    .returning({ userId: schema.authTokens.userId });
  return row?.userId ?? null;
}
/** Checks a token without spending it, so the reset page can say early that a link is dead. */
export async function peekToken(token: string, kind: Kind): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  const [row] = await db().select({ id: schema.authTokens.id }).from(schema.authTokens).where(and(eq(schema.authTokens.tokenHash, hash(token)), eq(schema.authTokens.kind, kind), isNull(schema.authTokens.usedAt), gt(schema.authTokens.expiresAt, new Date())));
  return !!row;
}
