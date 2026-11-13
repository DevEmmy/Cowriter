import { PDFDocument, StandardFonts } from "pdf-lib";
import PptxGenJS from "pptxgenjs";
import { writeFileSync } from "fs";

async function main() {
  const pdf = await PDFDocument.create();
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  let p = pdf.addPage([595, 842]);
  let y = 780;
  const line = (t: string, size: number) => { p.drawText(t, { x: 50, y, size, font: f }); y -= size * 1.5; };
  line("Machine Learning Primer", 26);
  y -= 10;
  line("1. Introduction", 18);
  line("Machine learning is a field of study that gives computers the ability to learn", 11);
  line("without being explicitly programmed. It powers many modern applications.", 11);
  y -= 14;
  line("Key Definitions", 18);
  line("- Supervised learning: learning from labelled examples.", 11);
  line("- Unsupervised learning: finding structure in unlabelled data.", 11);
  y -= 14;
  line("E = m c ^ 2 = energy", 11);
  y -= 14;
  line("Table 1. Accuracy of three models on the test set.", 10);
  p = pdf.addPage([595, 842]); // second page: scanned-like (no text)
  p = pdf.addPage([595, 842]); y = 780;
  line("References", 18);
  line("Mitchell, T. (1997). Machine Learning. McGraw-Hill.", 11);
  writeFileSync("/tmp/samples/sample.pdf", await pdf.save());

  const ppt = new PptxGenJS();
  const s1 = ppt.addSlide(); s1.addText("Quarterly Review", { x: 1, y: 1, w: 8, h: 1, fontSize: 32 });
  s1.addText("Revenue grew 12% year over year.\nChurn fell to 3%.", { x: 1, y: 2.5, w: 8, h: 2 });
  await ppt.writeFile({ fileName: "/tmp/samples/sample.pptx" });
}
main();
