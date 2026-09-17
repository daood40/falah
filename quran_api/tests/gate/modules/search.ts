/**
 * Category: search — real queries built from the corpus itself. For every
 * query the expected hit count is computed independently in JavaScript from
 * the source text, then compared with what the API returns.
 */
import { normalizeForSearch, searchSkeleton } from '../../../src/core/arabic.ts';
import type { GateContext } from '../context.ts';

const CATEGORY = 'search';
const V1 = '/api/v1';

export async function run(ctx: GateContext): Promise<void> {
  const { gate, request, dataset } = ctx;

  const normalizedAyahs = dataset.ayahs.map((ayah) => ({
    key: `${ayah.surah_number}:${ayah.ayah_number}`,
    normalized: normalizeForSearch(ayah.raw_text),
    skeleton: searchSkeleton(ayah.raw_text),
  }));

  const expectedExact = (query: string): number => {
    const needle = normalizeForSearch(query);
    return normalizedAyahs.filter((ayah) => ayah.normalized.includes(needle)).length;
  };

  // A deterministic, evenly spread corpus of real words: one word taken from
  // every fifth ayah, longest first so the query is meaningful.
  const words: { word: string; from: string }[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < dataset.ayahs.length; index += 1) {
    const ayah = dataset.ayahs[index]!;
    const candidates = normalizeForSearch(ayah.raw_text)
      .split(/\s+/)
      .filter((word) => word.length >= 4);
    const word = candidates[index % Math.max(1, candidates.length)];
    if (!word || seen.has(word)) continue;
    seen.add(word);
    words.push({ word, from: `${ayah.surah_number}:${ayah.ayah_number}` });
    if (words.length >= 1100) break;
  }

  for (const [index, entry] of words.entries()) {
    const expected = expectedExact(entry.word);
    const target = `${V1}/search?q=${encodeURIComponent(entry.word)}&exact=true&limit=1`;
    const response = await request(target);
    const total = response.body?.meta?.total;
    const ok = response.status === 200 && total === expected && expected > 0;
    gate.check(
      `SR-WORD-${String(index + 1).padStart(4, '0')}`,
      CATEGORY,
      `exact search for a word taken from ayah ${entry.from} returns every ayah containing it`,
      { q: entry.word, from: entry.from },
      ok,
      `200 with meta.total = ${expected} (counted independently from the source)`,
      `status ${response.status}, meta.total ${total}`,
      'HIGH',
      3,
    );
  }

  // Diacritics: the raw spelling (with harakat) and the folded spelling must
  // return the same hits — folding happens on a derived column only.
  let fold = 0;
  for (let index = 0; index < dataset.ayahs.length && fold < 250; index += 25) {
    const ayah = dataset.ayahs[index]!;
    const rawWord = ayah.raw_text.split(/\s+/).find((word) => word.length >= 5);
    if (!rawWord) continue;
    fold += 1;
    const folded = normalizeForSearch(rawWord);
    const [withDiacritics, withoutDiacritics] = await Promise.all([
      request(`${V1}/search?q=${encodeURIComponent(rawWord)}&exact=true&limit=1`),
      request(`${V1}/search?q=${encodeURIComponent(folded)}&exact=true&limit=1`),
    ]);
    const a = withDiacritics.body?.meta?.total;
    const b = withoutDiacritics.body?.meta?.total;
    gate.check(
      `SR-FOLD-${String(fold).padStart(3, '0')}`,
      CATEGORY,
      `diacritics are folded: "${rawWord}" and its folded form return the same hits`,
      { raw: rawWord, folded },
      withDiacritics.status === 200 && withoutDiacritics.status === 200 && a === b && typeof a === 'number' && a > 0,
      'identical non-zero hit counts',
      `${a} vs ${b}`,
      'HIGH',
      4,
    );
  }

  // Skeleton matching: dropping the alef must still find the ayah.
  let skeletonCase = 0;
  for (let index = 0; index < dataset.ayahs.length && skeletonCase < 200; index += 31) {
    const ayah = dataset.ayahs[index]!;
    const word = normalizeForSearch(ayah.raw_text).split(/\s+/).find((candidate) => candidate.length >= 5 && candidate.includes('ا'));
    if (!word) continue;
    skeletonCase += 1;
    const stripped = searchSkeleton(word);
    const response = await request(`${V1}/search?q=${encodeURIComponent(stripped)}&limit=1`);
    const total = response.body?.meta?.total ?? 0;
    gate.check(
      `SR-SKEL-${String(skeletonCase).padStart(3, '0')}`,
      CATEGORY,
      `alef-less form of "${word}" still matches through the skeleton index`,
      { word, skeleton: stripped, from: `${ayah.surah_number}:${ayah.ayah_number}` },
      response.status === 200 && total > 0,
      '200 with at least one hit',
      `status ${response.status}, total ${total}`,
      'MEDIUM',
      2,
    );
  }

  // Filters: the same query narrowed by surah / juz / hizb / page.
  const filterWord = normalizeForSearch('الله');
  let filterCase = 0;
  for (const surah of [1, 2, 3, 4, 5, 9, 18, 36, 55, 67, 112, 114]) {
    filterCase += 1;
    const target = `${V1}/search?q=${encodeURIComponent(filterWord)}&exact=true&surah=${surah}&limit=1`;
    const response = await request(target);
    const expected = normalizedAyahs.filter(
      (ayah) => ayah.key.startsWith(`${surah}:`) && ayah.normalized.includes(filterWord),
    ).length;
    gate.check(
      `SR-FILTER-SURAH-${String(surah).padStart(3, '0')}`,
      CATEGORY,
      `search narrowed to surah ${surah} returns only that surah's hits`,
      { q: filterWord, surah },
      response.status === 200 && response.body?.meta?.total === expected,
      expected,
      response.body?.meta?.total,
      'HIGH',
      2,
    );
  }
  for (let juz = 1; juz <= 30; juz += 1) {
    filterCase += 1;
    const response = await request(`${V1}/search?q=${encodeURIComponent(filterWord)}&exact=true&juz=${juz}&limit=1`);
    const expectedKeys = new Set(
      dataset.ayahs.filter((ayah) => ayah.juz_number === juz).map((ayah) => `${ayah.surah_number}:${ayah.ayah_number}`),
    );
    const expected = normalizedAyahs.filter((ayah) => expectedKeys.has(ayah.key) && ayah.normalized.includes(filterWord)).length;
    gate.check(
      `SR-FILTER-JUZ-${String(juz).padStart(2, '0')}`,
      CATEGORY,
      `search narrowed to juz ${juz} matches the independently counted hits`,
      { q: filterWord, juz },
      response.status === 200 && response.body?.meta?.total === expected,
      expected,
      response.body?.meta?.total,
      'HIGH',
      2,
    );
  }
  for (let hizb = 1; hizb <= 60; hizb += 1) {
    const response = await request(`${V1}/search?q=${encodeURIComponent(filterWord)}&exact=true&hizb=${hizb}&limit=1`);
    const keys = new Set(
      dataset.ayahs.filter((ayah) => ayah.hizb_number === hizb).map((ayah) => `${ayah.surah_number}:${ayah.ayah_number}`),
    );
    const expected = normalizedAyahs.filter((ayah) => keys.has(ayah.key) && ayah.normalized.includes(filterWord)).length;
    gate.check(
      `SR-FILTER-HIZB-${String(hizb).padStart(2, '0')}`,
      CATEGORY,
      `search narrowed to hizb ${hizb} matches the independently counted hits`,
      { q: filterWord, hizb },
      response.status === 200 && response.body?.meta?.total === expected,
      expected,
      response.body?.meta?.total,
      'MEDIUM',
      2,
    );
  }
  for (let page = 1; page <= 100; page += 1) {
    const response = await request(`${V1}/search?q=${encodeURIComponent(filterWord)}&exact=true&page_number=${page}&limit=1`);
    const keys = new Set(
      dataset.ayahs.filter((ayah) => ayah.page_number === page).map((ayah) => `${ayah.surah_number}:${ayah.ayah_number}`),
    );
    const expected = normalizedAyahs.filter((ayah) => keys.has(ayah.key) && ayah.normalized.includes(filterWord)).length;
    gate.check(
      `SR-FILTER-PAGE-${String(page).padStart(3, '0')}`,
      CATEGORY,
      `search narrowed to mushaf page ${page} matches the independently counted hits`,
      { q: filterWord, page_number: page },
      response.status === 200 && response.body?.meta?.total === expected,
      expected,
      response.body?.meta?.total,
      'MEDIUM',
      2,
    );
  }

  // Queries that must find nothing — a search that always returns hits is
  // useless. These are real strings that do not occur in the corpus.
  const absent = ['zzzzzz', 'qwertyuiop', '1234567890', 'lorem ipsum', 'لايوجدهذاالنصابدا', '﷽﷽﷽', 'xyzxyzxyz', 'aaaaaaaaaaaa'];
  for (const [index, query] of absent.entries()) {
    const response = await request(`${V1}/search?q=${encodeURIComponent(query)}&exact=true&limit=1`);
    gate.check(
      `SR-ABSENT-${String(index + 1).padStart(2, '0')}`,
      CATEGORY,
      `a string that does not occur in the corpus returns zero hits, not a guess`,
      { q: query },
      response.status === 200 && response.body?.meta?.total === 0,
      '200 with meta.total 0',
      `status ${response.status}, total ${response.body?.meta?.total}`,
      'HIGH',
      2,
    );
  }

  // Query validation.
  const invalid: { q: string; expect: number[] }[] = [
    { q: '', expect: [422] },
    { q: '   ', expect: [422] },
    { q: 'x'.repeat(201), expect: [422] },
  ];
  for (const [index, testCase] of invalid.entries()) {
    const response = await request(`${V1}/search?q=${encodeURIComponent(testCase.q)}`);
    gate.check(
      `SR-INVALID-${String(index + 1).padStart(2, '0')}`,
      CATEGORY,
      `invalid query (${testCase.q.length} chars) is rejected with a validation error`,
      { q_length: testCase.q.length },
      testCase.expect.includes(response.status),
      testCase.expect.join('/'),
      response.status,
      'HIGH',
      1,
    );
  }
  const missing = await request(`${V1}/search`);
  gate.check('SR-INVALID-NOQ', CATEGORY, 'search without q is rejected', { q: null }, missing.status === 422, 422, missing.status, 'HIGH', 1);
  const maxLength = await request(`${V1}/search?q=${encodeURIComponent('x'.repeat(200))}`);
  gate.check('SR-BOUNDARY-200', CATEGORY, 'a query of exactly the 200-character limit is accepted', { q_length: 200 }, maxLength.status === 200, 200, maxLength.status, 'MEDIUM', 1);

  // Ranking and paging behave on a real high-frequency query.
  const ranked = await request(`${V1}/search?q=${encodeURIComponent(filterWord)}&limit=10&page=1`);
  const rankedSecond = await request(`${V1}/search?q=${encodeURIComponent(filterWord)}&limit=10&page=2`);
  const firstKeys = (ranked.body?.data ?? []).map((row: any) => row.ayah_key);
  const secondKeys = (rankedSecond.body?.data ?? []).map((row: any) => row.ayah_key);
  gate.check('SR-PAGE-1', CATEGORY, 'search page 1 returns exactly the requested limit', { limit: 10, page: 1 }, firstKeys.length === 10, 10, firstKeys.length, 'MEDIUM', 1);
  gate.check('SR-PAGE-2', CATEGORY, 'search page 2 returns a different window', { limit: 10, page: 2 }, secondKeys.length === 10 && firstKeys.every((key: string) => !secondKeys.includes(key)), 'no overlap with page 1', `${secondKeys.length} rows, overlap ${firstKeys.filter((key: string) => secondKeys.includes(key)).length}`, 'MEDIUM', 2);
  gate.check('SR-RANK', CATEGORY, 'search hits carry a numeric rank', { q: filterWord }, (ranked.body?.data ?? []).every((row: any) => typeof row.rank === 'number'), 'every hit has a numeric rank', typeof (ranked.body?.data ?? [])[0]?.rank, 'LOW', 1);
}
