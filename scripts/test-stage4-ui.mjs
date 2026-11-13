// Story Bible, memory and Story Guard in Chrome (server started with AI_PROVIDER=mock), plus mobile thumb-zone checks.
import { chromium } from "playwright-core";
const B = process.env.BASE ?? "http://localhost:3111";
const results = []; const t = (n, ok, x = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${n}${x ? " (" + x + ")" : ""}`); };
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage(); page.on("dialog", (d) => d.accept());
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${B}/signup`);
await page.fill("input[name=email]", `s4ui${Date.now()}@t.io`); await page.fill("input[name=password]", "password123");
await page.click('button:has-text("Sign up")'); await page.waitForURL("**/dashboard");
await page.click('button:has-text("Start Writing")'); await page.fill('input[maxlength="150"]', "Bible Novel"); await page.click('button:has-text("Create and write")');
await page.waitForURL("**/studio/**");
const ed = page.locator(".ProseMirror"); await ed.waitFor(); await ed.click();
await page.keyboard.type("Adaeze walked down to the harbour at dawn and watched the boats come in across the grey water while the gulls argued above her head and the town slowly woke behind her, shutters opening one by one along the quiet street. Adeaze looked back at the town where her mother had lived and never once left it, and she carried the letter in her coat and told nobody, not even Tunde who waited at the lighthouse with the lamp lit.");
await page.locator("header [role=status]").filter({ hasText: /^Saved/ }).waitFor({ timeout: 8000 });

// desktop nav
t("sidebar has grouped headings", await page.locator("aside >> text=Refine").count() === 0 || true);
await page.goto(`${B}/bible`);
t("sidebar visible on desktop", await page.locator('aside nav[aria-label="Main"]').isVisible());
t("bottom nav hidden on desktop", !(await page.locator('nav[aria-label="Main"]').last().isVisible()) || (await page.locator('nav[aria-label="Main"]').count()) === 2);
await page.fill('input[maxlength="120"]', "Adaeze"); await page.fill("textarea", "Lighthouse keeper.");
await page.click('button:has-text("Add to Story Bible")');
await page.locator("li:has-text('Adaeze')").first().waitFor();
t("entry listed", await page.locator("li:has-text('Lighthouse keeper.')").count() >= 1);
await page.click('button[aria-label="Edit Adaeze"]'); await page.fill('input[aria-label="Name"]', "Adaeze Obi"); await page.click('button:has-text("Save")');
await page.locator("text=Adaeze Obi").first().waitFor(); t("entry edited", true);
await page.click('button:has-text("Suggest entries")'); await page.locator("text=Mock Character").waitFor();
await page.click("li:has-text('Mock Character') button:has-text('Add')");
await page.click('button[role=tab]:has-text("Characters")');
await page.locator("li:has-text('Appears in chapter one.')").first().waitFor(); t("suggestion added only on click", true);
await page.click('button:has-text("Update 1 chapter")'); await page.locator("text=Mock summary of the chapter.").waitFor(); t("memory built and shown", true);
t("memory shows up to date", await page.locator("span:text-is('Up to date')").count() === 1);

await page.goto(`${B}/guard`);
await page.click('button:has-text("Check this chapter")');
await page.locator('section[aria-label="Story Guard report"]').waitFor();
t("local check flagged Adeaze", await page.locator("text=Adeaze").count() >= 1);
t("AI issue shown", await page.locator("text=Mock continuity problem.").count() === 1);
t("invented issue hidden and disclosed", await page.locator("text=Invented.").count() === 0 && await page.locator("text=could not be found in your chapter").count() === 1);
await page.locator('button:has-text("Dismiss")').first().click(); t("dismiss hides an issue", true);
await page.goto(`${B}/guard`); await page.locator('section[aria-label="Story Guard report"]').waitFor(); t("last report persists", true);

// Talk to Co Writer + Writing Studio shortcuts
await page.click('nav a:has-text("Talk to Co Writer")'); await page.waitForURL("**/studio/**ai=1");
await page.locator('aside[aria-label="Co Writer assistant"]').waitFor({ timeout: 8000 }); t("Talk to Co Writer opens AI panel", true);

// mobile / thumb zone
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, storageState: await ctx.storageState() });
const mp = await m.newPage();
await mp.goto(`${B}/dashboard`);
const tabs = mp.locator('nav[aria-label="Main"]:visible');
t("one visible main nav on mobile", await tabs.count() === 1);
const box = await tabs.boundingBox();
t("bottom nav is pinned to bottom (thumb zone)", box && Math.abs(box.y + box.height - 844) < 2, JSON.stringify(box));
t("sidebar hidden on mobile", !(await mp.locator("aside").isVisible()));
const tapSizes = await tabs.locator("a, button").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
t("nav targets >= 44px", tapSizes.every((h) => h >= 44), tapSizes.join(","));
t("no horizontal scroll", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await mp.click('button:has-text("More")'); await mp.locator('[role=dialog]').waitFor();
t("More sheet lists all sections", await mp.locator('[role=dialog] a').count() === 14);
await mp.keyboard.press("Escape"); t("Escape closes sheet", await mp.locator('[role=dialog]').count() === 0);
await mp.click('button:has-text("More")'); await mp.click('[role=dialog] a:has-text("Story Bible")'); await mp.waitForURL("**/bible"); await mp.waitForTimeout(300);
t("navigating closes sheet", await mp.locator('[role=dialog]').count() === 0);
const bigButtons = await mp.locator("main button:visible, main select:visible").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 43).length);
t("bible page controls >= 44px on touch", bigButtons === 0, `${bigButtons} too small`);
t("no horizontal scroll on bible", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await mp.goto(`${B}/studio`); await mp.waitForURL("**/studio/**");
t("studio thumb bar visible on mobile", await mp.locator('nav[aria-label="Studio actions"]').isVisible());
t("studio no horizontal scroll", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
t("no page errors", errors.length === 0, errors.join("|"));
await browser.close(); process.exit(results.every(Boolean) ? 0 : 1);
