/** Quran engine domain types — designed so qira'at, riwayat, reciters,
 * translations and tafsirs can be added later without rebuilding the system. */
import type { SourceMetadata } from '@core/sourcelock/types';

export interface CachedSurah {
  number: number;
  name: string;
  transliteration: string;
  revelation: 'meccan' | 'medinan';
  ayahCount: number;
}

export interface CachedAyah {
  /** `${surah}:${ayah}` */
  key: string;
  surah: number;
  ayah: number;
  /** Uthmani-script Arabic text (Hafs riwayah) — source-locked. */
  text: string;
  translation: string | null;
  translationLang: string;
  /** Filled from the live API when available; null in the bundled dataset. */
  juz: number | null;
  page: number | null;
  hizb: number | null;
  tafsir: string | null;
  source: SourceMetadata;
}

export interface AyahRange {
  surah: number;
  from: number;
  to: number;
}

export interface QuranSearchResult {
  ayah: CachedAyah;
  surahName: string;
}

export interface Reciter {
  id: string;
  nameAr: string;
  nameEn: string;
  /** Edition identifier on cdn.islamic.network. */
  edition: string;
}

export interface Riwayah {
  id: string;
  nameAr: string;
}

/** The bundled dataset is Hafs 'an 'Asim (the Tanzil Uthmani text).
 * Additional riwayat plug in as additional text editions. */
export const RIWAYAT: Riwayah[] = [{ id: 'hafs', nameAr: 'حفص عن عاصم' }];

export const RECITERS: Reciter[] = [
  { id: 'alafasy', nameAr: 'مشاري العفاسي', nameEn: 'Mishary Alafasy', edition: 'ar.alafasy' },
  { id: 'husary', nameAr: 'محمود خليل الحصري', nameEn: 'Mahmoud Al-Husary', edition: 'ar.husary' },
  {
    id: 'abdulbasit',
    nameAr: 'عبد الباسط عبد الصمد',
    nameEn: 'Abdul Basit',
    edition: 'ar.abdulbasitmurattal',
  },
  { id: 'minshawi', nameAr: 'محمد صديق المنشاوي', nameEn: 'Al-Minshawi', edition: 'ar.minshawi' },
];

/** Source metadata for the bundled Tanzil Uthmani text. */
export const TANZIL_SOURCE: SourceMetadata = {
  source_id: 'tanzil-uthmani',
  source_name: 'Tanzil Project — Quran Uthmani (via quran-json)',
  source_url: 'https://tanzil.net',
  source_version: 'quran-json@3.1.2',
  verified_at: '2021-10-01T00:00:00.000Z',
  review_status: 'verified',
};

export const SAHIH_INTL_SOURCE: SourceMetadata = {
  source_id: 'en-sahih-international',
  source_name: 'Sahih International translation (via quran-json)',
  source_url: 'https://tanzil.net/trans/',
  source_version: 'quran-json@3.1.2',
  verified_at: '2021-10-01T00:00:00.000Z',
  review_status: 'verified',
};
