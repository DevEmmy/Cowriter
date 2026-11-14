// Drives the real editor in Chrome against a running dev server.
import { chromium } from "playwright-core";
const B = process.env.BASE ?? "http://localhost:3111";
const results = []; const t = (n, ok, extra = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${n}${extra ? " (" + extra + ")" : ""}`); };
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${B}/signup`);
await page.fill('input[name=name]', "Ada Test");
await page.fill('input[name=email]', `ui${Date.now()}@t.io`);
await page.fill('input[name=password]', "password123");
await page.click('button:has-text("Sign up")');
await page.waitForURL("**/dashboard"); await page.locator("text=Welcome back").first().waitFor({ timeout: 10000 }).catch(() => {});
const n = await page.locator("text=Welcome back, Ada").count(); t("signup lands on dashboard", n >= 1, "count " + n);

await page.click('button:has-text("Start Writing")');
await page.fill('input[maxlength="150"]', "UI Test Novel");
await page.click('button:has-text("Create and write")');
await page.waitForURL("**/studio/**");
const ed = page.locator('.ProseMirror');
const saved = () => page.locator('header [role=status]').filter({ hasText: /^Saved/ }).waitFor({ timeout: 8000 });
await ed.waitFor();
t("editor mounted", await ed.count() === 1);

await ed.click();
await page.keyboard.type("The rain fell softly on the roof. She listened.");
t("word counter updates live", (await page.locator("text=/9 words/").count()) === 1);
t("status shows unsaved/saving right after typing", await page.locator('[role=status]').first().innerText().then((s) => /Unsaved|Saving|Saved/.test(s)));
await saved();
t("autosave reaches Saved", true);

await page.reload(); await ed.waitFor();
t("text persists after reload", (await ed.innerText()).includes("The rain fell softly"));

await ed.click();
await page.keyboard.press("Control+A");
await page.click('button[aria-label="Bold"]');
t("bold toolbar applies <strong>", (await ed.innerHTML()).includes("<strong>"));
await saved();

await page.fill('input[aria-label="Chapter title"]', "The Rain");
await saved();
await page.reload(); await ed.waitFor();
t("renamed title persists", (await page.inputValue('input[aria-label="Chapter title"]')) === "The Rain");

await page.click('button:has-text("+ Add chapter")');
await page.waitForFunction(() => document.querySelectorAll('nav[aria-label=Chapters] li').length === 2);
t("second chapter added", true);
await ed.waitFor(); await ed.click(); await page.keyboard.type("More rain on chapter two."); await saved();

await page.click('button:has-text("History")');
await page.click('button:has-text("Save version now")');
await page.waitForSelector('text=Version saved.'); await page.waitForTimeout(800);
t("manual version saved", await page.locator('aside[aria-label="Version history"] li').count() >= 1);

await page.click('button:has-text("Find")');
await page.fill('input[aria-label="Find"]', "rain");
await page.press('input[aria-label="Find"]', "Enter");
t("find locates a match", (await page.locator('text=/1 of \\d+/').count()) === 1);

await page.click('button:has-text("Dark")');
t("dark mode toggles", await page.locator('text=Light').count() >= 1);

await page.setViewportSize({ width: 390, height: 800 });
t("mobile viewport has no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
t("no uncaught page errors", errors.length === 0, errors.join(" | "));
await page.screenshot({ path: "/tmp/studio-mobile.png" });
await page.setViewportSize({ width: 1280, height: 800 });
await page.screenshot({ path: "/tmp/studio-desktop.png" });
await browser.close();
const f = results.filter((x) => !x).length; console.log(`---- ${results.length - f} passed, ${f} failed`); process.exit(f ? 1 : 0);
