import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { POST as signup } from "../src/app/api/auth/signup/route";
import { POST as login } from "../src/app/api/auth/login/route";

async function main() {
  // Keep these tests independent of real services and never create an account.
  const originalSecret = process.env.AUTH_SECRET;
  const originalDatabase = process.env.NETLIFY_DB_URL;
  delete process.env.AUTH_SECRET;
  delete process.env.NETLIFY_DB_URL;
  const request = (body: unknown) => new Request("http://localhost/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  try {
    for (const handler of [signup, login]) {
      assert.equal((await handler(request({ email: "invalid", password: "" }))).status, 400);
      const malformed = new Request("http://localhost/api/auth", { method: "POST", body: "{" });
      assert.equal((await handler(malformed)).status, 400);
      const response = await handler(request({ email: "auth-test@example.invalid", password: "test-password-only" }));
      assert.equal(response.status, 503);
      assert.match((await response.json()).error, /temporarily unavailable/);
    }
    process.env.AUTH_SECRET = randomBytes(48).toString("base64");
    for (const handler of [signup, login]) {
      const response = await handler(request({ email: "auth-test@example.invalid", password: "test-password-only" }));
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        error: "Account services are temporarily unavailable. Please try again shortly.",
      });
    }
    console.log("Auth regression checks passed: validation, malformed JSON, missing session configuration, unavailable database.");
  } finally {
    if (originalSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalSecret;
    if (originalDatabase === undefined) delete process.env.NETLIFY_DB_URL;
    else process.env.NETLIFY_DB_URL = originalDatabase;
  }
}

main().catch(() => {
  console.error("Auth regression checks failed.");
  process.exitCode = 1;
});
