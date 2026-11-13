// Stage 5 pages in Chrome: analyser, detectors, covers (real PNG download), library downloads, analytics, mobile layout.
import { chromium } from "playwright-core";
import fs from "node:fs";
const B = process.env.BASE ?? "http://localhost:3111", B2 = process.env.BASE2 ?? "http://localhost:3112";
const results = []; const t = (n, ok, x = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${n}${x ? " (" + x + ")" : ""}`); };
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage(); page.on("dialog", (d) => d.accept());
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
const email = `s5ui${Date.now()}@t.io`;
await page.goto(`${B}/signup`);
await page.fill("input[name=email]", email); await page.fill("input[name=password]", "password123");
await page.click('button:has-text("Sign up")'); await page.waitForURL("**/dashboard");
await page.click('button:has-text("Start Writing")'); await page.fill('input[maxlength="150"]', "Tide and Salt"); await page.click('button:has-text("Create and write")');
await page.waitForURL("**/studio/**");
const ed = page.locator(".ProseMirror"); await ed.waitFor(); await ed.click();
const sent = "Adaeze walked down to the harbour at dawn and watched the boats come in. She felt the cold in her bones and said nothing to the fishermen, who were mending nets. ";
await page.keyboard.type(sent.repeat(4));
await page.locator("header [role=status]").filter({ hasText: /^Saved/ }).waitFor({ timeout: 8000 });

await page.goto(`${B}/analytics`);
t("analytics shows today's words", await page.locator("text=Words (30 days)").count() === 1 && await page.locator('[role=img][aria-label^="Bar chart"]').count() === 1);
await page.click("summary:has-text('View as a table')"); t("analytics table alternative", await page.locator("table td").count() >= 2);
t("analytics lists the project", await page.locator("text=Tide and Salt").count() >= 1);

await page.goto(`${B}/analyser`);
await page.click('button:has-text("Analyse this chapter")');
await page.locator('[aria-label="Analysis results"]').waitFor({ timeout: 15000 });
t("metrics shown", await page.locator("text=Readability").count() >= 1 && await page.locator("text=Sentence rhythm").count() === 1);
t("pacing chart present", await page.locator('section[aria-label="Pacing"] [role=img]').count() === 1);
t("editor feedback shown and labelled opinion", await page.locator("text=A mock editor summary.").count() === 1 && await page.locator("text=AI opinion, not fact").count() === 1);
t("detector box offers connected provider", await page.locator('button:has-text("Check with GPTZero")').count() === 1);
await page.click('button:has-text("Check with GPTZero")'); await page.locator('[aria-label="Detector result"]').waitFor();
t("detector number is exactly what provider returned", await page.locator("text=12% likely AI-written").count() === 1 && await page.locator("text=Human: 88%").count() === 1);

await page.goto(`${B}/covers`);
const prev = page.locator('[data-testid="cover-preview"] svg'); await prev.waitFor();
t("cover preview has title", (await prev.getAttribute("aria-label")).includes("Tide and Salt"));
await page.fill('input[maxlength="160"] >> nth=0', "A Novel");
await page.click('button:has-text("Circle")'); await page.click('button[aria-pressed]:has-text("Midnight gold")');
t("preview updates with layout and palette", (await prev.innerHTML()).includes("circle") && (await prev.innerHTML()).includes("#fbbf24"));
await page.fill('input[maxlength="120"]', "Tide <b>&</b> Salt");
t("title is escaped in svg (no injection)", !(await prev.innerHTML()).includes("<b>") && (await prev.innerHTML()).includes("&lt;b&gt;"));
await page.fill('input[maxlength="120"]', "Tide and Salt");
const [dl] = await Promise.all([page.waitForEvent("download"), page.click('button:has-text("Download PNG")')]);
const p = await dl.path(); const buf = fs.readFileSync(p);
t("PNG download is a real PNG", buf.subarray(0, 4).toString("hex") === "89504e47", dl.suggestedFilename());
t("PNG is 1200x1800", buf.readUInt32BE(16) === 1200 && buf.readUInt32BE(20) === 1800, `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`);
fs.copyFileSync(p, "/tmp/cover-test.png");
const [dl2] = await Promise.all([page.waitForEvent("download"), page.click('button:has-text("Download SVG")')]);
t("SVG download", fs.readFileSync(await dl2.path(), "utf8").startsWith("<svg"));
await page.click('button:has-text("Suggest a look")'); await page.locator("text=A mock concept.").waitFor();
t("AI look applied (layout + palette)", (await prev.innerHTML()).includes("#fbbf24") && await page.locator('button[aria-pressed="true"]:has-text("Framed")').count() === 1);
await page.fill('input[aria-label="Design name"]', "Version A"); await page.click('section[aria-label="Saved covers"] button:has-text("Save")');
await page.locator('button[aria-label="Open Version A"]').waitFor(); t("design saved and listed", true);
await page.reload(); await page.locator('button[aria-label="Open Version A"]').waitFor(); t("saved design persists after reload", true);
await page.click('button[aria-label="Delete Version A"]'); await page.waitForFunction(() => !document.querySelector('button[aria-label="Open Version A"]')); t("saved design deleted", true);

await page.goto(`${B}/library`);
const [pdf] = await Promise.all([page.waitForEvent("download"), page.click('a:has-text("Download PDF")')]);
t("library PDF download", fs.readFileSync(await pdf.path()).subarray(0, 5).toString() === "%PDF-", pdf.suggestedFilename());
const [dx] = await Promise.all([page.waitForEvent("download"), page.click('a:has-text("Download Word")')]);
t("library DOCX download", fs.readFileSync(await dx.path()).subarray(0, 2).toString() === "PK", dx.suggestedFilename());

// detector box when nothing is connected (second server without keys)
const p2 = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await p2.goto(`${B2}/signup`); await p2.fill("input[name=email]", `s5b${Date.now()}@t.io`); await p2.fill("input[name=password]", "password123"); await p2.click('button:has-text("Sign up")'); await p2.waitForURL("**/dashboard");
await p2.click('button:has-text("Start Writing")'); await p2.fill('input[maxlength="150"]', "Plain"); await p2.click('button:has-text("Create and write")'); await p2.waitForURL("**/studio/**");
await p2.goto(`${B2}/analyser`);
await p2.locator("text=No detector is connected.").waitFor();
t("unconfigured detectors say so and show no numbers", await p2.locator("text=GPTZERO_API_KEY").count() === 1 && await p2.locator("text=likely AI-written").count() === 0 && await p2.locator('button:has-text("Check with")').count() === 0);

// mobile layout of every new page
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, storageState: await ctx.storageState() });
const mp = await m.newPage();
for (const path of ["/covers", "/analyser", "/analytics", "/library", "/guard", "/bible"]) {
  await mp.goto(B + path); await mp.waitForLoadState("networkidle");
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const small = await mp.locator("main button:visible, main select:visible, main a.btn:visible, main input:visible").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 43).map((e) => (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 20)));
  t(`mobile ${path}: no overflow, targets >= 44px`, overflow <= 0 && small.length === 0, `overflow ${overflow}, small ${JSON.stringify(small)}`);
}
t("no page errors", errors.length === 0, errors.join("|"));
await browser.close(); process.exit(results.every(Boolean) ? 0 : 1);
