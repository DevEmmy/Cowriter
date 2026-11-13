/** Counts words in editor HTML. Block-level closers become spaces so paragraphs never fuse; inline tags vanish. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>|<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
export const countWords = (html: string) => (htmlToText(html).match(/\S+/g) ?? []).length;
