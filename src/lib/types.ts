export type UnitKind =
  | "title" | "heading" | "paragraph" | "list" | "table" | "equation"
  | "caption" | "reference" | "footnote" | "image" | "slide-text";

/** One meaningful piece of source content, always tied to its origin. */
export interface ContentUnit {
  id: string;            // stable within a document, e.g. "d1-p3-u12"
  docId: string;
  kind: UnitKind;
  level?: number;        // heading level (1 = top)
  text: string;          // plain text (lists: items joined by \n)
  rows?: string[][];     // tables
  page: number | null;   // 1-based source page (or slide); null if the format has no pages
  section: string[];     // heading path this unit sits under
  uncertain?: boolean;   // OCR or ambiguous extraction: needs human review
  note?: string;         // why it was flagged
}

export interface ExtractedDoc {
  done: boolean;
  format: "pdf" | "docx" | "pptx";
  pageCount: number;
  pagesDone: number;         // pages processed in the text pass
  bodySize?: number;         // PDF: dominant font size
  ocrPages: number[];        // PDF pages with too little text, queued for OCR
  ocrDone: number[];
  units: ContentUnit[];
  warnings: string[];
}
