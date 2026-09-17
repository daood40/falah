import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runImport } from '../src/importer/pipeline.ts';
import { closePool, query, queryOne } from '../src/db.ts';
import { startApi, auth, TEST_DATASET, TEST_EDITION_SLUG, seedTestEdition, wipeTestData, type TestApi } from './helpers.ts';

let api: TestApi;
let ids: string[] = [];

beforeAll(async () => {
  await seedTestEdition();
  await wipeTestData();
  await query('delete from corpus.verification_samples');
  await runImport({
    adapter: 'jami_kamil', file: 'fixtures/test-dataset.json',
    editionSlug: TEST_EDITION_SLUG, datasetVersion: TEST_DATASET, dryRun: false, actor: 'vitest',
  });
  ids = (await query<{ id: string }>(
    'select id from corpus.hadiths where dataset_version = $1 order by hadith_number', [TEST_DATASET],
  )).map((r) => r.id);
  api = await startApi();
});

afterAll(async () => {
  await api.close();
  await query('delete from corpus.verification_samples');
  await wipeTestData();
  await closePool();
});

describe('human sample verification (§48)', () => {
  it('needs an admin credential', async () => {
    const { status } = await api.post('/api/v1/admin/verification-samples', {});
    expect(status).toBe(401);
  });

  it('records a sample with its ids, verifier and discrepancies', async () => {
    const { status, body } = await api.post(
      '/api/v1/admin/verification-samples',
      {
        dataset_version: TEST_DATASET,
        sample_hadith_ids: ids.slice(0, 2),
        verifier: 'QA human (vitest)',
        source_reference: 'TEST FIXTURE — synthetic',
        exact_matches: 1,
        discrepancies: [{ hadith_id: ids[1], field: 'page_number', note: 'page differs' }],
        notes: 'synthetic sample',
        status: 'failed',
      },
      { headers: auth },
    );
    expect(status).toBe(201);
    expect(body.data.sample_size).toBe(2);
    expect(body.data.exact_matches).toBe(1);
    expect(body.data.discrepancies).toHaveLength(1);
    expect(body.data.verifier).toBe('QA human (vitest)');
  });

  it('refuses "passed" when a record did not match or a discrepancy exists', async () => {
    const withDiscrepancy = await api.post(
      '/api/v1/admin/verification-samples',
      {
        dataset_version: TEST_DATASET, sample_hadith_ids: ids.slice(0, 2), verifier: 'QA',
        exact_matches: 2, discrepancies: [{ note: 'x' }], status: 'passed',
      },
      { headers: auth },
    );
    expect(withDiscrepancy.status).toBe(422);

    const partial = await api.post(
      '/api/v1/admin/verification-samples',
      {
        dataset_version: TEST_DATASET, sample_hadith_ids: ids.slice(0, 2), verifier: 'QA',
        exact_matches: 1, status: 'passed',
      },
      { headers: auth },
    );
    expect(partial.status).toBe(422);
  });

  it('refuses a sample with no verifier, no ids, or unknown ids', async () => {
    const noVerifier = await api.post('/api/v1/admin/verification-samples',
      { dataset_version: TEST_DATASET, sample_hadith_ids: ids.slice(0, 1), verifier: '  ' }, { headers: auth });
    expect(noVerifier.status).toBe(422);

    const noIds = await api.post('/api/v1/admin/verification-samples',
      { dataset_version: TEST_DATASET, sample_hadith_ids: [], verifier: 'QA' }, { headers: auth });
    expect(noIds.status).toBe(422);

    const unknown = await api.post('/api/v1/admin/verification-samples',
      { dataset_version: TEST_DATASET, verifier: 'QA',
        sample_hadith_ids: ['00000000-0000-0000-0000-000000000000'] }, { headers: auth });
    expect(unknown.status).toBe(404);
  });

  it('accepts a fully matching sample as passed', async () => {
    const { status, body } = await api.post(
      '/api/v1/admin/verification-samples',
      {
        dataset_version: TEST_DATASET, sample_hadith_ids: ids.slice(0, 3), verifier: 'QA human',
        exact_matches: 3, discrepancies: [], status: 'passed', source_reference: 'TEST FIXTURE',
      },
      { headers: auth },
    );
    expect(status).toBe(201);
    expect(body.data.status).toBe('passed');
  });

  it('lists samples and reports dataset verification status', async () => {
    const list = await api.get(`/api/v1/admin/verification-samples?dataset_version=${TEST_DATASET}`, { headers: auth });
    expect(list.body.meta.total).toBe(2);

    const status = await api.get('/api/v1/admin/verification-status', { headers: auth });
    const row = status.body.data.find((d: { dataset_version: string }) => d.dataset_version === TEST_DATASET);
    expect(row.samples).toBe(2);
    expect(row.passed_samples).toBe(1);

    const jami = status.body.data.find((d: { dataset_version: string }) => d.dataset_version === 'JAMI-KAMIL-1437-V1');
    expect(jami.hadiths).toBe(0);
    expect(jami.samples).toBe(0);
  });

  it('the database itself refuses an unearned pass', async () => {
    await expect(
      query(
        `insert into corpus.verification_samples
           (dataset_version, sample_size, sample_hadith_ids, verifier, exact_matches, status)
         values ($1, 2, $2::uuid[], 'direct sql', 0, 'passed')`,
        [TEST_DATASET, ids.slice(0, 2)],
      ),
    ).rejects.toThrow(/verification_samples_pass_is_earned/);
  });

  it('the database refuses a sample whose size disagrees with its ids', async () => {
    await expect(
      query(
        `insert into corpus.verification_samples
           (dataset_version, sample_size, sample_hadith_ids, verifier)
         values ($1, 5, $2::uuid[], 'direct sql')`,
        [TEST_DATASET, ids.slice(0, 2)],
      ),
    ).rejects.toThrow(/verification_samples_size_matches/);
  });
});

describe('contract minimum (§2)', () => {
  it('imports a record carrying nothing but text, leaving everything else null', async () => {
    const report = await runImport({
      adapter: 'generic_json', file: 'fixtures/minimal-contract.json',
      editionSlug: TEST_EDITION_SLUG, datasetVersion: TEST_DATASET, dryRun: false, actor: 'vitest',
    });
    expect(report.imported).toBe(2);
    expect(report.invalid).toBe(0);

    const row = await queryOne<Record<string, unknown>>(
      `select hadith_number, hadith_number_int, volume_number, page_number, matn, isnad,
              takhrij, grading, book_id, chapter_id, narrator_id, original_reference,
              raw_text, content_hash
       from corpus.hadiths where raw_text like 'TEST DATA — سجلّ بالحد الأدنى%'`,
    );
    for (const field of ['hadith_number', 'hadith_number_int', 'volume_number', 'page_number',
      'matn', 'isnad', 'takhrij', 'grading', 'book_id', 'chapter_id', 'narrator_id',
      'original_reference']) {
      expect(row?.[field], field).toBeNull();
    }
    expect(row?.['raw_text']).toContain('نصّ فقط');
    expect(String(row?.['content_hash'])).toHaveLength(64);
  });
});

describe('a sample cannot cross datasets', () => {
  it('refuses sampled hadiths that belong to another dataset_version', async () => {
    const { status, body } = await api.post(
      '/api/v1/admin/verification-samples',
      {
        dataset_version: 'JAMI-KAMIL-1437-V1',
        sample_hadith_ids: ids.slice(0, 1),
        verifier: 'QA',
      },
      { headers: auth },
    );
    expect(status).toBe(422);
    expect(body.error.message).toMatch(/dataset_version/);
  });
});
