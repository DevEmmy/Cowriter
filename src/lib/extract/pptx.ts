import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { UnitBuilder } from "./structure";
import type { ExtractedDoc } from "@/lib/types";

const xml = new XMLParser({ ignoreAttributes: false, preserveOrder: false, removeNSPrefix: true });
const arr = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function paragraphsOf(node: unknown): string[] {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    if (o.p) for (const p of arr(o.p as object)) {
      const runs = arr((p as Record<string, unknown>).r as object).map((r) => String((r as Record<string, unknown>).t ?? ""));
      const t = runs.join("").trim();
      if (t) out.push(t);
    }
    for (const k of Object.keys(o)) if (k !== "p") walk(o[k]);
  };
  walk(node);
  return out;
}

export async function extractPptx(buf: Buffer, docId: string): Promise<ExtractedDoc> {
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, c) => Number(a.match(/\d+/)![0]) - Number(c.match(/\d+/)![0]));
  const b = new UnitBuilder(docId);
  for (let i = 0; i < names.length; i++) {
    const page = i + 1;
    const tree = xml.parse(await zip.files[names[i]].async("string"));
    const shapes = arr(tree?.sld?.cSld?.spTree?.sp as object);
    let first = true;
    for (const sp of shapes) {
      const lines = paragraphsOf((sp as Record<string, unknown>).txBody);
      if (!lines.length) continue;
      if (first && lines.length === 1) b.heading(lines[0], 1, page);
      else b.text(lines.join("\n"), page);
      first = false;
    }
    const tbls = JSON.stringify(tree).includes('"tbl"');
    if (tbls) b.flag(`[Slide ${page} contains a table that was not read]`, page, "Table on slide not extracted");
  }
  return { done: true, format: "pptx", pageCount: names.length, pagesDone: names.length, ocrPages: [], ocrDone: [], units: b.units, warnings: [] };
}
