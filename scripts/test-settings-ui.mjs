import { chromium } from "playwright-core";
const B = process.env.BASE ?? "http://localhost:3111"; let fail = 0; const t = (n, ok, x = "") => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"} ${n}${ok ? "" : " " + x}`); };
const r = await fetch(`${B}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `st${Date.now()}@t.io`, password: "password123" }) });
const [n, v] = r.headers.get("set-cookie").split(";")[0].split("=");
const br = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const ctx = await br.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true }); await ctx.addCookies([{ name: n, value: v, url: B }]);
const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(String(e)));
for (const path of ["/settings", "/privacy", "/terms", "/login", "/forgot"]) {
  await pg.goto(`${B}${path}`); await pg.waitForLoadState("networkidle");
  const o = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const small = await pg.evaluate(() => [...document.querySelectorAll("button, input:not([type=hidden]):not(.sr-only), select, a.btn")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43).map((e) => (e.textContent || e.name || "").slice(0, 20)));
  t(`${path}: no overflow, targets >= 44px`, o <= 0 && small.length === 0, JSON.stringify({ o, small }));
}
await pg.goto(`${B}/settings`); await pg.click('button:has-text("Delete my account")');
t("delete needs password confirm step", await pg.locator('button:has-text("Yes, delete everything")').isVisible());
t("no page errors", errs.length === 0, errs.join("|")); await br.close(); process.exit(fail ? 1 : 0);
