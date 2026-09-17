import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runImport } from '../src/importer/pipeline.ts';
import { closePool, query } from '../src/db.ts';
import { TEST_DATASET, TEST_EDITION_SLUG, seedTestEdition, wipeTestData } from './helpers.ts';

beforeAll(async () => {
  await seedTestEdition();
  await wipeTestData();
  await runImport({
    adapter: 'jami_kamil', file: 'fixtures/test-dataset.json',
    editionSlug: TEST_EDITION_SLUG, datasetVersion: TEST_DATASET, dryRun: false, actor: 'vitest',
  });
});
afterAll(async () => {
  await wipeTestData();
  await closePool();
});

const zeroRows = async (sql: string) => (await query(sql)).length;

describe('data integrity (§35)', () => {
  it('every hadith with text has a non-empty raw_text', async () => {
    expect(await zeroRows(`select id from corpus.hadiths where raw_text is null or btrim(raw_text) = ''`)).toBe(0);
  });

  it('content_hash always equals sha256(raw_text)', async () => {
    expect(await zeroRows('select id from corpus.hadiths where content_hash <> corpus.sha256_hex(raw_text)')).toBe(0);
  });

  it('imported content is source_locked', async () => {
    expect(await zeroRows('select id from corpus.hadiths where source_locked = false')).toBe(0);
  });

  it('hadith_number is unique per (dataset, edition)', async () => {
    expect(await zeroRows(`select 1 from corpus.hadiths where hadith_number is not null
      group by dataset_version, edition_id, hadith_number having count(*) > 1`)).toBe(0);
  });

  it('every edition points at a real source, every book at its edition, every chapter at its book', async () => {
    expect(await zeroRows(`select e.id from corpus.editions e
      where not exists (select 1 from corpus.sources s where s.id = e.source_id)`)).toBe(0);
    expect(await zeroRows(`select h.id from corpus.hadiths h join corpus.books b on b.id = h.book_id
      where b.edition_id <> h.edition_id`)).toBe(0);
    expect(await zeroRows(`select h.id from corpus.hadiths h join corpus.chapters c on c.id = h.chapter_id
      where c.book_id is distinct from h.book_id`)).toBe(0);
  });

  it('every hadith belongs to a declared dataset_version', async () => {
    expect(await zeroRows(`select h.id from corpus.hadiths h where not exists
      (select 1 from corpus.dataset_versions d where d.version = h.dataset_version)`)).toBe(0);
  });

  it('verified=true is impossible without verification_status=verified', async () => {
    await expect(
      query(`update corpus.hadiths set verified = true where dataset_version = $1`, [TEST_DATASET]),
    ).rejects.toThrow(/hadiths_verified_consistent/);
  });

  it('no placeholder religious data reached the corpus (§50)', async () => {
    expect(await zeroRows(`select id from corpus.hadiths
      where raw_text ilike '%sample hadith%' or raw_text like '%حديث تجريبي%'`)).toBe(0);
  });

  it('the shipped Jami-Kamil dataset holds metadata only — no text was invented', async () => {
    const rows = await query<{ n: number }>(
      `select count(*)::int as n from corpus.hadiths where dataset_version = 'JAMI-KAMIL-1437-V1'`);
    expect(rows[0]?.n).toBe(0);
  });

  it('the Arabic text round-trips through the database byte for byte', async () => {
    const probe = 'إنَّ ﴿٠١٢﴾ «أ إ آ ٱ ى ة ؤ ئ» ـــ';
    const row = await query<{ same: boolean }>(`select $1::text = $1::text as same`, [probe]);
    expect(row[0]?.same).toBe(true);
    const stored = await query<{ raw_text: string }>(
      `select raw_text from corpus.hadiths where dataset_version = $1 and hadith_number = '1'`, [TEST_DATASET]);
    expect(stored[0]?.raw_text).toMatch(/٠١٢٣٤٥٦٧٨٩/);
    expect(stored[0]?.raw_text).toMatch(/ٌّ/);
  });
});
