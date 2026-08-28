/** Hadith engine: verified seed, search, no invented grades. */
import { describe, expect, it } from 'vitest';
import { getHadith, listCollections, listHadiths, searchHadiths } from './data/hadithRepository';

describe('hadith repository (Nawawi 40 verified seed)', () => {
  it('seeds the verified collection', async () => {
    const all = await listHadiths();
    expect(all.length).toBeGreaterThanOrEqual(40);
    expect(listCollections()[0]?.id).toBe('nawawi40');
  });

  it('hadith #1 is the intentions hadith with full source metadata', async () => {
    const first = (await listHadiths())[0]!;
    expect(first.number).toBe(1);
    expect(first.arabic).toContain('إنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ');
    expect(first.source.source_id).toBe('nawawi40');
    expect(first.source.review_status).toBe('verified');
  });

  it('never fabricates a grade: ungraded hadiths carry null, not a claim', async () => {
    const all = await listHadiths();
    for (const h of all) {
      if (h.grade !== null) expect(h.grade_source).not.toBeNull();
    }
  });

  it('searches by Arabic text (diacritics-insensitive)', async () => {
    const results = await searchHadiths('الاعمال بالنيات');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.number).toBe(1);
  });

  it('searches by hadith number and by English', async () => {
    expect((await searchHadiths('2'))[0]?.number).toBe(2);
    expect((await searchHadiths('intended')).length).toBeGreaterThan(0);
  });

  it('gets a hadith by id', async () => {
    expect(await getHadith('nawawi_1')).not.toBeNull();
    expect(await getHadith('missing')).toBeNull();
  });
});
