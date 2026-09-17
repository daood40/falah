import { config } from '../config.ts';

/**
 * Row shape the hadith queries select. Fields the client never sees directly
 * (edition ids, locator) are kept here because the responses derive from them.
 */
export interface HadithRow {
  id: string;
  hadith_number: string | null;
  volume_number: number | null;
  page_number: number | null;
  raw_text: string | null;
  matn: string | null;
  isnad: string | null;
  takhrij: string | null;
  grading: string | null;
  original_reference: string | null;
  original_hadith_number: string | null;
  source_locked: boolean;
  verified: boolean;
  verification_status: string;
  content_hash: string;
  dataset_version: string;
  dataset_hash?: string | null;
  source_locator?: string | null;
  book_id: string | null;
  book_name: string | null;
  chapter_id: string | null;
  chapter_name: string | null;
  narrator_id: string | null;
  narrator_name: string | null;
  source_id: string | null;
  source_name: string | null;
  edition_id?: string | null;
  edition_title: string | null;
  edition_publisher: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * §3 — the licence gate. While the content licence is unconfirmed the public
 * API withholds the text itself; an admin credential still reads it internally.
 */
export function textVisible(isAdmin: boolean): boolean {
  return config.contentLicenseConfirmed || isAdmin;
}

/**
 * List shape: the few fields a list screen needs, with ids instead of nested
 * objects so a page of 20 stays small.
 */
export function serializeHadithListItem(row: HadithRow, isAdmin = false): Record<string, unknown> {
  const visible = textVisible(isAdmin);
  return {
    id: row.id,
    number: row.hadith_number,
    text: visible ? row.raw_text : null,
    text_available: visible,
    book_id: row.book_id,
    chapter_id: row.chapter_id,
    source_id: row.source_id,
    volume: row.volume_number,
    page: row.page_number,
    dataset_version: row.dataset_version,
    content_hash: row.content_hash,
    verification_status: row.verification_status,
  };
}

/** §13 — the standard detail response Falah builds its screens on. */
export function serializeHadith(
  row: HadithRow,
  isAdmin = false,
  includes: Record<string, unknown> = {},
): Record<string, unknown> {
  const visible = textVisible(isAdmin);
  return {
    id: row.id,
    number: row.hadith_number,
    text: visible ? row.raw_text : null,
    text_available: visible,

    source: row.source_id ? { id: row.source_id, name: row.source_name } : null,
    book: row.book_id ? { id: row.book_id, name: row.book_name } : null,
    chapter: row.chapter_id ? { id: row.chapter_id, title: row.chapter_name } : null,

    location: {
      volume: row.volume_number,
      page: row.page_number,
      locator: row.source_locator ?? null,
    },

    dataset: {
      version: row.dataset_version,
      hash: row.content_hash,
      dataset_hash: row.dataset_hash ?? null,
    },

    verification: { verified: row.verified, status: row.verification_status },
    source_locked: row.source_locked,

    ...includes,
  };
}

/** Sub-resource shapes — one place, so the routes and the ?include= agree. */
export function serializeTakhrij(
  row: HadithRow,
  sources: { source_name: string; reference: string | null; reference_number: string | null }[],
  isAdmin = false,
): Record<string, unknown> {
  const visible = textVisible(isAdmin);
  return {
    hadith_id: row.id,
    takhrij_text: visible ? row.takhrij : null,
    text_available: visible,
    sources: sources.map((s) => s.source_name),
    references: sources.map((s) => ({
      source: s.source_name,
      reference: visible ? s.reference : null,
      reference_number: s.reference_number,
    })),
    dataset_version: row.dataset_version,
  };
}
