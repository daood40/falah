import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// This file runs with the licence flag flipped ON, to prove that confirming the
// licence needs no code change — only the environment variable (§3).
// Everything is imported dynamically so config.ts reads the flag as set here.
process.env['CONTENT_LICENSE_CONFIRMED'] = 'true';

const { TEST_DATASET, TEST_EDITION_SLUG, seedTestEdition, startApi, wipeTestData } =
  await import('./helpers.ts');
const { runImport } = await import('../src/importer/pipeline.ts');
const { closePool, queryOne, query } = await import('../src/db.ts');
const { config } = await import('../src/config.ts');

type TestApi = Awaited<ReturnType<typeof startApi>>;

let api: TestApi;
let hadithId: string;

beforeAll(async () => {
  await seedTestEdition();
  await wipeTestData();
  await runImport({
    adapter: 'jami_kamil', file: 'fixtures/test-dataset.json',
    editionSlug: TEST_EDITION_SLUG, datasetVersion: TEST_DATASET, dryRun: false, actor: 'vitest',
  });
  hadithId = (await queryOne<{ id: string }>(
    `select id from corpus.hadiths where dataset_version = $1 and hadith_number = '1'`, [TEST_DATASET]))!.id;
  api = await startApi();
});

afterAll(async () => {
  await api.close();
  await wipeTestData();
  await closePool();
});

describe('CONTENT_LICENSE_CONFIRMED=true', () => {
  it('is read from the environment, not from code', () => {
    expect(config.contentLicenseConfirmed).toBe(true);
  });

  it('serves the full text to the public API', async () => {
    const { body } = await api.get(`/api/v1/hadiths/${hadithId}?include=takhrij`);
    expect(body.data.text).toContain('TEST DATA');
    expect(body.data.text_available).toBe(true);
    expect(body.data.takhrij.takhrij_text).toContain('TEST TAKHRIJ');
  });

  it('health reports the flag as confirmed', async () => {
    const { body } = await api.get('/api/v1/health');
    expect(body.data.content_license_confirmed).toBe(true);
  });

  it('the database view gates on its own flag, independently of the API', async () => {
    const withheld = await queryOne<{ raw_text: string | null; text_available: boolean }>(
      'select raw_text, text_available from corpus.hadiths_public where id = $1', [hadithId]);
    expect(withheld?.text_available).toBe(false);
    expect(withheld?.raw_text).toBeNull();

    await query(`update corpus.app_settings set value = 'true' where key = 'content_license_confirmed'`);
    const served = await queryOne<{ raw_text: string | null }>(
      'select raw_text from corpus.hadiths_public where id = $1', [hadithId]);
    expect(served?.raw_text).toContain('TEST DATA');
    await query(`update corpus.app_settings set value = 'false' where key = 'content_license_confirmed'`);
  });
});
