import { z } from "zod";

export const TEMPLATES = ["bold", "frame", "split", "circle", "minimal", "waves"] as const;
export const FONTS = ["serif", "sans", "display"] as const;
export interface Palette { name: string; bg1: string; bg2: string; accent: string; text: string; onAccent: string }
export const PALETTES: Record<string, Palette> = {
  "violet-dusk": { name: "Violet dusk", bg1: "#2a0f5c", bg2: "#7c3aed", accent: "#ffb98f", text: "#ffffff", onAccent: "#2a0f5c" },
  "coral-sunrise": { name: "Coral sunrise", bg1: "#ff6b5b", bg2: "#ffb98f", accent: "#2a0f5c", text: "#2a0f5c", onAccent: "#ffffff" },
  midnight: { name: "Midnight gold", bg1: "#0f172a", bg2: "#1e3a8a", accent: "#fbbf24", text: "#ffffff", onAccent: "#0f172a" },
  forest: { name: "Forest", bg1: "#052e16", bg2: "#166534", accent: "#fde68a", text: "#ffffff", onAccent: "#052e16" },
  rose: { name: "Rose wine", bg1: "#4a044e", bg2: "#be185d", accent: "#fecdd3", text: "#ffffff", onAccent: "#4a044e" },
  noir: { name: "Noir", bg1: "#111111", bg2: "#3a3a3a", accent: "#ff6b5b", text: "#ffffff", onAccent: "#111111" },
  parchment: { name: "Parchment", bg1: "#fffaf6", bg2: "#efe9ff", accent: "#7c3aed", text: "#1f1637", onAccent: "#ffffff" },
};
export const PALETTE_KEYS = Object.keys(PALETTES) as [string, ...string[]];

export const designSchema = z.object({
  template: z.enum(TEMPLATES), palette: z.enum(PALETTE_KEYS), font: z.enum(FONTS),
  title: z.string().trim().min(1).max(120), subtitle: z.string().trim().max(160).default(""), author: z.string().trim().max(80).default(""), tagline: z.string().trim().max(160).default(""),
});
export type Design = z.infer<typeof designSchema>;
export const defaultDesign = (title: string, author = ""): Design => ({ template: "bold", palette: "violet-dusk", font: "serif", title: title || "Untitled", subtitle: "", author, tagline: "" });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FAMILY = { serif: "Georgia, 'Times New Roman', serif", sans: "'Helvetica Neue', Arial, sans-serif", display: "'Trebuchet MS', Verdana, sans-serif" };

/** Word-wraps text by approximate width so long titles stay inside the cover. */
export function wrap(text: string, maxChars: number, maxLines = 5): string[] {
  const lines: string[] = []; let line = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + " " + w).length > maxChars) { lines.push(line); line = w; } else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); keep[maxLines - 1] += "…"; return keep; }
  return lines;
}

