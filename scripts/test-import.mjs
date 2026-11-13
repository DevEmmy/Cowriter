// API + UI checks for manuscript import. Needs a production server on :3111 (AI_PROVIDER=mock) and local Postgres.
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { chromium } from "playwright-core";
const B = process.env.BASE ?? "http://localhost:3111";
let pass = 0, fail = 0; const t = (n, ok, x = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${n}${ok || !x ? "" : " (" + x + ")"}`); };
async function signup() {
  const r = await fetch(`${B}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `imp${Date.now()}${Math.random().toString(36).slice(2, 6)}@t.io`, password: "password123", name: "Imp" }) });
  return r.headers.get("set-cookie").split(";")[0];
}
const cookie = await signup(); const other = await signup();
const post = async (fd, c = cookie) => { const r = await fetch(`${B}/api/projects/import`, { method: "POST", headers: { cookie: c }, body: fd }); return { s: r.status, d: await r.json() }; };
const fdOf = (o, file) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); if (file) f.set("file", file); return f; };
const para = (n) => `Para ${n}. ` + "She walked on, quietly, with Ọmọ́ and Adéọlá. ".repeat(6);

// txt with chapter lines
const txt = ["Chapter 1: The Start", para(1), para(2), "Chapter 2", para(3), "Epilogue", para(4)].join("\n\n");
let r = await post(fdOf({ title: "TXT Book", type: "novel", dryRun: "1" }, new File([txt], "book.txt")));
t("txt dry run splits 3 chapters", r.s === 200 && r.d.chapters.length === 3, JSON.stringify(r.d).slice(0, 200));
t("titles kept", r.d.chapters[0].title.startsWith("Chapter 1") && r.d.chapters[2].title === "Epilogue");
const list0 = await (await fetch(`${B}/api/projects`, { headers: { cookie } })).text();
t("dry run saved nothing", !list0.includes("TXT Book"));
r = await post(fdOf({ title: "TXT Book", type: "novel" }, new File([txt], "book.txt")));
t("txt import saves", r.s === 200 && r.d.id && r.d.chapterId, JSON.stringify(r.d));
const pid = r.d.id;
// single mode
r = await post(fdOf({ title: "One", type: "novel", split: "single" }, new File([txt], "book.txt")));
t("single mode = 1 chapter", r.d.chapters.length === 1);
// md
r = await post(fdOf({ title: "MD", dryRun: "1" }, new File(["# One\n\nHello *there* and **bold**.\n\n# Two\n\nSecond."], "x.md")));
t("md headings split", r.d.chapters.length === 2 && r.d.chapters[0].title === "One");
// docx
const doc = new Document({ sections: [{ children: [
  new Paragraph({ text: "The Opening", heading: HeadingLevel.HEADING_1 }), new Paragraph({ children: [new TextRun("Some "), new TextRun({ text: "italic", italics: true }), new TextRun(" words here.")] }),
  new Paragraph({ text: "The Middle", heading: HeadingLevel.HEADING_1 }), new Paragraph(para(5)) ] }] });
