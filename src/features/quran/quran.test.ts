/** Quran engine: verified data, reference parsing, search, audio mapping. */
import { describe, expect, it } from 'vitest';
import { normalizeArabic, parseAyahReference } from './domain/arabic';
import {
  getAyah,
  getSurahAyahs,
  globalAyahNumber,
  listSurahs,
  searchQuran,
  surahByNumber,
} from './data/quranRepository';

describe('arabic utilities', () => {
  it('strips diacritics and unifies letter forms', () => {
    expect(normalizeArabic('بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ')).toBe(
      'بسم الله الرحمن الرحيم',
    );
  });

  it('parses ayah references incl. Arabic-Indic digits', () => {
    expect(parseAyahReference('2:255')).toEqual({ surah: 2, ayah: 255 });
    expect(parseAyahReference('٢:٢٥٥')).toEqual({ surah: 2, ayah: 255 });
    expect(parseAyahReference('1 7')).toEqual({ surah: 1, ayah: 7 });
    expect(parseAyahReference('115:1')).toBeNull();
    expect(parseAyahReference('الرحمن')).toBeNull();
  });
});

describe('quran repository (bundled Tanzil dataset)', () => {
  it('lists all 114 surahs with correct metadata', () => {
    const surahs = listSurahs();
    expect(surahs).toHaveLength(114);
    expect(surahs[0]).toMatchObject({ number: 1, name: 'الفاتحة', ayahCount: 7 });
    expect(surahByNumber(112)?.name).toBe('الإخلاص');
  });

  it('loads Al-Fatiha with source metadata attached', async () => {
    const ayahs = await getSurahAyahs(1);
    expect(ayahs).toHaveLength(7);
    expect(ayahs[0]?.text).toContain('بِسۡمِ');
    expect(ayahs[0]?.source.source_id).toBe('tanzil-uthmani');
    expect(ayahs[0]?.source.review_status).toBe('verified');
    expect(ayahs[0]?.translation).toBeTruthy();
  });

  it('resolves a direct reference search (Ayat al-Kursi)', async () => {
    const results = await searchQuran('2:255');
    expect(results).toHaveLength(1);
    expect(results[0]?.ayah.surah).toBe(2);
    expect(results[0]?.ayah.ayah).toBe(255);
    expect(normalizeArabic(results[0]!.ayah.text)).toContain('الله لا اله الا هو الحي القيوم');
  });

  it('finds ayahs by normalized Arabic text', async () => {
    const results = await searchQuran('قل هو الله أحد');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.ayah.surah).toBe(112);
  });

  it('finds surah by name and returns its ayahs', async () => {
    const results = await searchQuran('الفاتحة');
    expect(results.length).toBe(7);
  });

  it('maps (surah, ayah) to the global ayah number for audio', async () => {
    expect(globalAyahNumber(1, 1)).toBe(1);
    expect(globalAyahNumber(2, 1)).toBe(8);
    expect(globalAyahNumber(114, 6)).toBe(6236);
    const ayah = await getAyah(114, 6);
    expect(ayah).not.toBeNull();
  });
});
