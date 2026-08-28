/**
 * sunnah.com API integration (live hadith collections: Bukhari, Muslim, …).
 * Requires VITE_SUNNAH_API_KEY (request at https://sunnah.api-docs.io).
 * Without a key this module reports itself unavailable and FALAH uses the
 * bundled verified dataset only — it never fakes results.
 */
import { env, hasSunnahApi } from '@core/config/env';
import { AppError, toAppError } from '@core/errors/errors';
import { normalizeArabic } from '@features/quran/domain/arabic';
import type { HadithRecord } from '../domain/types';

const BASE = 'https://api.sunnah.com/v1';

interface SunnahApiHadith {
  collection: string;
  hadithNumber: string;
  hadith: Array<{
    lang: string;
    chapterTitle?: string;
    body: string;
    grades?: Array<{ graded_by: string; grade: string }>;
  }>;
}

export function sunnahApiAvailable(): boolean {
  return hasSunnahApi();
}

async function apiGet<T>(path: string): Promise<T> {
  if (!hasSunnahApi()) {
    throw new AppError('not_configured', 'sunnah.com API key missing (VITE_SUNNAH_API_KEY)');
  }
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'x-api-key': env.sunnahApiKey, Accept: 'application/json' },
  });
  if (!response.ok) {
    throw toAppError(new Error(`sunnah.com API ${response.status} for ${path}`), 'network');
  }
  return (await response.json()) as T;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fetch one hadith from a live collection with full source + grade metadata. */
export async function fetchHadith(collection: string, number: number): Promise<HadithRecord> {
  const data = await apiGet<SunnahApiHadith>(`/collections/${collection}/hadiths/${number}`);
  const arabicEntry = data.hadith.find((h) => h.lang === 'ar');
  const englishEntry = data.hadith.find((h) => h.lang === 'en');
  if (!arabicEntry) {
    throw new AppError('validation', `No Arabic text for ${collection}:${number}`);
  }
  const arabic = stripHtml(arabicEntry.body);
  const grades = englishEntry?.grades ?? arabicEntry.grades ?? [];
  const firstGrade = grades[0];
  return {
    id: `${collection}_${number}`,
    collection_id: collection,
    number,
    arabic,
    english: englishEntry ? stripHtml(englishEntry.body) : null,
    narrator: null,
    book: collection,
    chapter: englishEntry?.chapterTitle ?? arabicEntry.chapterTitle ?? null,
    grade: firstGrade?.grade ?? null,
    grade_source: firstGrade?.graded_by ?? null,
    explanation: null,
    source: {
      source_id: `sunnah-${collection}`,
      source_name: `sunnah.com — ${collection}`,
      source_url: `https://sunnah.com/${collection}:${number}`,
      source_version: 'api-v1',
      verified_at: new Date().toISOString(),
      review_status: 'verified',
    },
    searchTerms: normalizeArabic(arabic)
      .split(' ')
      .filter((w) => w.length >= 3),
  };
}