const docx = await Packer.toBuffer(doc);
r = await post(fdOf({ title: "Docx Book", type: "novel" }, new File([docx], "my_story.docx")));
t("docx import 2 chapters", r.s === 200 && r.d.chapters.length === 2 && r.d.chapters[0].title === "The Opening", JSON.stringify(r.d));
// check content formatting kept via export of chapter text
const exp = await fetch(`${B}/api/projects/${r.d.id}/export?format=txt`, { headers: { cookie } });
const et = await exp.text();
t("docx text exported intact", et.includes("Some italic words here.") && et.includes("Ọmọ́"));
// pdf
const pdf = await PDFDocument.create(); const font = await pdf.embedFont(StandardFonts.Helvetica);
let page = pdf.addPage([400, 600]); let y = 560;
for (const line of ["Chapter 1", "It was a dark night in the city and", "nobody was awake to see it happen.", "", "Chapter 2", "Morning came slowly over the hills."]) { if (line) page.drawText(line, { x: 30, y, size: 12, font }); y -= 20; }
r = await post(fdOf({ title: "PDF Book", dryRun: "1" }, new File([await pdf.save()], "p.pdf")));
t("pdf text extracted and split", r.s === 200 && r.d.chapters.length === 2, JSON.stringify(r.d));
const blank = await PDFDocument.create(); blank.addPage();
r = await post(fdOf({ title: "Blank", dryRun: "1" }, new File([await blank.save()], "scan.pdf")));
t("scanned pdf gives clear error", r.s === 400 && /no selectable text/.test(r.d.error), JSON.stringify(r.d));
// paste
r = await post(fdOf({ title: "Pasted", type: "short_story", text: "Chapter 1\n\nHello world, this is pasted." }));
t("paste import works", r.s === 200 && r.d.chapters.length === 1);
// errors
r = await post(fdOf({ title: "x" }, new File(["x"], "a.exe")));
t("unsupported type rejected", r.s === 400 && /Unsupported/.test(r.d.error));
r = await post(fdOf({ title: "x" }, new File([Buffer.alloc(4.5 * 1024 * 1024, "a")], "big.txt")));
t("oversize rejected", r.s === 400 && /4 MB/.test(r.d.error));
r = await post(fdOf({ title: "x" }));
t("empty rejected", r.s === 400);
r = await post(fdOf({ title: "x", type: "bogus", text: "hello there" }));
t("bad type rejected", r.s === 400);
r = await fetch(`${B}/api/projects/import`, { method: "POST", body: fdOf({ text: "hi" }) }); t("auth required", r.status === 401);
// append to existing
r = await post(fdOf({ projectId: pid }, new File(["Chapter 9\n\nMore text here today."], "more.txt")));
t("append to own project", r.s === 200 && r.d.id === pid);
const chs = await (await fetch(`${B}/api/projects/${pid}`, { headers: { cookie } })).json().catch(() => null);
r = await post(fdOf({ projectId: pid, text: "steal this please" }), other);
t("cannot append to someone else's project", r.s === 404);
r = await post(fdOf({ projectId: "nope", text: "x y z" }));
t("bad project id 404", r.s === 404);
// html injection stays escaped
r = await post(fdOf({ title: "XSS", text: "Chapter 1\n\n<script>alert(1)</script> hello" }));
const x = await (await fetch(`${B}/api/projects/${r.d.id}/export?format=txt`, { headers: { cookie } })).text();
t("script text kept as text, not markup", x.includes("<script>alert(1)</script>"));

// UI
const br = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const ctx = await br.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
const [name, value] = cookie.split("="); await ctx.addCookies([{ name, value, url: B }]);
const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto(`${B}/projects`);
await pg.click('button:has-text("Import manuscript")');
const h = await pg.locator('[role=dialog] button').evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect().height).filter((v) => v < 43));
t("import dialog targets >= 44px", h.length === 0, JSON.stringify(h));
t("review disabled until input", await pg.locator('button:has-text("Review chapters")').isDisabled());
await pg.setInputFiles("#import-file", { name: "my_novel.txt", mimeType: "text/plain", buffer: Buffer.from(txt) });
t("title prefilled from filename", (await pg.inputValue('input[placeholder="Name your project"]')) === "my novel");
await pg.click('button:has-text("Review chapters")');
await pg.locator("text=3 chapters").waitFor();
t("preview lists chapters", await pg.locator("ol li").count() === 3);
await pg.click('button:has-text("Import and open")');
await pg.waitForURL("**/studio/**");
t("opens in studio with text", await pg.locator("text=Para 1.").first().waitFor().then(() => true).catch(() => false));
t("no page errors", errs.length === 0, errs.join("|"));
await br.close();
console.log(`---- ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
