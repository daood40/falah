import { describe, expect, it } from 'vitest';
import { parseDataset } from '../src/import/parse.ts';
import { hasErrors, validateDataset } from '../src/import/validate.ts';
import { contentHash } from '../src/core/hash.ts';

const dataset = parseDataset(['en']);

describe('source dataset parsing', () => {
  it('produces the complete mushaf structure from the source packages', () => {
    expect(dataset.surahs).toHaveLength(114);
    expect(dataset.ayahs).toHaveLength(6236);
    expect(dataset.juzs).toHaveLength(30);
    expect(dataset.rubs).toHaveLength(240);
    expect(dataset.pages).toHaveLength(604);
    expect(dataset.manzils).toHaveLength(7);
    expect(dataset.ayahs.filter((a) => a.sajdah)).toHaveLength(15);
  });

  it('never invents data the source does not carry', () => {
    expect(dataset.surahs.every((s) => s.bismillah === null)).toBe(true);
    expect(dataset.ayahs.every((a) => a.sajdah_type === null)).toBe(true);
    expect(dataset.ayahs.every((a) => a.text_simple === null)).toBe(true);
  });

  it('keeps raw text verbatim and derives search text separately', () => {
    const first = dataset.ayahs[0]!;
    expect(first.raw_text).toContain('ۡ');
    expect(first.search_text).not.toContain('ۡ');
    expect(first.content_hash).toBe(contentHash(first.raw_text));
  });

  it('numbers ayahs globally without gaps', () => {
    dataset.ayahs.forEach((ayah, index) => {
      expect(ayah.global_ayah_number).toBe(index + 1);
    });
  });
});

describe('dataset validation', () => {
  it('passes on the real dataset', () => {
    const issues = validateDataset(dataset);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('detects a duplicated ayah', () => {
    const broken = { ...dataset, ayahs: [...dataset.ayahs] };
    broken.ayahs[5] = { ...broken.ayahs[4]!, global_ayah_number: 6 };
    expect(hasErrors(validateDataset(broken))).toBe(true);
  });

  it('detects a missing ayah (count mismatch)', () => {
    const broken = { ...dataset, ayahs: dataset.ayahs.filter((a) => a.global_ayah_number !== 3) };
    const issues = validateDataset(broken);
    expect(issues.some((i) => i.check === 'ayah.count_actual')).toBe(true);
  });

  it('detects a tampered text / hash mismatch', () => {
    const broken = { ...dataset, ayahs: [...dataset.ayahs] };
    broken.ayahs[0] = { ...broken.ayahs[0]!, raw_text: `${broken.ayahs[0]!.raw_text}x` };
    const issues = validateDataset(broken);
    expect(issues.some((i) => i.check === 'ayah.hash')).toBe(true);
  });

  it('detects a broken translation mapping', () => {
    const broken = {
      ...dataset,
      translations: [
        {
          ...dataset.translations[0]!,
          entries: [
            ...dataset.translations[0]!.entries,
            { surah_number: 115, ayah_number: 1, text: 'x', content_hash: contentHash('x') },
          ],
        },
      ],
    };
    const issues = validateDataset(broken);
    expect(issues.some((i) => i.check === 'translation.mapping')).toBe(true);
  });
});