function textBlock(lines: string[], x: number, y: number, size: number, fill: string, family: string, weight: number, anchor: "middle" | "start", spacing = 1.15, extra = "") {
  return `<text x="${x}" y="${y}" font-size="${size}" font-family="${family}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" ${extra}>${lines.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : size * spacing}">${esc(l)}</tspan>`).join("")}</text>`;
}

/** Renders a cover as a self-contained 600x900 SVG string. All text is escaped; only enum values select shapes and colours. */
export function coverSvg(d: Design): string {
  const p = PALETTES[d.palette] ?? PALETTES["violet-dusk"], fam = FAMILY[d.font] ?? FAMILY.serif;
  const tsize = d.title.length > 48 ? 46 : d.title.length > 28 ? 58 : d.title.length > 14 ? 72 : 88;
  const widthPx = d.template === "circle" ? 380 : d.template === "minimal" ? 470 : 520;
  const tl = wrap(d.title, Math.floor(widthPx / (tsize * 0.55)), 5);
  const gid = `g-${d.palette}`; // same palette => identical gradient, so sharing the id between covers on one page is safe
  const th = tl.length * tsize * 1.15;
  const defs = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${p.bg1}"/><stop offset="1" stop-color="${p.bg2}"/></linearGradient></defs>`;
  const author = d.author ? (anchor: "middle" | "start", x: number, y: number, fill: string) => textBlock([d.author.toUpperCase()], x, y, 28, fill, fam, 600, anchor, 1, `letter-spacing="4"`) : () => "";
  const sub = (anchor: "middle" | "start", x: number, y: number, fill: string) => (d.subtitle ? textBlock(wrap(d.subtitle, 34, 3), x, y, 26, fill, fam, 400, anchor, 1.3, `font-style="italic"`) : "");
  const tag = (x: number, y: number, fill: string, anchor: "middle" | "start" = "middle") => (d.tagline ? textBlock(wrap(d.tagline, 40, 2), x, y, 20, fill, fam, 400, anchor, 1.3, `letter-spacing="1"`) : "");
  let body = "";
  switch (d.template) {
    case "frame": {
      const y0 = 330 - th / 2 + tsize * 0.8;
      body = `<rect width="600" height="900" fill="url(#${gid})"/><rect x="36" y="36" width="528" height="828" fill="none" stroke="${p.accent}" stroke-width="4"/><rect x="52" y="52" width="496" height="796" fill="none" stroke="${p.accent}" stroke-width="1.5"/>${textBlock(tl, 300, y0, tsize, p.text, fam, 700, "middle")}<line x1="200" y1="${y0 + th - tsize * 0.6}" x2="400" y2="${y0 + th - tsize * 0.6}" stroke="${p.accent}" stroke-width="3"/>${sub("middle", 300, y0 + th + 40, p.text)}${author("middle", 300, 770, p.accent)}${tag(300, 815, p.text)}`;
      break;
    }
    case "split": {
      const y0 = 250 - th / 2 + tsize * 0.8;
      body = `<rect width="600" height="900" fill="${p.bg1}"/><polygon points="0,0 600,0 600,540 0,640" fill="url(#${gid})"/><polygon points="0,640 600,540 600,570 0,670" fill="${p.accent}"/>${textBlock(tl, 300, y0, tsize, p.text, fam, 800, "middle")}${sub("middle", 300, y0 + th + 30, p.text)}${author("middle", 300, 790, p.bg1 === "#fffaf6" ? p.text : "#ffffff")}${tag(300, 835, p.bg1 === "#fffaf6" ? p.text : "#ffffff")}`;
      break;
    }
    case "circle": {
      const y0 = 420 - th / 2 + tsize * 0.8;
      body = `<rect width="600" height="900" fill="url(#${gid})"/><circle cx="300" cy="410" r="${Math.min(260, 150 + th / 2)}" fill="${p.accent}" opacity="0.96"/>${textBlock(tl, 300, y0, tsize, p.onAccent, fam, 800, "middle")}${sub("middle", 300, 740, p.text)}${author("middle", 300, 825, p.text)}${tag(300, 860, p.text)}`;
      break;
    }
    case "minimal": {
      const y0 = 560 - th + tsize * 0.8;
      body = `<rect width="600" height="900" fill="${p.bg1}"/><rect x="56" y="${y0 - tsize - 24}" width="90" height="8" fill="${p.accent}"/>${textBlock(tl, 56, y0, tsize, p.text, fam, 700, "start")}${sub("start", 56, y0 + th + 24, p.text)}${author("start", 56, 820, p.accent)}${tag(56, 860, p.text, "start")}`;
      break;
    }
    case "waves": {
      const y0 = 300 - th / 2 + tsize * 0.8;
      body = `<rect width="600" height="900" fill="url(#${gid})"/><path d="M0 640 Q150 580 300 640 T600 640 V900 H0Z" fill="${p.accent}" opacity="0.35"/><path d="M0 720 Q150 660 300 720 T600 720 V900 H0Z" fill="${p.accent}" opacity="0.6"/><path d="M0 800 Q150 740 300 800 T600 800 V900 H0Z" fill="${p.accent}"/>${textBlock(tl, 300, y0, tsize, p.text, fam, 700, "middle")}${sub("middle", 300, y0 + th + 30, p.text)}${author("middle", 300, 845, p.onAccent)}${tag(300, 880, p.onAccent)}`;
      break;
    }
    default: {
      const y0 = 340 - th / 2 + tsize * 0.8;
      body = `<rect width="600" height="900" fill="url(#${gid})"/><rect x="0" y="${y0 - tsize - 30}" width="600" height="${th + tsize + 60 + (d.subtitle ? 60 : 0)}" fill="${p.accent}" opacity="0.18"/><rect x="0" y="${y0 - tsize - 30}" width="14" height="${th + tsize + 60 + (d.subtitle ? 60 : 0)}" fill="${p.accent}"/>${textBlock(tl, 300, y0, tsize, p.text, fam, 800, "middle")}${sub("middle", 300, y0 + th + 34, p.text)}${author("middle", 300, 800, p.accent)}${tag(300, 845, p.text)}`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="600" height="900" role="img" aria-label="${esc(`Book cover: ${d.title}${d.author ? ` by ${d.author}` : ""}`)}">${defs}${body}</svg>`;
}
