/**
 * Hadith repository — offline-first.
 * Bundled verified dataset: Nawawi's 40 (Arabic + English + narrator).
 * The sunnah.com API integration (requires VITE_SUNNAH_API_KEY) plugs in as an
 * additional collection provider without changing this interface.
 */
import { db } from '@core/db/localdb';
import { toAppError } from '@core/errors/errors';
import { normalizeArabic } from '@features/quran/domain/arabic';
import nawawiData from '@kazishariar/nawawi-40-hadith-data/data';
import type { HadithCollection, HadithRecord } from '../domain/types';
import { NAWAWI40_COLLECTION, NAWAWI40_SOURCE } from '../domain/types';

interface NawawiEntry {
  id: string;
  arabic: string;
  english: string;
  narrator: string;
}

interface NawawiFile {
  meta: { title: string; count: number };
  data: NawawiEntry[];
}

function buildSearchTerms(arabic: string, english: string | null): string[] {
  const terms = new Set<string>();
  for (const word of normalizeArabic(arabic).split(' ')) {
    if (word.length >= 3) terms.add(word);
  }
  if (english) {
    for (const word of english.toLowerCase().split(/\W+/)) {
      if (word.length >= 4) terms.add(word);
    }
  }
  return [...terms];
}

function fromNawawi(entry: NawawiEntry, index: number): HadithRecord {
  return {
    id: entry.id,
    collection_id: NAWAWI40_COLLECTION.id,
    number: index + 1,
    arabic: entry.arabic,
    english: entry.english?.trim() || null,
    narrator: entry.narrator?.trim() || null,
    book: NAWAWI40_COLLECTION.nameAr,
    chapter: null,
    // Nawawi's 40 as a collection is authenticated; we still do not assert a
    // per-hadith grade we don't have data for (Source Lock: no invented grades).
    grade: null,
    grade_source: null,
    explanation: null,
    source: NAWAWI40_SOURCE,
    searchTerms: buildSearchTerms(entry.arabic, entry.english),
  };
}

let seeded = false;

/** Seed the local DB from the bundled dataset (idempotent). */
export async function ensureHadithSeed(): Promise<void> {
  if (seeded) return;
  try {
    const count = await db.hadiths.where('collection_id').equals(NAWAWI40_COLLECTION.id).count();
    const file = nawawiData as unknown as NawawiFile;
    if (count < file.data.length) {
      await db.hadiths.bulkPut(file.data.map(fromNawawi));
    }
    seeded = true;
  } catch (error) {
    throw toAppError(error, 'storage');
  }
}

export function listCollections(): HadithCollection[] {
  return [NAWAWI40_COLLECTION];
}

export async function listHadiths(collectionId?: string): Promise<HadithRecord[]> {
  await ensureHadithSeed();
  const query = collectionId
    ? db.hadiths.where('collection_id').equals(collectionId)
    : db.hadiths.toCollection();
  const all = await query.toArray();
  return all.sort((a, b) => a.number - b.number);
}

export async function getHadith(id: string): Promise<HadithRecord | null> {
  await ensureHadithSeed();
  return (await db.hadiths.get(id)) ?? null;
}

export async function searchHadiths(query: string, limit = 30): Promise<HadithRecord[]> {
  await ensureHadithSeed();
  const trimmed = query.trim();
  if (trimmed.length === 0) return listHadiths();

  const asNumber = Number(trimmed);
  if (Number.isInteger(asNumber) && asNumber > 0) {
    const all = await listHadiths();
    return all.filter((h) => h.number === asNumber);
  }

  const normArabic = normalizeArabic(trimmed);
  const lower = trimmed.toLowerCase();
  const all = await listHadiths();
  return all
    .filter(
      (h) =>
        normalizeArabic(h.arabic).includes(normArabic) ||
        (h.english !== null && h.english.toLowerCase().includes(lower)) ||
        (h.narrator !== null && h.narrator.toLowerCase().includes(lower)),
    )
    .slice(0, limit);
}
