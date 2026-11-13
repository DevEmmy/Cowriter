import assert from "node:assert";
import { coverSvg, defaultDesign, designSchema, wrap, PALETTE_KEYS, TEMPLATES } from "../src/lib/cover";
assert.deepStrictEqual(wrap("one two three four", 8), ["one two", "three", "four"]);
assert.equal(wrap("a b c d e f g h i j k l", 3, 2).length, 2); assert.ok(wrap("a b c d e f g h i j k l", 3, 2)[1].endsWith("…"));
for (const t of TEMPLATES) for (const p of PALETTE_KEYS) {
  const svg = coverSvg({ ...defaultDesign("Tide & <Salt>", "A\"da"), template: t, palette: p });
  assert.ok(svg.startsWith("<svg") && svg.endsWith("</svg>")); assert.ok(!svg.includes("<Salt>")); assert.ok(svg.includes("Tide &amp; &lt;Salt&gt;"));
  assert.ok(svg.includes(`id="g-${p}"`), `${t}/${p} gradient id`);
  for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) assert.equal(m[1], `g-${p}`);
  assert.ok(!/url\(#g\)/.test(svg));
}
assert.ok(!designSchema.safeParse({ ...defaultDesign("x"), template: "evil" }).success);
assert.ok(!designSchema.safeParse({ ...defaultDesign("x"), palette: "nope" }).success);
assert.ok(!designSchema.safeParse({ ...defaultDesign(""), title: " " }).success);
console.log("cover unit ok");
