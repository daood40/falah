/**
 * Quran repository — offline-first.
 * Base dataset: quran-json (Tanzil Uthmani text + Sahih International translation),
 * code-split per surah and cached in IndexedDB. The live API (alquran.cloud) enriches
 * ayahs with juz/page/tafsir and more editions when the network allows.
 */
import { db } from '@core/db/localdb';
import { toAppError } from '@core/errors/errors';
import surahIndex from 'quran-json/dist/chapters/en/index.json';
import type {
  AyahRange,
  CachedAyah,
  CachedSurah,
  QuranSearchResult,
  Reciter,
} from '../domain/types';
import { SAHIH_INTL_SOURCE, TANZIL_SOURCE } from '../domain/types';
import { normalizeArabic, parseAyahReference } from '../domain/arabic';

interface BundledSurahIndexEntry {
  id: number;
  name: string;
  transliteration: string;
  type: string;
  total_verses: number;
}

interface BundledVerse {
  id: number;
  text: string;
  translation?: string;
}

interface BundledChapter extends BundledSurahIndexEntry {
  verses: BundledVerse[];
}

/** Lazy per-surah chunks — Vite code-splits each chapter JSON. */
const chapterModules = import.meta.glob<BundledChapter>(
  '/node_modules/quran-json/dist/chapters/en/[0-9]*.json',
  { import: 'default' },
);

function chapterLoader(surah: number): (() => Promise<BundledChapter>) | null {
  const path = `/node_modules/quran-json/dist/chapters/en/${surah}.json`;
  return chapterModules[path] ?? null;
}

export function listSurahs(): CachedSurah[] {
  return (surahIndex as BundledSurahIndexEntry[]).map((s) => ({
    number: s.id,
    name: s.name,
    transliteration: s.transliteration,
    revelation: s.type === 'meccan' ? 'meccan' : 'medinan',
    ayahCount: s.total_verses,
  }));
}

const SURAHS = listSurahs();

export function surahByNumber(n: number): CachedSurah | null {
  return SURAHS.find((s) => s.number === n) ?? null;
}

function toCachedAyah(surah: number, verse: BundledVerse): CachedAyah {
  return {
    key: `${surah}:${verse.id}`,
    surah,
    ayah: verse.id,
    text: verse.text,
    translation: verse.translation ?? null,
    translationLang: 'en',
    juz: null,
    page: null,
    hizb: null,
    tafsir: null,
    source: TANZIL_SOURCE,
  };
}

/** Load (and cache) all ayahs of one surah. */
export async function getSurahAyahs(surah: number): Promise<CachedAyah[]> {
  const cached = await db.quranAyahs.where('surah').equals(surah).toArray();
  const meta = surahByNumber(surah);
  if (meta && cached.length === meta.ayahCount) {
    return cached.sort((a, b) => a.ayah - b.ayah);
  }
  const loader = chapterLoader(surah);
  if (!loader) throw toAppError(new Error(`Surah ${surah} not found`), 'validation');
  try {
    const chapter = await loader();
    const ayahs = chapter.verses.map((v) => toCachedAyah(surah, v));
    await db.quranAyahs.bulkPut(ayahs);
    return ayahs;
  } catch (error) {
    throw toAppError(error, 'storage');
  }
}

export async function getAyah(surah: number, ayah: number): Promise<CachedAyah | null> {
  const ayahs = await getSurahAyahs(surah);
  return ayahs.find((a) => a.ayah === ayah) ?? null;
}

export async function getAyahRange(range: AyahRange): Promise<CachedAyah[]> {
  const ayahs = await getSurahAyahs(range.surah);
  return ayahs.filter((a) => a.ayah >= range.from && a.ayah <= range.to);
}

/**
 * Search the whole Quran. A reference query ("2:255") resolves directly;
 * otherwise a normalized Arabic/translation substring search runs over all surahs
 * (chapters load lazily and are cached after the first search).
 */
export async function searchQuran(query: string, limit = 30): Promise<QuranSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const ref = parseAyahReference(trimmed);
  if (ref) {
    const meta = surahByNumber(ref.surah);
    if (!meta || ref.ayah > meta.ayahCount) return [];
    const ayah = await getAyah(ref.surah, ref.ayah);
    return ayah ? [{ ayah, surahName: meta.name }] : [];
  }

  // Surah-name match → return the surah opening ayahs.
  const normQuery = normalizeArabic(trimmed);
  const results: QuranSearchResult[] = [];
  const nameMatch = SURAHS.find(
    (s) =>
      normalizeArabic(s.name) === normQuery ||
      s.transliteration.toLowerCase() === trimmed.toLowerCase(),
  );
  if (nameMatch) {
    const ayahs = await getSurahAyahs(nameMatch.number);
    for (const ayah of ayahs.slice(0, limit)) {
      results.push({ ayah, surahName: nameMatch.name });
    }
    return results;
  }

  if (normQuery.length < 3) return [];
  const lowerQuery = trimmed.toLowerCase();
  for (const surah of SURAHS) {
    const ayahs = await getSurahAyahs(surah.number);
    for (const ayah of ayahs) {
      const matchesArabic = normalizeArabic(ayah.text).includes(normQuery);
      const matchesTranslation =
        ayah.translation !== null && ayah.translation.toLowerCase().includes(lowerQuery);
      if (matchesArabic || matchesTranslation) {
        results.push({ ayah, surahName: surah.name });
        if (results.length >= limit) return results;
      }
    }
  }
  return results;
}

/** Translation source metadata (per-language registry, extensible). */
export function translationSource(): typeof SAHIH_INTL_SOURCE {
  return SAHIH_INTL_SOURCE;
}

/* ---------------- Audio ---------------- */

/** Cumulative ayah offsets to map (surah, ayah) → global ayah number (1..6236). */
const CUMULATIVE: number[] = (() => {
  const offsets: number[] = [0];
  for (const s of SURAHS) offsets.push(offsets[offsets.length - 1]! + s.ayahCount);
  return offsets;
})();

export function globalAyahNumber(surah: number, ayah: number): number {
  return (CUMULATIVE[surah - 1] ?? 0) + ayah;
}

/** Public CDN recitation audio (per-ayah MP3, streamed at play time). */
export function ayahAudioUrl(reciter: Reciter, surah: number, ayah: number): string {
  return `https://cdn.islamic.network/quran/audio/128/${reciter.edition}/${globalAyahNumber(surah, ayah)}.mp3`;
}
