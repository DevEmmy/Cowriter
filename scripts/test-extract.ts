import { readFileSync } from "fs";
import { extractPdfPages, pdfPageCount } from "../src/lib/extract/pdf";
import { extractDocx } from "../src/lib/extract/docx";
import { extractPptx } from "../src/lib/extract/pptx";
import type { ExtractedDoc } from "../src/lib/types";

const show = (name: string, d: ExtractedDoc) => {
  console.log(`\n== ${name} (done=${d.done}, ocrPages=${JSON.stringify(d.ocrPages)}, warnings=${d.warnings.length})`);
  for (const u of d.units) console.log(`${u.kind.padEnd(10)} p${u.page ?? "-"} [${u.section.join(" > ")}] ${u.text.replace(/\n/g, " ⏎ ").slice(0, 90)}${u.uncertain ? " ⚠" : ""}`);
};
(async () => {
  const pdf = new Uint8Array(readFileSync("/tmp/samples/sample.pdf"));
  const n = await pdfPageCount(pdf);
  let st: ExtractedDoc = { done: false, format: "pdf", pageCount: n, pagesDone: 0, ocrPages: [], ocrDone: [], units: [], warnings: [] };
  st = await extractPdfPages(pdf, "d1", st, 1, 2); // two batches to test resume
  st = await extractPdfPages(pdf, "d1", st, 3, 3);
  show("pdf", st);
  show("docx", await extractDocx(readFileSync("/tmp/samples/sample.docx"), "d2"));
  show("pptx", await extractPptx(readFileSync("/tmp/samples/sample.pptx"), "d3"));
})();
