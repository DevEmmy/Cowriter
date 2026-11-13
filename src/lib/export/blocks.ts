/** Parses the editor's HTML (Tiptap output) into simple blocks shared by the DOCX, PDF and TXT exporters. */
export interface Run { text: string; bold?: boolean; italic?: boolean; underline?: boolean }
export interface Block { type: "p" | "h1" | "h2" | "h3" | "quote" | "li" | "hr"; runs: Run[]; align?: "left" | "center" | "right" | "justify"; ordered?: number }

const decode = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&");

export function htmlToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  const st: { cur: Block | null } = { cur: null };
  let b = 0, i = 0, u = 0, quote = 0;
  const lists: Array<{ ordered: boolean; n: number }> = [];
  const open = (type: Block["type"], align?: Block["align"], ordered?: number) => { if (st.cur) close(); st.cur = { type, runs: [], align, ordered }; };
  const close = () => { if (st.cur && st.cur.runs.some((r) => r.text.trim())) blocks.push(st.cur); st.cur = null; };
  for (const tok of html.split(/(<[^>]+>)/)) {
    if (!tok) continue;
    if (tok[0] !== "<") { const t = decode(tok.replace(/\s*\n\s*/g, " ")); if (!t) continue; if (!st.cur) open(quote ? "quote" : "p"); st.cur!.runs.push({ text: t, bold: b > 0, italic: i > 0, underline: u > 0 }); continue; }
    const m = tok.match(/^<(\/?)([a-z0-9]+)([^>]*)>/i); if (!m) continue;
    const closing = m[1] === "/", name = m[2].toLowerCase(), attrs = m[3];
    const align = attrs.match(/text-align:\s*(left|center|right|justify)/)?.[1] as Block["align"] | undefined;
    if (name === "strong" || name === "b") b += closing ? -1 : 1;
    else if (name === "em" || name === "i") i += closing ? -1 : 1;
    else if (name === "u") u += closing ? -1 : 1;
    else if (name === "br") { if (!st.cur) open("p"); st.cur!.runs.push({ text: "\n" }); }
    else if (name === "hr" && !closing) { close(); blocks.push({ type: "hr", runs: [] }); }
    else if (name === "blockquote") { close(); quote += closing ? -1 : 1; }
    else if (name === "ul" || name === "ol") { close(); if (closing) lists.pop(); else lists.push({ ordered: name === "ol", n: 0 }); }
    else if (name === "li") { if (closing) close(); else { const l = lists[lists.length - 1]; if (l) l.n++; open("li", undefined, l?.ordered ? l.n : undefined); } }
    else if (name === "p" || /^h[1-3]$/.test(name)) {
      if (closing) { if (st.cur?.type !== "li") close(); }
      else if (st.cur?.type !== "li") open(/^h/.test(name) ? (name as Block["type"]) : quote ? "quote" : "p", align);
    }
  }
  close();
  return blocks;
}

export const blockText = (bl: Block) => bl.runs.map((r) => r.text).join("");
