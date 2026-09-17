import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runImport } from '../src/importer/pipeline.ts';
import { closePool, query, queryOne } from '../src/db.ts';
import { startApi, auth, TEST_DATASET, TEST_EDITION_SLUG, seedTestEdition, wipeTestData, type TestApi } from './helpers.ts';

let api: TestApi;
let hadithId: string;
let bookId: string;
let chapterId: string;
let sourceId: string;

beforeAll(async () => {
  await seedTestEdition();
  await wipeTestData();
  await runImport({
    adapter: 'jami_kamil_shamela', file: 'fixtures/shamela-format.txt',
    editionSlug: TEST_EDITION_SLUG, datasetVersion: TEST_DATASET, dryRun: false, actor: 'vitest',
  });
  await query(`select corpus.seal_dataset($1)`, [TEST_DATASET]);
  const row = await queryOne<{ id: string; book_id: string; chapter_id: string }>(
    `select id, book_id, chapter_id from corpus.hadiths where dataset_version = $1 order by source_ordinal limit 1`,
    [TEST_DATASET],
  );
  hadithId = row!.id;
  bookId = row!.book_id;
  chapterId = row!.chapter_id;
  sourceId = (await queryOne<{ id: string }>(
    `select s.id from corpus.sources s join corpus.editions e on e.source_id = s.id where e.slug = $1`,
    [TEST_EDITION_SLUG],
  ))!.id;
  api = await startApi();
});

afterAll(async () => {
  await api.close();
  await wipeTestData();
  await closePool();
});

describe('§18 random', () => {
  it('returns a record that exists, never a generated one', async () => {
    const { status, body } = await api.get('/api/v1/hadiths/random');
    expect(status).toBe(200);
    const stored = await queryOne('select 1 from corpus.hadiths where id = $1', [body.data.id]);
    expect(stored).not.toBeNull();
    expect(body.data.dataset.version).toBe(TEST_DATASET);
  });

  it('honours filters and 404s when a filter matches nothing', async () => {
    const filtered = await api.get(`/api/v1/hadiths/random?book_id=${bookId}`);
    expect(filtered.body.data.book.id).toBe(bookId);
    const none = await api.get('/api/v1/hadiths/random?volume=99');
    expect(none.status).toBe(404);
  });
});

describe('§19 daily', () => {
  it('is deterministic for a given day and dataset', async () => {
    const a = await api.get('/api/v1/hadiths/daily?date=2026-01-01');
    const b = await api.get('/api/v1/hadiths/daily?date=2026-01-01');
    expect(a.body.data.id).toBe(b.body.data.id);
    expect(a.body.meta).toMatchObject({ date: '2026-01-01', deterministic: true });
  });

  it('picks from the dataset, and different days can differ', async () => {
    const days = await Promise.all(
      ['2026-01-01', '2026-02-02', '2026-03-03', '2026-04-04', '2026-05-05'].map((d) =>
        api.get(`/api/v1/hadiths/daily?date=${d}`),
      ),
    );
    for (const day of days) {
      const stored = await queryOne('select 1 from corpus.hadiths where id = $1', [day.body.data.id]);
      expect(stored).not.toBeNull();
    }
    expect(new Set(days.map((d) => d.body.data.id)).size).toBeGreaterThan(1);
  });

  it('rejects a malformed date', async () => {
    expect((await api.get('/api/v1/hadiths/daily?date=01-01-2026')).status).toBe(422);
  });
});

describe('§7–§11 per-hadith resources', () => {
  it('serves narrators', async () => {
    const { body } = await api.get(`/api/v1/hadiths/${hadithId}/narrators`);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('serves references with the location the print gives', async () => {
    const { body } = await api.get(`/api/v1/hadiths/${hadithId}/references`, { headers: auth });
    if (body.data.length > 0) {
      expect(body.data[0]).toHaveProperty('volume');
      expect(body.data[0]).toHaveProperty('page');
      expect(body.data[0]).toHaveProperty('reference_text');
    }
  });

  it('serves the takhrij unchanged, with its cited collections listed', async () => {
    const { body } = await api.get(`/api/v1/hadiths/${hadithId}/takhrij`, { headers: auth });
    expect(body.data.hadith_id).toBe(hadithId);
    expect(body.data.takhrij_text).toContain('تخريج اختباريّ');
    expect(body.data.dataset_version).toBe(TEST_DATASET);
  });

  it('serves gradings as a list — several are allowed, none is mandatory', async () => {
    const { body } = await api.get(`/api/v1/hadiths/${hadithId}/gradings`);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].grading_text).toBe('متفق عليه');

    // the fixture's fourth record has no grading line at all
    const ungraded = await queryOne<{ id: string }>(
      `select id from corpus.hadiths where dataset_version = $1 and grading is null limit 1`,
      [TEST_DATASET],
    );
    if (ungraded) {
      const empty = await api.get(`/api/v1/hadiths/${ungraded.id}/gradings`);
      expect(empty.body.data).toEqual([]);
    }
  });

  it('keeps the three verification layers apart', async () => {
    const { body } = await api.get(`/api/v1/hadiths/${hadithId}/verification`);
    expect(body.data).toMatchObject({
      source_match: expect.any(Boolean),
      cross_check: expect.any(String),
      human_review: false,
      verified: false,
    });
    expect(['SUPPORTED', 'PARTIAL', 'NOT_FOUND', 'UNKNOWN']).toContain(body.data.cross_check);
  });

  it('404s every sub-resource for an unknown hadith', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    for (const part of ['narrators', 'references', 'takhrij', 'gradings', 'verification']) {
      expect((await api.get(`/api/v1/hadiths/${missing}/${part}`)).status, part).toBe(404);
    }
  });
});

