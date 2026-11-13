import mammoth from "mammoth";
import { parse, HTMLElement } from "node-html-parser";
import { UnitBuilder } from "./structure";
import type { ExtractedDoc } from "@/lib/types";

export async function extractDocx(buf: Buffer, docId: string): Promise<ExtractedDoc> {
  const { value: html, messages } = await mammoth.convertToHtml({ buffer: buf }, { styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='Subtitle'] => h2:fresh"] });
  const root = parse(html);
  const b = new UnitBuilder(docId);
  const text = (el: HTMLElement) => el.text.replace(/\s+/g, " ").trim();
  let images = 0;
  for (const el of root.childNodes) {
    if (!(el instanceof HTMLElement)) continue;
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) b.heading(text(el), Number(tag[1]), null);
    else if (tag === "p") {
      const t = text(el);
      if (el.querySelector("img")) { images++; b.flag(t || "[image]", null, "Contains an image; its content was not read"); }
      else b.text(t, null);
    } else if (tag === "ul" || tag === "ol") {
      const items = el.querySelectorAll("li").map((li, i) => (tag === "ol" ? `${i + 1}. ` : "• ") + text(li));
      b.text(items.join("\n"), null);
    } else if (tag === "table") {
      b.table(el.querySelectorAll("tr").map((tr) => tr.querySelectorAll("td,th").map((c) => text(c))), null);
    } else { const t = text(el); if (t) b.text(t, null); }
  }
  const warnings = messages.filter((m) => m.type === "warning").map((m) => m.message).slice(0, 5);
  if (images) warnings.push(`${images} image(s) in the document were not interpreted.`);
  return { done: true, format: "docx", pageCount: 0, pagesDone: 0, ocrPages: [], ocrDone: [], units: b.units, warnings };
}
