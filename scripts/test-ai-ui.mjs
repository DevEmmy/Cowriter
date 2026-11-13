// Drives the AI panel in Chrome against a dev server started with AI_PROVIDER=mock.
import { chromium } from "playwright-core";
const B = process.env.BASE ?? "http://localhost:3111";
const results = []; const t = (n, ok, x = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${n}${x ? " (" + x + ")" : ""}`); };
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on("dialog", (d) => d.accept());
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${B}/signup`);
await page.fill("input[name=email]", `aiui${Date.now()}@t.io`); await page.fill("input[name=password]", "password123");
await page.click('button:has-text("Sign up")'); await page.waitForURL("**/dashboard");
await page.click('button:has-text("Start Writing")'); await page.fill('input[maxlength="150"]', "AI UI Novel"); await page.click('button:has-text("Create and write")');
await page.waitForURL("**/studio/**");
const ed = page.locator(".ProseMirror"); await ed.waitFor();
const saved = () => page.locator("header [role=status]").filter({ hasText: /^Saved/ }).waitFor({ timeout: 8000 });
await ed.click();
const para = (n) => Array.from({ length: n }, (_, i) => `Word${i}`).join(" ") + ".";
await page.keyboard.type(para(80)); await page.keyboard.press("Enter"); await page.keyboard.press("Enter"); await page.keyboard.type(para(80));
await saved();

await page.click('header button:has-text("AI")');
t("AI panel opens", await page.locator('aside[aria-label="Co Writer assistant"]').count() === 1);
await page.fill('textarea[aria-label="Message to Co Writer"]', "Is the opening strong?");
await page.click('button:has-text("Send")');
await page.waitForSelector("text=[mock reply]");
t("chat shows the reply", true);
await page.reload(); await ed.waitFor(); await page.click('header button:has-text("AI")');
await page.waitForSelector("text=Is the opening strong?");
t("chat history persists after reload", true);

// Improve: select the first paragraph and accept the suggestion
await page.click('button:has-text("Improve")');
await ed.click(); await page.keyboard.press("Control+Home"); await page.keyboard.press("Shift+End");
await page.click('button:has-text("Use my current selection")');
await page.click('button:has-text("Suggest improvement")');
await page.waitForSelector('text=Suggestion');
t("improve returns a suggestion with Accept/Reject", await page.locator('button:has-text("Accept")').count() === 1 && await page.locator('button:has-text("Reject")').count() === 1);
await page.click('button:has-text("Reject")');
t("reject leaves the text untouched", (await ed.innerText()).includes("Word0 Word1"));

// Expand: accept creates a safety version first
await page.click('button:has-text("Expand"):not(:has-text("chapter"))');
await page.fill('input[type=number]', "400");
await page.click('button:has-text("Expand chapter")');
await page.waitForSelector("text=Revised version", { timeout: 20000 });
t("expansion shows progress numbers", await page.locator("text=/Section \\d+ of \\d+/").count() >= 1);
t("expansion shows a length check", await page.locator("text=/Length \\d+ words/").count() === 1);
const beforeText = await ed.innerText();
await page.click('button:has-text("Accept")');
await page.waitForFunction(() => document.querySelector(".ProseMirror")?.textContent?.includes("Mock sentence"), null, { timeout: 8000 }).catch(() => {});
await saved();
t("accept replaced the chapter", (await ed.innerText()) !== beforeText && (await ed.innerText()).includes("Mock sentence"));
await page.click('header button:has-text("History")');
await page.waitForSelector('aside[aria-label="Version history"] li');
t("a safety version of the original exists", await page.locator('aside[aria-label="Version history"] >> text=Saved by you').count() >= 1);

await page.click('header button:has-text("AI")'); await page.click('button:has-text("Prose check")');
await page.waitForSelector('text=Average sentence', { timeout: 5000 }).catch(() => {});
t("prose check shows metrics and the detector disclaimer", await page.locator("text=Average sentence").count() === 1 && await page.locator("text=no external detector is connected").count() === 1);

await page.goto(`${B}/voice`); await page.waitForLoadState("networkidle");
await page.fill('textarea[placeholder^="Paste"]', Array(30).fill("She crossed the quiet street and listened to the rain on the awning.").join(" "));
await page.click('button:has-text("+ Avoid em dashes")');
await page.click('button:has-text("Save and analyse my voice")');
await page.waitForSelector("text=Your voice profile", { timeout: 10000 });
t("voice analysis saved and displayed", true);
t("no uncaught page errors", errors.length === 0, errors.join(" | "));
await page.screenshot({ path: "/tmp/ai-desktop.png" });
await browser.close();
const f = results.filter((x) => !x).length; console.log(`---- ${results.length - f} passed, ${f} failed`); process.exit(f ? 1 : 0);
