// Password reset, email confirmation and rate limiting. Needs: scripts/fake-email.mjs on :3198, a server on :3113 with email env, one on :3111 without.
const B = process.env.BASE ?? "http://localhost:3113", NO = "http://localhost:3111";
let pass = 0, fail = 0; const t = (n, ok, x = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${n}${ok || !x ? "" : " (" + x + ")"}`); };
const j = (u, b, h = {}, m = "POST") => fetch(u, { method: m, headers: { "Content-Type": "application/json", ...h }, body: b === undefined ? undefined : JSON.stringify(b) });
const mails = async (to) => (await fetch(`http://localhost:3198/sent?to=${encodeURIComponent(to)}`)).json();
const tokenFrom = (m, path) => m.text.match(new RegExp(`${path}\\?token=([0-9a-f]{64})`))?.[1];
const uniq = () => `auth${Date.now()}${Math.random().toString(36).slice(2, 6)}@t.io`;
const fwd = (ip) => ({ "x-forwarded-for": ip });

const email = uniq();
let r = await j(`${B}/api/auth/signup`, { email, password: "password123", name: "A" }, fwd("10.0.0.1"));
t("signup ok", r.status === 200); const cookie = r.headers.get("set-cookie").split(";")[0];
let ms = await mails(email);
t("signup sent one confirmation email via provider", ms.length === 1 && /Confirm/.test(ms[0].subject) && ms[0].auth === "Bearer test-key" && ms[0].from.includes("hello@"), JSON.stringify(ms).slice(0, 200));
const vt = tokenFrom(ms[0], "verify");
t("email links point at SITE_URL", ms[0].text.includes("http://localhost:3113/verify?token="));
r = await j(`${B}/api/auth/verify`, { token: "0".repeat(64) }); t("bad confirm token rejected", r.status === 400);
r = await j(`${B}/api/auth/verify`, { token: vt }); t("confirm token works", r.status === 200);
r = await j(`${B}/api/auth/verify`, { token: vt }); t("confirm token single-use", r.status === 400);
r = await j(`${B}/api/auth/verify`, undefined, { cookie }, "PUT"); t("resend after verified says already", (await r.json()).already === true);
const e2 = uniq(); r = await j(`${B}/api/auth/signup`, { email: e2, password: "password123" }, fwd("10.0.0.2")); const c2 = r.headers.get("set-cookie").split(";")[0];
r = await j(`${B}/api/auth/verify`, undefined, { cookie: c2 }, "PUT"); t("unverified user can request new link", r.status === 200 && (await mails(e2)).length === 2);
const page = await (await fetch(`${B}/dashboard`, { headers: { cookie: c2 } })).text(); t("banner shown to unverified user", page.includes("Please confirm your email"));
const page2 = await (await fetch(`${B}/dashboard`, { headers: { cookie } })).text(); t("banner hidden after verifying", !page2.includes("Please confirm your email"));

// forgot / reset
r = await j(`${B}/api/auth/forgot`, { email }, fwd("10.0.0.3")); const a = await r.json();
const rm = (await mails(email)).filter((m) => /Reset/.test(m.subject));
t("forgot sends reset email", r.status === 200 && rm.length === 1);
r = await j(`${B}/api/auth/forgot`, { email: "nobody" + uniq() }, fwd("10.0.0.3")); const b = await r.json();
t("unknown email gets identical answer (no account enumeration)", r.status === 200 && b.message === a.message);
t("no mail sent for unknown address", (await mails("nobody")).length === 0);
const rt = tokenFrom(rm[0], "reset");
t("reset page says link valid", (await (await fetch(`${B}/api/auth/reset?token=${rt}`)).json()).valid === true);
r = await j(`${B}/api/auth/reset`, { token: rt, password: "short" }); t("short password rejected", r.status === 400);
t("short password did not spend token", (await (await fetch(`${B}/api/auth/reset?token=${rt}`)).json()).valid === true);
r = await j(`${B}/api/auth/reset`, { token: rt, password: "brandnewpass1" }, fwd("10.0.0.4")); t("reset works and signs in", r.status === 200 && !!r.headers.get("set-cookie"));
r = await j(`${B}/api/auth/reset`, { token: rt, password: "another12345" }); t("reset link single-use", r.status === 400);
r = await j(`${B}/api/auth/login`, { email, password: "password123" }, fwd("10.0.0.5")); t("old password no longer works", r.status === 401);
r = await j(`${B}/api/auth/login`, { email, password: "brandnewpass1" }, fwd("10.0.0.5")); t("new password logs in", r.status === 200);
r = await j(`${B}/api/auth/reset`, { token: "zzz", password: "brandnewpass1" }); t("garbage token rejected", r.status === 400);
// newer link voids the older one
await j(`${B}/api/auth/forgot`, { email }, fwd("10.0.0.6")); await j(`${B}/api/auth/forgot`, { email }, fwd("10.0.0.7"));
const all = (await mails(email)).filter((m) => /Reset/.test(m.subject)); const t1 = tokenFrom(all[1], "reset"), t2 = tokenFrom(all[2], "reset");
t("older reset link voided by newer one", (await (await fetch(`${B}/api/auth/reset?token=${t1}`)).json()).valid === false && (await (await fetch(`${B}/api/auth/reset?token=${t2}`)).json()).valid === true);
await j(`${B}/api/auth/forgot`, { email }, fwd("10.0.0.8"));
t("per-address mail cap (3/hour) quietly holds", (await mails(email)).filter((m) => /Reset/.test(m.subject)).length === 3);

// rate limits
const e3 = uniq(); await j(`${B}/api/auth/signup`, { email: e3, password: "password123" }, fwd("10.1.0.1"));
let codes = []; for (let i = 0; i < 10; i++) codes.push((await j(`${B}/api/auth/login`, { email: e3, password: "wrongwrong" }, fwd("10.1.0.2"))).status);
t("login blocks after 8 wrong tries", codes.slice(0, 8).every((c) => c === 401) && codes[8] === 429 && codes[9] === 429, codes.join(","));
r = await j(`${B}/api/auth/login`, { email: e3, password: "password123" }, fwd("10.1.0.2")); t("429 carries Retry-After and plain message", r.status === 429 && !!r.headers.get("retry-after") && /wait/.test((await r.json()).error));
r = await j(`${B}/api/auth/login`, { email: e3, password: "password123" }, fwd("10.1.0.99")); t("same account from another IP is not locked out", r.status === 200);
const e4 = uniq(); await j(`${B}/api/auth/signup`, { email: e4, password: "password123" }, fwd("10.2.0.1"));
for (let i = 0; i < 3; i++) await j(`${B}/api/auth/login`, { email: e4, password: "bad" + i + "bad" }, fwd("10.2.0.2"));
await j(`${B}/api/auth/login`, { email: e4, password: "password123" }, fwd("10.2.0.2"));
codes = []; for (let i = 0; i < 7; i++) codes.push((await j(`${B}/api/auth/login`, { email: e4, password: "bad" + i + "bad" }, fwd("10.2.0.2"))).status);
t("good login resets the counter", codes.every((c) => c === 401), codes.join(","));
codes = []; for (let i = 0; i < 12; i++) codes.push((await j(`${B}/api/auth/signup`, { email: uniq(), password: "password123" }, fwd("10.3.0.1"))).status);
t("signup limited to 10/hour per IP", codes.slice(0, 10).every((c) => c === 200) && codes[10] === 429, codes.join(","));

// no provider configured: honest
r = await j(`${NO}/api/auth/forgot`, { email }); t("forgot says plainly it is not set up when no email provider", r.status === 503 && /not set up/.test((await r.json()).error));
const dash = await (await j(`${NO}/api/auth/signup`, { email: uniq(), password: "password123" })).headers.get("set-cookie");
const p3 = await (await fetch(`${NO}/dashboard`, { headers: { cookie: dash.split(";")[0] } })).text(); t("no banner when email not configured", !p3.includes("Please confirm your email"));
// pages render
for (const p of ["/forgot", "/reset?token=abc", "/verify?token=abc", "/login"]) t(`page ${p} renders`, (await fetch(`${B}${p}`)).status === 200);
t("login page links to forgot", (await (await fetch(`${B}/login`)).text()).includes("/forgot"));
console.log(`---- ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
