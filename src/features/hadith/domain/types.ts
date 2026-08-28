/** Hadith engine domain types. */
import type { SourceMetadata } from '@core/sourcelock/types';

export interface HadithCollection {
  id: string;
  nameAr: string;
  nameEn: string;
  compiler: string;
  source_url: string;
}

export interface HadithRecord {
  id: string;
  collection_id: string;
  /** Number within the collection. */
  number: number;
  arabic: string;
  english: string | null;
  narrator: string | null;
  book: string | null;
  chapter: string | null;
  /**
   * Authenticity grade (e.g. صحيح / حسن). ONLY ever set from a documented
   * grading source — never inferred or invented. Null = not graded in our data,
   * displayed as "see source" rather than any claim.
   */
  grade: string | null;
  grade_source: string | null;
  explanation: string | null;
  source: SourceMetadata;
  /** Normalized tokens for offline search (never displayed). */
  searchTerms: string[];
}

export const NAWAWI40_COLLECTION: HadithCollection = {
  id: 'nawawi40',
  nameAr: 'الأربعون النووية',
  nameEn: "Al-Arba'in An-Nawawiyyah (Nawawi's 40)",
  compiler: 'الإمام يحيى بن شرف النووي',
  source_url: 'https://sunnah.com/nawawi40',
};

export const NAWAWI40_SOURCE: SourceMetadata = {
  source_id: 'nawawi40',
  source_name: "الأربعون النووية — Nawawi's 40 Hadith",
  source_url: 'https://sunnah.com/nawawi40',
  source_version: '@kazishariar/nawawi-40-hadith-data@1.0.3',
  verified_at: '2024-01-01T00:00:00.000Z',
  review_status: 'verified',
};