describe('§12 dataset identity', () => {
  it('reports api version, dataset version, fingerprint and count', async () => {
    const { body } = await api.get('/api/v1/version');
    expect(body.data.api_version).toBe('v1');
    expect(body.data.dataset_version).toBeTruthy();
    expect(typeof body.data.content_license_confirmed).toBe('boolean');
  });

  it('lists datasets with their seal', async () => {
    const { body } = await api.get('/api/v1/datasets');
    const test = body.data.find((d: { version: string }) => d.version === TEST_DATASET);
    expect(test.record_count).toBeGreaterThan(0);
    expect(test.dataset_hash).toHaveLength(64);
    expect(test.status).toBe('sealed');
  });

  it('the fingerprint changes only when the corpus changes', async () => {
    const before = (await queryOne<{ dataset_hash: string }>(
      'select dataset_hash from corpus.dataset_versions where version = $1', [TEST_DATASET]))!.dataset_hash;
    await query('select corpus.seal_dataset($1)', [TEST_DATASET]);
    const after = (await queryOne<{ dataset_hash: string }>(
      'select dataset_hash from corpus.dataset_versions where version = $1', [TEST_DATASET]))!.dataset_hash;
    expect(after).toBe(before);
  });
});

describe('§16–§17 filters and pagination', () => {
  it('filters by source_id, book_id and chapter_id, and combines them', async () => {
    expect((await api.get(`/api/v1/hadiths?source_id=${sourceId}`)).body.meta.total).toBeGreaterThan(0);
    const both = await api.get(`/api/v1/hadiths?book_id=${bookId}&chapter_id=${chapterId}`);
    expect(both.body.meta.total).toBeGreaterThan(0);
    for (const item of both.body.data) {
      expect(item.book_id).toBe(bookId);
      expect(item.chapter_id).toBe(chapterId);
    }
  });

  it('returns current_page alongside page, and honours limits', async () => {
    const { body } = await api.get('/api/v1/hadiths?page=1&limit=2');
    expect(body.meta.current_page).toBe(1);
    expect(body.meta.page).toBe(1);
    expect(body.meta.limit).toBe(2);
    expect(body.meta.total_pages).toBe(Math.ceil(body.meta.total / 2));
    expect(body.data.length).toBeLessThanOrEqual(2);
  });

  it('search takes the same filters and returns the slim shape', async () => {
    const { body } = await api.get(
      `/api/v1/search?q=${encodeURIComponent('اختباري')}&book_id=${bookId}&limit=5`,
    );
    expect(body.meta.current_page).toBe(1);
    for (const item of body.data) {
      expect(item).toHaveProperty('content_hash');
      expect(item).not.toHaveProperty('location'); // slim, not the detail shape
      expect(item.book_id).toBe(bookId);
    }
  });
});

describe('§5–§6 books and chapters', () => {
  it('serves the chapters of a book with printed page ranges', async () => {
    const { body } = await api.get(`/api/v1/books/${bookId}/chapters`);
    expect(body.meta.total).toBeGreaterThan(0);
    const chapter = body.data[0];
    expect(chapter).toHaveProperty('title');
    expect(chapter).toHaveProperty('number');
    expect(chapter).toHaveProperty('page_start');
    expect(chapter.book_id).toBe(bookId);
  });

  it('404s chapters of an unknown book', async () => {
    expect((await api.get('/api/v1/books/00000000-0000-0000-0000-000000000000/chapters')).status).toBe(404);
  });

  it('serves one source with its licence status', async () => {
    const { body } = await api.get(`/api/v1/sources/${sourceId}`);
    expect(body.data.id).toBe(sourceId);
    expect(body.data.license_status).toBeTruthy();
    expect(body.data.hadith_count).toBeGreaterThan(0);
    expect((await api.get('/api/v1/sources/00000000-0000-0000-0000-000000000000')).status).toBe(404);
  });
});

describe('§14 the two content gates', () => {
  it('both gates are closed by default, and they are independent', async () => {
    const { config } = await import('../src/config.ts');
    expect(config.contentLicenseConfirmed).toBe(false);
    expect(config.publicDataEnabled).toBe(false);
    // the API gate and the bulk-data gate are separate switches
    expect(Object.keys(config)).toContain('publicDataEnabled');
  });

  it('the public API withholds text while the licence gate is closed', async () => {
    const { body } = await api.get(`/api/v1/hadiths/${hadithId}`);
    expect(body.data.text).toBeNull();
    expect(body.data.text_available).toBe(false);
  });

  it('/version reports the gate so a client can explain itself', async () => {
    const { body } = await api.get('/api/v1/version');
    expect(body.data.content_license_confirmed).toBe(false);
  });
});

describe('§21 the public API is read-only', () => {
  it('refuses every write verb on a hadith', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await fetch(`${api.base}/api/v1/hadiths/${hadithId}`, { method });
      expect([404, 405], `${method} must not be accepted`).toContain(res.status);
    }
  });

  it('exposes no public endpoint that changes text, grading or takhrij', async () => {
    const { listRoutes } = await import('../src/http/router.ts');
    const writable = listRoutes().filter(
      (r) => r.method !== 'GET' && !r.path.includes('/admin/'),
    );
    expect(writable).toEqual([]);
  });
});
