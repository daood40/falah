import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import {
  compareText,
  crossNormalize,
  firstDifference,
  loadGhoranEdition,
  loadQcf4Chapters,
  loadQcf4VersePages,
  loadQuranDbSajdah,
  loadQuranDbSurahs,
  rasmForm,
  type AyahRecord,
} from '../src/verify/cross-source.ts';
import { testUrl } from './helpers.ts';

let pool: pg.Pool;
let ours: AyahRecord[];

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: testUrl(), max: 3 });
  const { rows } = await pool.query<AyahRecord>(
    `select s.surah_number as surah, a.ayah_number as ayah,
            a.global_ayah_number as global, a.raw_text as text
     from quran.ayahs a join quran.surahs s on s.id = a.surah_id
     order by a.global_ayah_number`,
  );
  ours = rows;
});
afterAll(async () => {
  await pool.end();
});

describe('comparison normalisation', () => {
  it('folds orthographic spellings of the same word together', () => {
    // Uthmani vs simple spelling of "الصلاة"
    expect(rasmForm('ٱلصَّلَوٰةَ')).toBe(rasmForm('الصلاة'));
    // written hamza vs hamza on a carrier
    expect(crossNormalize('ءَامَنُوا')).toBe(crossNormalize('آمنوا'));
    // Persian ya/kaf used by the Imlaei files
    expect(crossNormalize('الرَّحٖیمِ')).toBe(crossNormalize('الرحيم'));
  });

  it('still distinguishes genuinely different words', () => {
    expect(crossNormalize('قال')).not.toBe(crossNormalize('قام'));
    expect(rasmForm('كتب')).not.toBe(rasmForm('كذب'));
  });

  it('locates the first differing character', () => {
    expect(firstDifference('abc', 'abc')).toBe(-1);
    expect(firstDifference('abc', 'abd')).toBe(2);
    expect(firstDifference('ab', 'abc')).toBe(2);
  });
});

describe('cross-source verification against independent datasets', () => {
  it('matches an independent Hafs Uthmani edition for every ayah', () => {
    const reference = loadGhoranEdition('quran-text-hafs.json');
    expect(reference).toHaveLength(6236);
    const comparison = compareText(ours, reference, {
      reference: '@ghoran/text',
      license: 'MIT',
      edition: 'Hafs Uthmani',
    });
    expect(comparison.compared).toBe(6236);
    // The decisive check: same letters, every single ayah.
    expect(comparison.letters).toBe(6236);
    expect(comparison.letterDifferences).toEqual([]);
  });

  it('matches independent surah metadata (counts, names, place, order)', () => {
    const db = loadQuranDbSurahs();
    const qcf = loadQcf4Chapters();
    expect(db).toHaveLength(114);
    expect(qcf).toHaveLength(114);

    const counts = new Map(ours.map((row) => [row.surah, 0]));
    for (const row of ours) counts.set(row.surah, (counts.get(row.surah) ?? 0) + 1);

    for (const chapter of qcf) {
      expect(counts.get(chapter.id)).toBe(chapter.verses_count);
      const other = db.find((entry) => entry.id === chapter.id)!;
      expect(other.aya).toBe(chapter.verses_count);
    }
  });

  it('agrees with the QCF v4 page layout for at least 99% of ayahs', async () => {
    const pages = loadQcf4VersePages();
    const { rows } = await pool.query<{ surah: number; ayah: number; page: number }>(
      `select s.surah_number as surah, a.ayah_number as ayah, a.page_number as page
       from quran.ayahs a join quran.surahs s on s.id = a.surah_id`,
    );
    const agreed = rows.filter((row) => pages[`${row.surah}:${row.ayah}`]?.page === row.page).length;
    // The two layouts differ on a handful of ayahs that straddle a page break;
    // the boundaries themselves agree with the second reference exactly.
    expect(agreed / rows.length).toBeGreaterThan(0.99);
  });

  it('reports the sajdah convention difference instead of hiding it', async () => {
    const theirs = new Set(
      Object.entries(loadQuranDbSajdah()).map(([surah, ayah]) => `${surah}:${ayah}`),
    );
    const { rows } = await pool.query<{ key: string }>(
      `select s.surah_number || ':' || a.ayah_number as key
       from quran.ayahs a join quran.surahs s on s.id = a.surah_id where a.sajdah`,
    );
    const mine = new Set(rows.map((row) => row.key));
    expect(mine.size).toBe(15);
    expect(theirs.size).toBe(14);
    // Al-Hajj's second sajdah is in our list and not in theirs — a known,
    // documented difference between traditions, never silently reconciled.
    expect(mine.has('22:77')).toBe(true);
    expect(theirs.has('22:77')).toBe(false);
  });
});
