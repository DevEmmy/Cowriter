import assert from "node:assert/strict";
import { analyse, checkProse, stripDashes } from "../src/lib/ai/textstats";
import { planSections, textToHtml } from "../src/lib/ai/expand";

const prose = Array.from({ length: 30 }, (_, i) => `She walked to the door number ${i}. It was cold outside.`).join(" ");
const a = analyse(prose);
assert.equal(a.pov, "third person"); assert.equal(a.tense, "past"); assert.ok(a.sentences >= 59);

const issues = checkProse("He said it — then he left. He said it — then he left. In that moment the air was thick. Rain fell. Rain stayed. Rain left.");
const types = issues.map((i) => i.type);
assert.ok(types.includes("dashes"), "dashes flagged");
assert.ok(types.includes("repeated-sentence"), "repeated sentence flagged");
assert.ok(types.includes("generic-phrase"), "generic phrase flagged");
assert.ok(types.includes("repeated-opener"), "repeated opener flagged");
assert.equal(stripDashes("one — two – three"), "one, two, three");
assert.ok(!/[—–]/.test(stripDashes("a—b")));

const para = (n: number) => `<p>${Array.from({ length: n }, (_, i) => `word${i}`).join(" ")}.</p>`;
const html = para(150) + para(150) + para(150) + para(150) + para(40);
const secs = planSections(html, 1000);
const origTotal = 640;
assert.equal(secs.reduce((s, x) => s + x.words, 0), origTotal, "all original words land in a section");
assert.ok(Math.abs(secs.reduce((s, x) => s + x.wanted, 0) - 1000) <= 2, "section targets sum to the target");
assert.ok(secs.every((s) => s.wanted >= s.words), "no section is asked to shrink");
assert.deepEqual(planSections("", 500), [], "empty chapter has no sections");
assert.equal(textToHtml("One <b>two</b>\n\nThree & four"), "<p>One &lt;b&gt;two&lt;/b&gt;</p><p>Three &amp; four</p>", "text is escaped into paragraphs");
console.log("ai unit tests passed");
