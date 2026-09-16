/** The canonical record shape every adapter must produce (see contracts/). */
export interface SourceRecord {
  hadith_number: string | null;
  volume_number: number | null;
  page_number: number | null;
  /** Verbatim text as extracted. Required — a record without text is invalid. */
  raw_text: string;
  /** Only when the source itself separates them. Otherwise null (§11/§36). */
  matn: string | null;
  isnad: string | null;
  takhrij: string | null;
  grading: string | null;
  original_reference: string | null;
  original_hadith_number: string | null;
  book: { key: string; name: string; order_number: number | null } | null;
  chapter: {
    key: string;
    name: string;
    chapter_number: string | null;
    order_number: number | null;
    parent_key: string | null;
  } | null;
  narrator: { name: string; kunya: string | null; laqab: string | null; biography: string | null } | null;
  narrators: { name: string; position: number | null; role: string | null }[];
  sources: { source_name: string; reference: string | null; reference_number: string | null }[];
  gradings: { grading: string; grader: string | null; source_reference: string | null; notes: string | null }[];
  references: { reference_type: 'quran' | 'hadith' | 'book' | 'page' | 'other'; reference_text: string }[];
  /** Fields present in the file that the adapter did not map — reported, never guessed. */
  unmapped: Record<string, unknown>;
}

export interface ParseResult {
  records: SourceRecord[];
  warnings: string[];
  edition_hint: Record<string, unknown> | null;
}

export interface Adapter {
  readonly name: string;
  readonly accepts: string[];
  parse(input: Buffer, fileName: string): ParseResult;
}

export const emptyRecord = (raw_text: string): SourceRecord => ({
  hadith_number: null,
  volume_number: null,
  page_number: null,
  raw_text,
  matn: null,
  isnad: null,
  takhrij: null,
  grading: null,
  original_reference: null,
  original_hadith_number: null,
  book: null,
  chapter: null,
  narrator: null,
  narrators: [],
  sources: [],
  gradings: [],
  references: [],
  unmapped: {},
});
