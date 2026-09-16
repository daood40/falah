import * as hafs from 'quran-meta/hafs';
import { contentHash } from '../core/hash.ts';
import type { ParsedDataset } from './parse.ts';

export type ValidationIssue = { check: string; severity: 'error' | 'warning'; message: string };

const ARABIC_LETTER = /[ء-ي]/u;
/** Characters legitimately present in Uthmani script: letters, marks, spaces. */
const ALLOWED = /^[؀-ۿݐ-ݿࢠ-ࣿﷰ-﷿\s]+$/u;

/**
 * Integrity checks run before anything is written. Counts are cross-checked
 * between the two independent datasets (text vs mushaf structure) rather than
 * against hardcoded numbers.
 */
export function validateDataset(dataset: ParsedDataset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const error = (check: string, message: string): void => {
    issues.push({ check, severity: 'error', message });
  };
  const warn = (check: string, message: string): void => {
    issues.push({ check, severity: 'warning', message });
  };

  // --- Surahs ---
  const surahNumbers = dataset.surahs.map((s) => s.surah_number);
  if (new Set(surahNumbers).size !== surahNumbers.length) {
    error('surah.duplicates', 'duplicate surah numbers in source dataset');
  }
  surahNumbers.forEach((number, position) => {
    if (number !== position + 1) {
      error('surah.order', `surah at position ${position + 1} has number ${number}`);
    }
  });
  const revelationOrders = dataset.surahs.map((s) => s.revelation_order);
  if (new Set(revelationOrders).size !== revelationOrders.length) {
    error('surah.revelation_order', 'revelation order is not unique');
  }

  // --- Ayah counts cross-checked against the structural dataset ---
  for (const surah of dataset.surahs) {
    const metaCount = (hafs.SurahList[surah.surah_number] as unknown as number[])[1];
    if (metaCount !== surah.ayah_count) {
      error(
        'ayah.count_mismatch',
        `surah ${surah.surah_number}: text dataset says ${surah.ayah_count}, structure dataset says ${metaCount}`,
      );
    }
    const actual = dataset.ayahs.filter((a) => a.surah_number === surah.surah_number).length;
    if (actual !== surah.ayah_count) {
      error(
        'ayah.count_actual',
        `surah ${surah.surah_number}: declared ${surah.ayah_count} ayahs, parsed ${actual}`,
      );
    }
  }

  // --- Ayah sequence / duplicates / gaps ---
  const seen = new Set<string>();
  let expectedGlobal = 1;
  for (const ayah of dataset.ayahs) {
    const key = `${ayah.surah_number}:${ayah.ayah_number}`;
    if (seen.has(key)) error('ayah.duplicate', `duplicate ayah ${key}`);
    seen.add(key);
    if (ayah.global_ayah_number !== expectedGlobal) {
      error(
        'ayah.global_sequence',
        `ayah ${key} has global number ${ayah.global_ayah_number}, expected ${expectedGlobal}`,
      );
    }
    expectedGlobal += 1;

    if (ayah.raw_text.trim().length === 0) error('ayah.empty', `ayah ${key} has empty text`);
    if (!ARABIC_LETTER.test(ayah.raw_text)) {
      error('ayah.arabic', `ayah ${key} contains no Arabic letters`);
    }
    if (!ALLOWED.test(ayah.raw_text)) {
      warn('ayah.charset', `ayah ${key} contains characters outside the Arabic Unicode blocks`);
    }
    if (ayah.content_hash !== contentHash(ayah.raw_text)) {
      error('ayah.hash', `ayah ${key} hash does not match its text`);
    }
    if (ayah.search_text.length === 0) error('ayah.search_text', `ayah ${key} has empty search text`);
    for (const [field, value] of [
      ['juz_number', ayah.juz_number],
      ['hizb_number', ayah.hizb_number],
      ['rub_number', ayah.rub_number],
      ['page_number', ayah.page_number],
      ['manzil_number', ayah.manzil_number],
    ] as const) {
      if (!Number.isInteger(value) || value < 1) {
        error('ayah.structure', `ayah ${key} has invalid ${field}: ${String(value)}`);
      }
    }
  }

  // --- Divisions cover the whole mushaf without gaps ---
  const coverage = (name: string, list: { start_global_ayah: number; end_global_ayah: number }[]): void => {
    if (list.length === 0) {
      error(`${name}.empty`, `${name} list is empty`);
      return;
    }
    const sorted = [...list].sort((a, b) => a.start_global_ayah - b.start_global_ayah);
    if (sorted[0]!.start_global_ayah !== 1) {
      error(`${name}.start`, `${name} does not start at the first ayah`);
    }
    if (sorted.at(-1)!.end_global_ayah !== dataset.ayahs.length) {
      error(`${name}.end`, `${name} does not end at ayah ${dataset.ayahs.length}`);
    }
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i]!.start_global_ayah !== sorted[i - 1]!.end_global_ayah + 1) {
        error(`${name}.gap`, `${name} has a gap before entry ${i + 1}`);
      }
    }
  };
  coverage('juz', dataset.juzs);
  coverage('rub', dataset.rubs);
  coverage('page', dataset.pages);
  coverage('manzil', dataset.manzils);

  // --- Ayah ↔ division consistency ---
  for (const juz of dataset.juzs) {
    for (const ayah of dataset.ayahs.slice(juz.start_global_ayah - 1, juz.end_global_ayah)) {
      if (ayah.juz_number !== juz.number) {
        error(
          'juz.mapping',
          `ayah ${ayah.surah_number}:${ayah.ayah_number} says juz ${ayah.juz_number}, boundary says ${juz.number}`,
        );
        break;
      }
    }
  }
  for (const page of dataset.pages) {
    const first = dataset.ayahs[page.start_global_ayah - 1];
    if (first && first.page_number !== page.number) {
      error('page.mapping', `page ${page.number} boundary does not match ayah page numbers`);
      break;
    }
  }

  // --- Translations ---
  for (const translation of dataset.translations) {
    if (translation.entries.length !== dataset.ayahs.length) {
      warn(
        'translation.coverage',
        `${translation.slug}: ${translation.entries.length} of ${dataset.ayahs.length} ayahs translated`,
      );
    }
    const translationKeys = new Set(translation.entries.map((e) => `${e.surah_number}:${e.ayah_number}`));
    if (translationKeys.size !== translation.entries.length) {
      error('translation.duplicate', `${translation.slug} contains duplicate ayah references`);
    }
    for (const entry of translation.entries) {
      if (!seen.has(`${entry.surah_number}:${entry.ayah_number}`)) {
        error(
          'translation.mapping',
          `${translation.slug} references unknown ayah ${entry.surah_number}:${entry.ayah_number}`,
        );
        break;
      }
    }
  }

  return issues;
}

export const hasErrors = (issues: ValidationIssue[]): boolean =>
  issues.some((issue) => issue.severity === 'error');
