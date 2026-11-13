import { caStatus } from "@/lib/db";

/** Turns a server-side failure into a short, safe setup hint (no secrets, no connection details). */
export function setupHint(e: unknown): string | null {
  const chain: Array<{ message?: string; code?: string }> = [];
  for (let x: unknown = e, i = 0; x && typeof x === "object" && i < 5; i++, x = (x as { cause?: unknown }).cause) chain.push(x as { message?: string; code?: string });
  const text = chain.map((c) => `${c.code ?? ""} ${c.message ?? ""}`).join(" | ");
  if (/DATABASE_URL is not set/i.test(text)) return "Setup problem: DATABASE_URL is not set in Netlify, or the site was not redeployed after adding it.";
  if (/AUTH_SECRET/i.test(text)) return "Setup problem: AUTH_SECRET is missing or shorter than 32 characters in Netlify.";
  if (/Invalid URL|ERR_INVALID_URL/i.test(text)) return "Setup problem: DATABASE_URL is not a valid connection string. Check for spaces, brackets, or special characters in the password.";
  if (/self.signed|unable to verify|certificate|UNABLE_TO_GET_ISSUER|DEPTH_ZERO/i.test(text)) { const code = chain.map((c) => c.code).find((c) => c && /^[A-Z_]+$/.test(c)) ?? "none"; return `Setup problem: the database certificate is not trusted (error code: ${code}; ${caStatus()}). Add the certificate text from Supabase (Database settings, SSL Configuration) as DATABASE_CA in Netlify, then redeploy.`; }
  if (/28P01|password authentication failed|authentication failed|Tenant or user not found/i.test(text)) return "Setup problem: the database rejected the username or password in DATABASE_URL.";
  if (/database ".*" does not exist|3D000/i.test(text)) return "Setup problem: the database name in DATABASE_URL does not exist. For Supabase it should end with /postgres.";
  if (/42P01|relation .* does not exist/i.test(text)) return "Setup problem: the database tables do not exist yet. Run supabase-setup.sql in the Supabase SQL Editor.";
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|timeout|Connection terminated|ECONNRESET/i.test(text)) return "Setup problem: the site could not reach the database. Check the host and port in DATABASE_URL (use the Transaction pooler, port 6543).";
  return null;
}
