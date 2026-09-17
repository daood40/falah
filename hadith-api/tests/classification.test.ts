import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runImport } from '../src/importer/pipeline.ts';
import { closePool, query, queryOne } from '../src/db.ts';
import { matchTokens, shingles, uniqueShingles } from '../src/domain/matching.ts';
import { startApi, TEST_DATASET, TEST_EDITION_SLUG, seedTestEdition, wipeTestData, type TestApi } from './helpers.ts';

let api: TestApi;
let hadithId: string;

beforeAll(async () => {
  await seedTestEdition();
  await wipeTestData();
  await query('delete from corpus.cross_checks');
  await runImport({
    adapter: 'jami_kamil_shamela', file: 'fixtures/shamela-format.txt',
    editionSlug: TEST_EDITION_SLUG, datasetVersion: TEST_DATASET, dryRun: false, actor: 'vitest',
  });
  hadithId = (await queryOne<{ id: string }>(
    `select id from corpus.hadiths where dataset_version = $1 order by source_ordinal limit 1`,
    [TEST_DATASET],
  ))!.id;
  api = await startApi();
});

afterAll(async () => {
  await api.close();
  await query('delete from corpus.cross_checks');
  await query('delete from corpus.reference_corpora');
  await wipeTestData();
  await closePool();
});

describe('matching primitives', () => {
  it('tokenizes Arabic without touching the source text', () => {
    const original = 'إنَّ الأعْمالَ، بالنِّيَّاتِ! "قال"';
    const tokens = matchTokens(original);
    expect(tokens).toEqual(['ان', 'الاعمال', 'بالنيات', 'قال']);
    expect(original).toBe('إنَّ الأعْمالَ، بالنِّيَّاتِ! "قال"'); // unchanged
  });

  it('drops one-letter tokens that carry no signal', () => {
    expect(matchTokens('و في ا لل بيت')).toEqual(['في', 'لل', 'بيت']);
  });

  it('produces overlapping windows and is order sensitive', () => {
    const a = shingles(['a', 'b', 'c', 'd', 'e', 'f'], 5);
    const b = shingles(['f', 'e', 'd', 'c', 'b', 'a'], 5);
    expect(a).toHaveLength(2);
    expect(a[0]).not.toBe(b[0]);
  });

  it('matches two spellings of the same sentence', () => {
    const one = uniqueShingles(matchTokens('إنما الأعمال بالنيات وإنما لكل امرئ ما نوى'), 5);
    const two = uniqueShingles(matchTokens('إنَّمَا الأعمالُ بالنِّيَّاتِ، وإنَّمَا لكلِّ امرئٍ ما نوى'), 5);
    expect(one).toEqual(two);
  });

  it('short texts still yield one window', () => {
    expect(uniqueShingles(matchTokens('نص قصير'), 5)).toHaveLength(1);
    expect(uniqueShingles([], 5)).toHaveLength(0);
  });
});

describe('classification resources', () => {
  it('lists collections named in takhrij with counts', async () => {
    const { status, body } = await api.get('/api/v1/collections');
    expect(status).toBe(200);
    const bukhari = body.data.find((c: { name: string }) => c.name === 'البخاري');
    expect(bukhari.hadith_count).toBeGreaterThan(0);
  });

  it('serves the records of one collection and 404s for an unknown one', async () => {
    const list = await api.get(`/api/v1/collections/${encodeURIComponent('البخاري')}/hadiths`);
    expect(list.body.meta.total).toBeGreaterThan(0);
    expect(list.body.data[0]).not.toHaveProperty('raw_text');
    expect((await api.get('/api/v1/collections/nope/hadiths')).status).toBe(404);
  });

  it('lists grading labels verbatim with their grader', async () => {
    const { body } = await api.get('/api/v1/gradings');
    const labels = body.data.map((g: { label: string }) => g.label);
    expect(labels).toContain('متفق عليه');
    expect(labels).toContain('صحيح');
    expect(body.data[0].grader).toContain('الأعظمي');
  });

  it('lists volumes with printed page ranges and serves a volume in reading order', async () => {
    const volumes = await api.get('/api/v1/volumes');
    expect(volumes.body.data.length).toBeGreaterThan(0);
    const first = volumes.body.data[0];
    expect(first.first_page).toBeLessThanOrEqual(first.last_page);

    const one = await api.get(`/api/v1/volumes/${first.volume}/hadiths`);
    expect(one.body.meta.total).toBe(first.hadith_count);
    const pages = one.body.data.map((h: { page: number }) => h.page);
    expect([...pages].sort((a, b) => a - b)).toEqual(pages);

    expect((await api.get('/api/v1/volumes/99/hadiths')).status).toBe(404);
  });

  it('returns the catalogue, with chapters only when asked', async () => {
    const flat = await api.get('/api/v1/catalog');
    expect(flat.body.data[0].chapter_count).toBeGreaterThan(0);
    expect(flat.body.data[0].chapters).toBeUndefined();

    const deep = await api.get('/api/v1/catalog?chapters=true');
    expect(Array.isArray(deep.body.data[0].chapters)).toBe(true);
    expect(deep.body.data[0].chapters[0].name).toContain('باب');
  });
});

describe('cross-check resources', () => {
  beforeAll(async () => {
    const corpus = await queryOne<{ id: string }>(
      `insert into corpus.reference_corpora (slug, name, url, license, version, record_count)
       values ('test-reference', 'TEST REFERENCE CORPUS', 'https://example.test', 'TEST', '0', 2)
       returning id`,
    );
    await query(
      `insert into corpus.cross_checks
         (hadith_id, reference_corpus_id, reference_collection, reference_key, method,
          similarity, verdict, takhrij_agrees, takhrij_collections, details)
       values ($1, $2, 'صحيح البخاري', 'TEST-1', 'shingle_overlap', 0.9, 'corroborated', true,
               array['البخاري'], '{"takhrij_support":"strong"}'::jsonb)`,
      [hadithId, (corpus as { id: string }).id],
    );
  });

  it('reports what the reference corpora say about one record', async () => {
    const { body } = await api.get(`/api/v1/hadiths/${hadithId}/cross-checks`);
    expect(body.data[0].verdict).toBe('corroborated');
    expect(body.data[0].reference_collection).toBe('صحيح البخاري');
    expect(body.data[0].takhrij_agrees).toBe(true);
    // a verdict carries no scripture, so it is public even while text is withheld
    expect(JSON.stringify(body)).not.toContain('TEST DATA');
  });

  it('404s for an unknown hadith and validates the id', async () => {
    expect((await api.get('/api/v1/hadiths/00000000-0000-0000-0000-000000000000/cross-checks')).status).toBe(404);
    expect((await api.get('/api/v1/hadiths/not-a-uuid/cross-checks')).status).toBe(422);
  });

  it('summarises verdicts per dataset and reference', async () => {
    const { body } = await api.get('/api/v1/cross-checks/summary');
    const row = body.data.find((r: { reference_slug: string }) => r.reference_slug === 'test-reference');
    expect(row.checked).toBe(1);
    expect(row.corroborated).toBe(1);
  });

  it('lists the reference corpora with their licence', async () => {
    const { body } = await api.get('/api/v1/references');
    expect(body.data.some((r: { slug: string }) => r.slug === 'test-reference')).toBe(true);
  });

  it('serves a review queue of records nothing corroborated', async () => {
    const { body } = await api.get('/api/v1/cross-checks/review-queue');
    expect(body.meta.verdict).toBe('not_found');
    expect(Array.isArray(body.data)).toBe(true);
  });
});
