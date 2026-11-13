import assert from "node:assert/strict";
import http from "node:http";

let mode = "ok"; let seen: { url?: string; key?: string; body?: any } = {};
const server = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c));
  req.on("end", () => {
    seen = { url: req.url, key: req.headers["x-goog-api-key"] as string, body: b ? JSON.parse(b) : null };
    if (mode === "429") { res.statusCode = 429; return res.end("{}"); }
    if (mode === "403") { res.statusCode = 403; return res.end("{}"); }
    if (mode === "empty") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ candidates: [{ content: { parts: [] } }] })); }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Hello " }, { text: "writer." }] } }] }));
  });
});
server.listen(4010, async () => {
  process.env.GEMINI_API_KEY = "test-key"; process.env.GEMINI_BASE_URL = "http://localhost:4010/v1beta"; process.env.GEMINI_MODEL = "test-model"; delete process.env.AI_PROVIDER;
  const { generate, AiError, aiProviderName } = await import("../src/lib/ai/provider");
  assert.equal(aiProviderName(), "gemini");
  const out = await generate({ system: "SYS", messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "yo" }, { role: "user", content: "again" }], temperature: 0.5, maxOutputTokens: 123 });
  assert.equal(out, "Hello writer.", "joins response parts");
  assert.equal(seen.url, "/v1beta/models/test-model:generateContent");
  assert.equal(seen.key, "test-key", "key sent in header, not URL");
  assert.ok(!seen.url!.includes("test-key"), "key never appears in the URL");
  assert.equal(seen.body.systemInstruction.parts[0].text, "SYS");
  assert.deepEqual(seen.body.contents.map((c: any) => c.role), ["user", "model", "user"], "assistant role mapped to model");
  assert.equal(seen.body.generationConfig.maxOutputTokens, 123);
  mode = "403"; await assert.rejects(generate({ system: "s", messages: [{ role: "user", content: "x" }] }), (e: any) => e instanceof AiError && /API key/.test(e.message));
  mode = "empty"; await assert.rejects(generate({ system: "s", messages: [{ role: "user", content: "x" }] }), (e: any) => e instanceof AiError && /no text/.test(e.message));
  mode = "429"; await assert.rejects(generate({ system: "s", messages: [{ role: "user", content: "x" }] }), (e: any) => e instanceof AiError && e.status === 429 && /quota/.test(e.message));
  delete process.env.GEMINI_API_KEY; delete process.env.GROQ_API_KEY;
  await assert.rejects(generate({ system: "s", messages: [{ role: "user", content: "x" }] }), (e: any) => e instanceof AiError && e.status === 503 && /GEMINI_API_KEY/.test(e.message));
  console.log("provider tests passed"); server.close(); process.exit(0);
});
