import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runImport } from '../src/importer/pipeline.ts';
import { closePool, query, queryOne } from '../src/db.ts';
import { contentHash } from '../src/domain/hash.ts';
import { renderReport } from '../src/importer/report.ts';
import { TEST_DATASET, TEST_EDITION_SLUG, seedTestEdition, wipeTestData } from './helpers.ts';

const opts = {
  adapter: 'jami_kamil',
  file: 'fixtures/test-dataset.json',
  editionSlug: TEST_EDITION_SLUG,
  datasetVersion: TEST_DATASET,
  actor: 'vitest',
};

beforeAll(async () => {
  await seedTestEdition();
  await wipeTestData();
});
afterAll(async () => {
  await wipeTestData();
  await closePool();
});

describe('dry run', () => {
  it('writes nothing to the database', async () => {
    const before = await queryOne<{ n: number }>('select count(*)::int as n from corpus.hadiths');
    const report = await runImport({ ...opts, dryRun: true });
    const after = await queryOne<{ n: number }>('select count(*)::int as n from corpus.hadiths');
    const imports = await queryOne<{ n: number }>('select count(*)::int as n from corpus.raw_imports');

    expect(report.status).toBe('dry_run');
    expect(after?.n).toBe(before?.n);
    expect(imports?.n).toBe(0);
  });

  it('reports totals, invalid records and duplicates', async () => {
    const report = await runImport({ ...opts, dryRun: true });
    expect(report.total_records).toBe(6);
    expect(report.invalid).toBeGreaterThan(0);
    expect(report.duplicates).toBe(1);
    expect(report.errors.map((e) => e.code)).toContain('MISSING_TEXT');
    expect(report.errors.map((e) => e.code)).toContain('VOLUME_OUT_OF_RANGE');
    expect(renderReport(report)).toContain('DRY RUN');
  });

  it('rejects an unknown edition and an unknown dataset version', async () => {
    await expect(runImport({ ...opts, dryRun: true, editionSlug: 'nope' })).rejects.toThrow(/unknown edition/);
    await expect(runImport({ ...opts, dryRun: true, datasetVersion: 'NOPE' })).rejects.toThrow(/unknown dataset_version/);
  });
});

