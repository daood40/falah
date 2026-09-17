/**
 * Cross-source verification.
 *
 * The stored Quran text is compared against INDEPENDENT datasets that were not
 * used to build it. The goal is to prove agreement, not to "fix" anything: this
 * module never writes to the database and never alters a character. Every
 * difference is reported as a discrepancy for a human to judge.
 *
 * Reference datasets (all read from disk, all with their own licences):
 *   @ghoran/text (MIT)  — Hafs Uthmani, Tanzil simple, Imlaei editions
 *   quran-db (ISC)      — surah metadata, juz and page boundaries, sajdah list
 *   quran-meta (MIT)    — the structure source already used by the importer
 *
 * Orthographies legitimately differ (Uthmani vs Imlaei vs simple), so text is
 * compared at three levels:
 *   exact      — character for character
 *   normalised — diacritics removed, hamza forms unified (search normalisation)
 *   skeleton   — normalised with alef dropped (matches across orthographies)
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeForSearch, searchSkeleton } from '../core/arabic.ts';

const require = createRequire(import.meta.url);

export type AyahRecord = {
  surah: number;
  ayah: number;
  global: number;
  text: string;
};

/**
 * Comparison-only normalisation, deliberately stronger than the search one.
 *
 * Different orthographies write the same word differently: the Uthmani script
 * marks a hamza with a combining sign, the simple script writes it as a letter,
 * the Imlaei files use the Persian ya (U+06CC) and kaf (U+06A9), and long
 * vowels may be written or implied. To decide whether two editions carry the
 * SAME WORDS, all of that is folded away and only the consonant skeleton is
 * compared. This function is used for verification only — it never touches
 * stored data.
 */
export function crossNormalize(text: string): string {
  return (
    text
      // every diacritic, Quranic mark, tatweel and pause sign
      .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08D3-\u08FF]/gu, '')
      // hamza in all of its carriers, and standalone hamza, disappear
      .replace(/[\u0622\u0623\u0625\u0624\u0626\u0671\u0621]/gu, (char) =>
        char === '\u0624' ? '\u0648' : char === '\u0626' ? '\u064A' : '\u0627',
      )
      // Persian/Urdu letter forms → Arabic
      .replace(/\u06CC/gu, '\u064A')
      .replace(/\u06A9/gu, '\u0643')
      .replace(/[\u06D5\u0629]/gu, '\u0647')
      .replace(/\u0649/gu, '\u064A')
      // small high letters that stand for an unwritten consonant
      .replace(/[\u06E5\u06E6]/gu, '')
      // alef is written or implied depending on the orthography
      .replace(/\u0627/gu, '')
      // word boundaries differ between editions (joined vs separated words)
      .replace(/\s+/gu, '')
      .trim()
  );
}

export type TextComparison = {
  reference: string;
  license: string;
  edition: string;
  compared: number;
  exact: number;
  normalized: number;
  skeleton: number;
  /** Consonant skeleton, orthography-independent — the decisive check. */
  letters: number;
  /** Rasm form (long vowels dropped) — classifies leftovers as orthographic. */
  rasm: number;
  /** Ayahs whose letters differ even after normalisation — the ones that matter. */
  letterDifferences: {
    key: string;
    firstDiffIndex: number;
    ours: string;
    theirs: string;
  }[];
};

export type StructureComparison = {
  reference: string;
  check: string;
  compared: number;
  agreed: number;
  differences: string[];
};

/**
 * Resolves a file inside an installed package. Some of these packages publish a
 * restrictive `exports` map, so the node_modules path is walked directly rather
 * than through the resolver.
 */
const packageFile = (packageName: string, relative: string): string => {
  const roots = [
    path.join(process.cwd(), 'node_modules'),
    path.join(import.meta.dirname, '..', '..', 'node_modules'),
  ];
  for (const root of roots) {
    const candidate = path.join(root, packageName, relative);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`cross-source dataset not installed: ${packageName}/${relative}`);
};

/** @ghoran/text ships flat arrays of 6,236 strings in mushaf order. */
export function loadGhoranEdition(file: string): string[] {
  return JSON.parse(
    readFileSync(packageFile('@ghoran/text', `json/${file}`), 'utf8'),
  ) as string[];
}

/** quran-db ships ES modules; the data is read without executing the module. */
function loadQuranDbModule<T>(file: string, exportName: string): T {
  const source = readFileSync(packageFile('quran-db', `utils/${file}`), 'utf8');
  const body = source
    .replace(/^\s*const\s+\w+\s*=/, 'return')
    .replace(/export\s+default\s+\w+;?\s*$/m, '');
  // eslint-disable-next-line no-new-func -- reading a data literal from a data-only file
  const value = new Function(`${body}`)() as T;
  if (value === undefined) throw new Error(`could not read ${exportName} from ${file}`);
  return value;
}

