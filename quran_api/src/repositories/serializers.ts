import type { EditionRow } from './editions.ts';

export type AyahRow = {
  id: string;
  surah_number: number;
  surah_name_ar: string;
  surah_name_en: string | null;
  ayah_number: number;
  global_ayah_number: number;
  juz_number: number | null;
  hizb_number: number | null;
  rub_number: number | null;
  page_number: number | null;
  manzil_number: number | null;
  ruku_number: number | null;
  sajdah: boolean;
  sajdah_type: string | null;
  raw_text: string;
  text_uthmani: string | null;
  text_simple: string | null;
  content_hash: string;
  verified: boolean;
  verification_status: string;
  dataset_version: string | null;
  source_id: string;
  source_name?: string | null;
  source_version?: string | null;
  translation_text?: string | null;
  translation_title?: string | null;
  translation_language?: string | null;
};

export function serializeAyah(row: AyahRow, edition: EditionRow): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: row.id,
    surah: {
      number: row.surah_number,
      name_ar: row.surah_name_ar,
      name_en: row.surah_name_en,
    },
    ayah_number: row.ayah_number,
    ayah_key: `${row.surah_number}:${row.ayah_number}`,
    global_ayah_number: row.global_ayah_number,
    juz: row.juz_number,
    hizb: row.hizb_number,
    rub: row.rub_number,
    page: row.page_number,
    manzil: row.manzil_number,
    ruku: row.ruku_number,
    sajdah: row.sajdah,
    sajdah_type: row.sajdah_type,
    text: row.raw_text,
    text_uthmani: row.text_uthmani,
    text_simple: row.text_simple,
    edition: {
      id: edition.id,
      slug: edition.slug,
      name: edition.name,
      riwayah: edition.riwayah,
      qiraah: edition.qiraah,
    },
    source: {
      id: row.source_id,
      name: row.source_name ?? null,
      version: row.source_version ?? null,
    },
    verification: {
      verified: row.verified,
      status: row.verification_status,
    },
    dataset_version: row.dataset_version,
    content_hash: row.content_hash,
  };
  if (row.translation_text !== undefined && row.translation_text !== null) {
    payload.translation = {
      title: row.translation_title ?? null,
      language: row.translation_language ?? null,
      text: row.translation_text,
    };
  }
  return payload;
}