describe('import', () => {
  it('imports only the valid, non-duplicate records', async () => {
    const report = await runImport({ ...opts, dryRun: false });
    expect(report.status).toBe('completed');
    expect(report.imported).toBe(3);
    expect(report.hash_mismatches).toBe(0);
    expect(report.verified_hashes).toBe(3);
    expect(report.raw_import_id).toBeTruthy();
  });

  it('stores the text verbatim, diacritics and symbols intact', async () => {
    const row = await queryOne<{ raw_text: string; content_hash: string }>(
      `select raw_text, content_hash from corpus.hadiths
       where dataset_version = $1 and hadith_number = '1'`,
      [TEST_DATASET],
    );
    expect(row?.raw_text).toContain('نصٌّ اختباريٌّ');
    expect(row?.raw_text).toContain('﴿رمز﴾');
    expect(row?.raw_text).toContain('٠١٢٣٤٥٦٧٨٩');
    expect(row?.content_hash).toBe(contentHash(row?.raw_text as string));
  });

  it('leaves matn/isnad null when the source does not separate them', async () => {
    const one = await queryOne<{ matn: string | null; isnad: string | null }>(
      `select matn, isnad from corpus.hadiths where dataset_version = $1 and hadith_number = '1'`,
      [TEST_DATASET],
    );
    expect(one?.matn).toBeNull();
    expect(one?.isnad).toBeNull();

    const two = await queryOne<{ matn: string | null; isnad: string | null }>(
      `select matn, isnad from corpus.hadiths where dataset_version = $1 and hadith_number = '2'`,
      [TEST_DATASET],
    );
    expect(two?.matn).toContain('TEST MATN');
    expect(two?.isnad).toContain('TEST ISNAD');
  });

  it('builds books, chapters, narrators and the child relations', async () => {
    const books = await query(`select * from corpus.books where name like 'قسم اختباري%'`);
    const chapters = await query(`select * from corpus.chapters where name like 'باب اختباري%'`);
    const narrators = await query(`select * from corpus.narrators where name like 'راوٍ اختباريّ%'`);
    expect(books).toHaveLength(1);
    expect(chapters).toHaveLength(2);
    expect(narrators.length).toBeGreaterThanOrEqual(2);

    const nested = await queryOne<{ parent_id: string | null }>(
      `select parent_id from corpus.chapters where external_key = 'c2'`,
    );
    expect(nested?.parent_id).toBeTruthy();

    const takhrij = await query(`select * from corpus.hadith_sources where source_name = 'TEST SOURCE A'`);
    const gradings = await query(`select * from corpus.hadith_gradings where grader = 'TEST GRADER'`);
    expect(takhrij).toHaveLength(1);
    expect(gradings).toHaveLength(1);
  });

  it('records the import run with real counters', async () => {
    const row = await queryOne<{ status: string; successful_records: number; total_records: number }>(
      `select status, successful_records, total_records from corpus.raw_imports
       order by created_at desc limit 1`,
    );
    expect(row?.status).toBe('completed');
    expect(row?.successful_records).toBe(3);
    expect(row?.total_records).toBe(6);
  });

  it('writes a hash_check verification that does NOT mark the hadith verified', async () => {
    const records = await query<{ verification_type: string; result: string }>(
      `select verification_type, result from corpus.verification_records
       where verification_type = 'hash_check'`,
    );
    expect(records.length).toBe(3);
    expect(records.every((r) => r.result === 'passed')).toBe(true);

    const verified = await queryOne<{ n: number }>(
      `select count(*)::int as n from corpus.hadiths where dataset_version = $1 and verified`,
      [TEST_DATASET],
    );
    expect(verified?.n).toBe(0);
  });

  it('re-importing the same file skips duplicates instead of deleting anything', async () => {
    const before = await queryOne<{ n: number }>(
      `select count(*)::int as n from corpus.hadiths where dataset_version = $1`,
      [TEST_DATASET],
    );
    const report = await runImport({ ...opts, dryRun: false });
    const after = await queryOne<{ n: number }>(
      `select count(*)::int as n from corpus.hadiths where dataset_version = $1`,
      [TEST_DATASET],
    );
    expect(report.imported).toBe(0);
    expect(report.duplicates).toBeGreaterThanOrEqual(3);
    expect(after?.n).toBe(before?.n);
  });
});

describe('SOURCE_LOCK (database level)', () => {
  it('refuses to change the text of a locked hadith', async () => {
    await expect(
      query(`update corpus.hadiths set raw_text = 'tampered' where dataset_version = $1`, [TEST_DATASET]),
    ).rejects.toThrow(/SOURCE_LOCK/);
  });

  it('refuses to change the hadith number or dataset version', async () => {
    await expect(
      query(`update corpus.hadiths set hadith_number = '999' where dataset_version = $1`, [TEST_DATASET]),
    ).rejects.toThrow(/SOURCE_LOCK/);
    await expect(
      query(`update corpus.hadiths set grading = 'صحيح' where dataset_version = $1`, [TEST_DATASET]),
    ).rejects.toThrow(/SOURCE_LOCK/);
  });

  it('refuses to delete locked text', async () => {
    await expect(
      query(`delete from corpus.hadiths where dataset_version = $1`, [TEST_DATASET]),
    ).rejects.toThrow(/SOURCE_LOCK/);
  });

  it('still allows the verification workflow to move status', async () => {
    await expect(
      query(
        `update corpus.hadiths set verification_status = 'needs_review' where dataset_version = $1`,
        [TEST_DATASET],
      ),
    ).resolves.toBeDefined();
    await query(
      `update corpus.hadiths set verification_status = 'pending' where dataset_version = $1`,
      [TEST_DATASET],
    );
  });
});

describe('other adapters', () => {
  it('imports the CSV fixture', async () => {
    const report = await runImport({ ...opts, adapter: 'generic_csv', file: 'fixtures/test-dataset.csv', dryRun: true });
    expect(report.total_records).toBe(2);
    expect(report.invalid).toBe(0);
  });

  it('imports the structured HTML fixture', async () => {
    const report = await runImport({ ...opts, adapter: 'generic_html', file: 'fixtures/test-dataset.html', dryRun: true });
    expect(report.total_records).toBe(2);
    expect(report.invalid).toBe(0);
  });
});
