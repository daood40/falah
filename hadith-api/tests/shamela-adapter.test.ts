import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { jamiKamilShamelaAdapter as adapter } from '../src/importer/adapters/jami_kamil_shamela.ts';

const parsed = adapter.parse(readFileSync('fixtures/shamela-format.txt'), 'fixture.txt');

describe('Shamela text adapter — structure', () => {
  it('reads exactly the bullet records and skips decorative separators', () => {
    expect(parsed.records).toHaveLength(7);
    expect(parsed.warnings.join(' ')).toMatch(/decorative/);
  });

  it('takes volume and page from the [جN صM] markers', () => {
    expect(parsed.records[0]?.volume_number).toBe(1);
    expect(parsed.records[0]?.page_number).toBe(5);
    expect(parsed.records[4]?.volume_number).toBe(2);
    expect(parsed.records[4]?.page_number).toBe(9);
  });

  it('REGRESSION: a page marker inside a hadith moves the cursor for the NEXT record', () => {
    // record #3 starts on page 6 and runs across the [ج1 ص7] marker
    expect(parsed.records[2]?.page_number).toBe(6);
    expect(parsed.records[2]?.raw_text).toContain('يمتدّ');
    expect(parsed.records[2]?.raw_text).toContain('على صفحتين');
    // record #4 comes after that marker, so it belongs to page 7 — the bug this
    // catches made it claim page 6 and every later record drift by a page.
    expect(parsed.records[3]?.page_number).toBe(7);
    expect(parsed.records[3]?.source_locator).toBe('ج1/ص7/#1');
  });

  it('joins a hadith that spans several lines without touching the words', () => {
    expect(parsed.records[2]?.raw_text.split('\n')).toHaveLength(2);
  });

  it('never invents a hadith number, matn or isnad', () => {
    for (const record of parsed.records) {
      expect(record.hadith_number).toBeNull();
      expect(record.matn).toBeNull();
      expect(record.isnad).toBeNull();
    }
  });

  it('gives every record a unique source locator in reading order', () => {
    const locators = parsed.records.map((r) => r.source_locator);
    expect(new Set(locators).size).toBe(locators.length);
    expect(parsed.records.map((r) => r.source_ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(locators[0]).toBe('ج1/ص5/#1');
    expect(locators[1]).toBe('ج1/ص5/#2');
  });
});

describe('Shamela text adapter — headings, grading, narrator', () => {
  it('splits كتاب headings from باب headings, bracketed or not', () => {
    expect(parsed.records[0]?.book?.name).toBe('كتاب الاختبار الأول');
    expect(parsed.records[0]?.chapter?.name).toBe('باب الاختبار الأول');
    expect(parsed.records[2]?.chapter?.name).toBe('باب الاختبار الثاني'); // unbracketed
    expect(parsed.records[4]?.book?.name).toBe('كتاب الاختبار الثاني');
  });

  it('copies the grading label verbatim and keeps the takhrij line', () => {
    expect(parsed.records[0]?.grading).toBe('متفق عليه');
    expect(parsed.records[1]?.grading).toBe('صحيح');
    expect(parsed.records[2]?.grading).toBe('حسن');
    expect(parsed.records[0]?.takhrij).toContain('تخريج اختباريّ أوّل');
    expect(parsed.records[0]?.gradings[0]?.grader).toContain('الأعظمي');
  });

  it('leaves grading and takhrij null when the source states none', () => {
    expect(parsed.records[3]?.grading).toBeNull();
    expect(parsed.records[3]?.takhrij).toBeNull();
    expect(parsed.warnings.join(' ')).toMatch(/no grading line/);
  });

  it('does not let the author commentary leak into the hadith text', () => {
    expect(parsed.records[0]?.raw_text).not.toContain('تعليق المؤلف');
    expect(parsed.records[0]?.raw_text).toBe('نصّ اختباريّ أوّل في سطر واحد — TEST DATA');
  });

  it('copies the narrator verbatim only when the opening matches exactly', () => {
    expect(parsed.records[1]?.narrator?.name).toBe('أبي الاختبار');
    expect(parsed.records[2]?.narrator?.name).toBe('عائشة الاختبارية');
    // the name ends where the source's own particle ends it
    expect(parsed.records[4]?.narrator?.name).toBe('زيد بن اختبار');
    // no «عن …» opening at all
    expect(parsed.records[0]?.narrator).toBeNull();
    // the slice would be longer than any name, so it is refused, not trimmed
    expect(parsed.records[5]?.narrator).toBeNull();
    expect(parsed.records[1]?.narrator?.source_reference).toMatch(/لم يُراجع بشريًا/);
  });
});

// Runs only when the owner-supplied volumes are present (they are git-ignored).
const REAL = 'data/jami-kamil-j01.txt';
describe.runIf(existsSync(REAL))('Shamela adapter against the real volume 1', () => {
  const real = adapter.parse(readFileSync(REAL), 'jami-kamil-j01.txt');

  it('extracts the volume with stable counts', () => {
    expect(real.records.length).toBe(1086);
    expect(real.records.every((r) => r.volume_number === 1)).toBe(true);
    expect(real.records.every((r) => r.raw_text.trim() !== '')).toBe(true);
    expect(real.records.every((r) => r.hadith_number === null)).toBe(true);
  });

  it('starts at the first كتاب of the print (ج1 ص107)', () => {
    expect(real.records[0]?.page_number).toBe(107);
    expect(real.records[0]?.book?.name).toBe('كتاب الوحي');
    expect(real.records[0]?.grading).toBe('متفق عليه');
  });

  it('pages never go backwards inside a volume', () => {
    const pages = real.records.map((r) => r.page_number as number);
    for (let i = 1; i < pages.length; i++) {
      expect((pages[i] as number) >= (pages[i - 1] as number), `record ${i}`).toBe(true);
    }
  });
});

describe('reading order follows the printed numbers', () => {
  it('takes book and chapter order from the heading number, not a file counter', () => {
    // «[٢ - كتاب الاختبار الثاني]» in the fixture's second volume section
    expect(parsed.records[4]?.book?.order_number).toBe(2);
    expect(parsed.records[0]?.book?.order_number).toBe(1);
    expect(parsed.records[2]?.chapter?.order_number).toBe(2);
    expect(parsed.records[2]?.chapter?.chapter_number).toBe('٢');
  });
});

describe('takhrij collections (§13)', () => {
  it('records each collection the takhrij line names, verbatim', () => {
    const cited = parsed.records[6]?.sources.map((s) => s.source_name);
    expect(cited).toEqual(['البخاري', 'مسلم']);
    expect(parsed.records[6]?.sources[0]?.reference).toContain('كتاب الاختبار');
    // the numbers in the line are NOT split per collection — that would be a guess
    expect(parsed.records[6]?.sources[0]?.reference_number).toBeNull();
  });

  it('records nothing when the line names no known collection', () => {
    expect(parsed.records[0]?.sources).toEqual([]);
  });
});
