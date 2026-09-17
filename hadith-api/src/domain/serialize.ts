import { config } from '../config.ts';

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
  book_id: string | null;
  book_name: string | null;
  chapter_id: string | null;
  chapter_name: string | null;
  narrator_id: string | null;
  narrator_name: string | null;
  source_name: string | null;
  edition_title: string | null;
  edition_publisher: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface Ref {
  id: string;
  name: string;
}

function ref(id: string | null, name: string | null): Ref | null {
  return id ? { id, name: name ?? '' } : null;
}

/**
 * §3 — the full text is withheld from the public API until the content
 * licence is confirmed. Admin principals keep internal read access.
 */
export function textVisible(isAdmin: boolean): boolean {
  return config.contentLicenseConfirmed || isAdmin;
}

export function serializeHadith(row: HadithRow, isAdmin = false): Record<string, unknown> {
  const visible = textVisible(isAdmin);
  return {
    id: row.id,
    hadith_number: row.hadith_number,
    book: ref(row.book_id, row.book_name),
    chapter: ref(row.chapter_id, row.chapter_name),
    narrator: ref(row.narrator_id, row.narrator_name),
    isnad: visible ? row.isnad : null,
    matn: visible ? row.matn : null,
    raw_text: visible ? row.raw_text : null,
    takhrij: visible ? row.takhrij : null,
    grading: row.grading,
    volume: row.volume_number,
    page: row.page_number,
    original_reference: row.original_reference,
    original_hadith_number: row.original_hadith_number,
    source: {
      name: row.source_name,
      edition: row.edition_title,
      publisher: row.edition_publisher,
    },
    verification: {
      verified: row.verified,
      status: row.verification_status,
    },
    source_locked: row.source_locked,
    content_hash: row.content_hash,
    dataset_version: row.dataset_version,
    text_available: visible,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
