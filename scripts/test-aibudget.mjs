// Per-user AI allowance. Needs a server on :3114 started with AI_PROVIDER=mock AI_DAILY_LIMIT=5 AI_PER_MINUTE_LIMIT=4 (limiter NOT disabled).
const B = "http://localhost:3114"; let pass = 0, fail = 0; const t = (n, ok, x = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${n}${ok || !x ? "" : " (" + x + ")"}`); };
const su = async () => (await fetch(`${B}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "9." + Math.floor(Math.random() * 250) + ".1.1" }, body: JSON.stringify({ email: `b${Date.now()}${Math.random().toString(36).slice(2, 6)}@t.io`, password: "password123" }) })).headers.get("set-cookie").split(";")[0];
const a = await su(), b = await su();
const ask = (c) => fetch(`${B}/api/prompts/generate`, { method: "POST", headers: { cookie: c, "Content-Type": "application/json" }, body: JSON.stringify({ fields: {}, fill: "A tender story set in a seaside town about two old friends." }) });
const codes = []; for (let i = 0; i < 6; i++) codes.push((await ask(a)).status);
console.log(codes.join(","));
t("first 4 allowed, 5th blocked by per-minute cap", codes.slice(0, 4).every((c) => c === 200) && codes[4] === 429, codes.join(","));
const r = await ask(a); const d = await r.json(); t("message is plain and says how long", r.status === 429 && /wait \d+ seconds/.test(d.error), JSON.stringify(d));
t("another user is unaffected", (await ask(b)).status === 200);
console.log(`---- ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