export type QuranDbSurah = {
  id: number;
  name: string;
  aya: number;
  english: string;
  place: string;
  arabic: string;
};

export const loadQuranDbSurahs = (): QuranDbSurah[] =>
  loadQuranDbModule<QuranDbSurah[]>('surah_data.js', 'surah');

export const loadQuranDbJuz = (): { id: number; verses: Record<string, [number, number]> }[] =>
  loadQuranDbModule('juz_data.js', 'juz');

export const loadQuranDbPages = (): { surah: number; start: number; end: number }[][] =>
  loadQuranDbModule('page_data.js', 'pageData');

export const loadQuranDbSajdah = (): Record<string, number> =>
  loadQuranDbModule('sajdah_verses.js', 'sajdahVerses');

export type Qcf4Chapter = {
  id: number;
  name_arabic: string;
  revelation_place: string;
  revelation_order: number;
  verses_count: number;
  bismillah_pre: boolean;
  pages: [number, number];
};

/** quran-qcf4 (MIT JSON) — King Fahd Complex QCF v4 layout, a third reference. */
export const loadQcf4Chapters = (): Qcf4Chapter[] =>
  (JSON.parse(readFileSync(packageFile('quran-qcf4', 'index.json'), 'utf8')) as {
    chapters: Qcf4Chapter[];
  }).chapters;

/** Maps "surah:ayah" → mushaf page in the QCF v4 (Madani) layout. */
export const loadQcf4VersePages = (): Record<string, { page: number }> =>
  JSON.parse(readFileSync(packageFile('quran-qcf4', 'verses.json'), 'utf8')) as Record<
    string,
    { page: number }
  >;

/**
 * Rasm-level form: the consonant skeleton with the long vowels (alef, waw, ya)
 * removed as well. Editions disagree about whether a long vowel is written, so
 * this is the last resort when two orthographies still differ. Lossy by design,
 * used only to classify a difference as orthographic rather than textual.
 */
export function rasmForm(text: string): string {
  return crossNormalize(text).replace(/[\u0648\u064A]/gu, '');
}

/** First index where two strings differ, or -1 when they are identical. */
export function firstDifference(a: string, b: string): number {
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    if (a[index] !== b[index]) return index;
  }
  return a.length === b.length ? -1 : length;
}

/** Codepoints around a difference — never the whole ayah (licence hygiene). */
export function diffWindow(text: string, index: number, radius = 3): string {
  const slice = [...text].slice(Math.max(0, index - radius), index + radius + 1);
  return slice.map((char) => `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`).join(' ');
}

export function compareText(
  ours: AyahRecord[],
  reference: string[],
  meta: { reference: string; license: string; edition: string },
): TextComparison {
  const result: TextComparison = {
    ...meta,
    compared: 0,
    exact: 0,
    normalized: 0,
    skeleton: 0,
    letters: 0,
    rasm: 0,
    letterDifferences: [],
  };

  for (const record of ours) {
    const theirs = reference[record.global - 1];
    if (theirs === undefined) continue;
    result.compared += 1;

    const oursTrimmed = record.text.replace(/\s+/gu, ' ').trim();
    const theirsTrimmed = theirs.replace(/\s+/gu, ' ').trim();
    if (oursTrimmed === theirsTrimmed) result.exact += 1;

    const oursNormalized = normalizeForSearch(record.text);
    const theirsNormalized = normalizeForSearch(theirs);
    if (oursNormalized === theirsNormalized) result.normalized += 1;

    if (searchSkeleton(record.text) === searchSkeleton(theirs)) result.skeleton += 1;

    const oursLetters = crossNormalize(record.text);
    const theirsLetters = crossNormalize(theirs);
    if (rasmForm(record.text) === rasmForm(theirs)) result.rasm += 1;
    if (oursLetters === theirsLetters) {
      result.letters += 1;
    } else if (result.letterDifferences.length < 50) {
      const index = firstDifference(oursLetters, theirsLetters);
      result.letterDifferences.push({
        key: `${record.surah}:${record.ayah}`,
        firstDiffIndex: index,
        ours: diffWindow(oursLetters, Math.max(index, 0)),
        theirs: diffWindow(theirsLetters, Math.max(index, 0)),
      });
    }
  }

  return result;
}
