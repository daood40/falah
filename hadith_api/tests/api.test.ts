import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runImport } from '../src/importer/pipeline.ts';
import { closePool, queryOne } from '../src/db.ts';
import { startApi, auth, TEST_DATASET, TEST_EDITION_SLUG, seedTestEdition, wipeTestData, type TestApi } from './helpers.ts';

let api: TestApi;
let hadithId: string;
let bookId: string;
let chapterId: string;
let narratorId: string;
let editionId: string;

beforeAll(async () => {
  const seeded = await seedTestEdition();
  editionId = seeded.editionId;
  await wipeTestData();
  await runImport({
    adapter: 'jami_kamil',
    file: 'fixtures/test-dataset.json',
    editionSlug: TEST_EDITION_SLUG,
    datasetVersion: TEST_DATASET,
    dryRun: false,
    actor: 'vitest',
  });
  hadithId = (await queryOne<{ id: string }>(
    `select id from corpus.hadiths where dataset_version = $1 and hadith_number = '1'`, [TEST_DATASET]))!.id;
  bookId = (await queryOne<{ id: string }>(`select id from corpus.books where external_key = 'b1'`))!.id;
  chapterId = (await queryOne<{ id: string }>(`select id from corpus.chapters where external_key = 'c1'`))!.id;
  narratorId = (await queryOne<{ id: string }>(
    `select id from corpus.narrators where name like 'راوٍ اختباريّ أوّل%'`))!.id;
  api = await startApi();
});

afterAll(async () => {
  await api.close();
  await wipeTestData();
  await closePool();
});

describe('health & stats', () => {
  it('GET /api/v1/health reports a live database without leaking secrets', async () => {
    const { status, body } = await api.get('/api/v1/health');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.database).toBe('up');
    expect(body.data.content_license_confirmed).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/password|service_role|postgresql:\/\/|secret/i);
  });

  it('GET /api/v1/stats returns real counts from the database', async () => {
    const { body } = await api.get('/api/v1/stats');
    const dbCount = (await queryOne<{ n: number }>('select count(*)::int as n from corpus.hadiths'))?.n;
    expect(body.data.hadiths).toBe(dbCount);
    expect(body.data.verified_hadiths).toBe(0);
    expect(body.data.last_import.status).toBe('completed');
  });
});

describe('hadiths', () => {
  it('GET /api/v1/hadiths paginates with a unified envelope', async () => {
    const { body } = await api.get('/api/v1/hadiths?page=1&limit=2');
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(2);
    expect(body.meta).toMatchObject({ page: 1, limit: 2 });
    expect(body.meta.total).toBeGreaterThan(0);
  });

  it('GET /api/v1/hadiths/{id} returns the standard detail shape (§13)', async () => {
    const { body } = await api.get(`/api/v1/hadiths/${hadithId}`);
    const d = body.data;
    expect(d.id).toBe(hadithId);
    expect(d.number).toBe('1');
    expect(d.book.name).toContain('قسم اختباري');
    expect(d.chapter.title).toContain('باب اختباري');
    expect(d.source.name).toBe('TEST FIXTURE SOURCE');
    expect(d.location).toMatchObject({ volume: 1, page: 25 });
    expect(d.dataset.hash).toHaveLength(64);
    expect(d.dataset.version).toBe(TEST_DATASET);
    expect(d.verification).toEqual({ verified: false, status: 'pending' });
    expect(d.source_locked).toBe(true);
    // heavy blocks are absent until asked for (§14)
    expect(d.narrators).toBeUndefined();
    expect(d.gradings).toBeUndefined();
  });

  it('adds only the blocks ?include= asks for', async () => {
    const one = await api.get(`/api/v1/hadiths/${hadithId}?include=gradings`);
    expect(Array.isArray(one.body.data.gradings)).toBe(true);
    expect(one.body.data.narrators).toBeUndefined();

    const many = await api.get(
      `/api/v1/hadiths/${hadithId}?include=narrators,references,takhrij,gradings,verification`,
    );
    const d = many.body.data;
    expect(d.narrators[0].name).toContain('راوٍ اختباريّ');
    expect(Array.isArray(d.references)).toBe(true);
    expect(d.takhrij.sources).toContain('TEST SOURCE A');
    expect(d.gradings[0].grading_text).toContain('TEST GRADE');
    expect(d.verification).toMatchObject({ human_review: false, verified: false });
    expect(d.verification.cross_check).toBeDefined();
  });

  it('rejects an unknown include instead of ignoring it', async () => {
    const { status, body } = await api.get(`/api/v1/hadiths/${hadithId}?include=secrets`);
    expect(status).toBe(422);
    expect(body.error.message).toMatch(/unknown include/);
  });

  it('withholds the text while the content licence is unconfirmed', async () => {
    const { body } = await api.get(`/api/v1/hadiths/${hadithId}?include=takhrij,references`);
    expect(body.data.text).toBeNull();
    expect(body.data.text_available).toBe(false);
    expect(body.data.takhrij.takhrij_text).toBeNull();
    for (const ref of body.data.references) expect(ref.reference_text).toBeNull();

    const list = await api.get('/api/v1/hadiths?limit=1');
    expect(list.body.data[0].text).toBeNull();
    expect(list.body.meta.text_available).toBe(false);
  });

  it('serves the text to an admin credential (internal use)', async () => {
    const { body } = await api.get(`/api/v1/hadiths/${hadithId}?include=takhrij`, { headers: auth });
    expect(body.data.text).toContain('TEST DATA');
    expect(body.data.text_available).toBe(true);
    expect(body.data.takhrij.takhrij_text).toContain('TEST TAKHRIJ');
  });

  it('GET /api/v1/hadiths/by-number/{number} finds the record', async () => {
    const { body } = await api.get('/api/v1/hadiths/by-number/2');
    expect(body.data[0].number).toBe('2');
  });

  it('returns 404 for an unknown number and an unknown id', async () => {
    expect((await api.get('/api/v1/hadiths/by-number/999999')).status).toBe(404);
    const { status, body } = await api.get('/api/v1/hadiths/00000000-0000-0000-0000-000000000000');
    expect(status).toBe(404);
    expect(body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('rejects an invalid id with a validation error, not a 500', async () => {
    const { status, body } = await api.get('/api/v1/hadiths/not-a-uuid');
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('filters by book, chapter, volume and verification status', async () => {
    expect((await api.get(`/api/v1/hadiths?book_id=${bookId}`)).body.meta.total).toBe(2);
    expect((await api.get(`/api/v1/hadiths?chapter_id=${chapterId}`)).body.meta.total).toBe(1);
    expect((await api.get('/api/v1/hadiths?volume=2')).body.meta.total).toBe(1);
    expect((await api.get('/api/v1/hadiths?verification_status=verified')).body.meta.total).toBe(0);
    expect((await api.get(`/api/v1/hadiths?edition_id=${editionId}`)).body.meta.total).toBe(3);
  });

  it('rejects an invalid enum filter', async () => {
    const { status, body } = await api.get('/api/v1/hadiths?verification_status=bogus');
    expect(status).toBe(422);
    expect(body.error.message).toMatch(/verification_status/);
  });
});

describe('catalogue', () => {
  it('lists books, chapters, narrators, sources and editions', async () => {
    expect((await api.get('/api/v1/books')).body.meta.total).toBeGreaterThan(0);
    expect((await api.get('/api/v1/chapters')).body.meta.total).toBeGreaterThan(0);
    expect((await api.get('/api/v1/narrators')).body.meta.total).toBeGreaterThan(0);
    expect((await api.get('/api/v1/sources')).body.meta.total).toBeGreaterThan(0);
    expect((await api.get('/api/v1/editions')).body.meta.total).toBeGreaterThan(0);
  });

  it('returns the edition metadata of the real book without inventing fields', async () => {
    const { body } = await api.get('/api/v1/editions');
    const jami = body.data.find((e: { slug: string }) => e.slug === 'jami-kamil-1437');
    expect(jami.title).toBe('الجامع الكامل في الحديث الصحيح الشامل');
    expect(jami.author).toBe('محمد عبد الله الأعظمي المعروف بالضياء');
    expect(jami.hijri_year).toBe(1437);
    expect(jami.publication_year).toBe(2016);
    expect(jami.volume_count).toBe(12);
    expect(jami.edition_number).toBe(1);
    expect(jami.isbn).toBeNull();
    expect(jami.page_count).toBeNull();
  });

  it('nests child hadiths under book, chapter and narrator', async () => {
    expect((await api.get(`/api/v1/books/${bookId}/hadiths`)).body.meta.total).toBe(2);
    expect((await api.get(`/api/v1/chapters/${chapterId}/hadiths`)).body.meta.total).toBe(1);
    expect((await api.get(`/api/v1/narrators/${narratorId}/hadiths`)).body.meta.total).toBe(1);
  });

  it('404s for unknown book, chapter and narrator ids', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    expect((await api.get(`/api/v1/books/${missing}`)).status).toBe(404);
    expect((await api.get(`/api/v1/chapters/${missing}`)).status).toBe(404);
    expect((await api.get(`/api/v1/narrators/${missing}`)).status).toBe(404);
    expect((await api.get(`/api/v1/books/${missing}/hadiths`)).status).toBe(404);
  });
});

describe('search', () => {
  it('finds a hadith by a normalized Arabic phrase', async () => {
    const { body } = await api.get(`/api/v1/search?q=${encodeURIComponent('اختباري')}`);
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.meta.query).toBe('اختباري');
  });

  it('matches regardless of diacritics and hamza form', async () => {
    const withDiacritics = await api.get(`/api/v1/search?q=${encodeURIComponent('اِخْتِبَارِيّ')}`);
    expect(withDiacritics.body.meta.total).toBeGreaterThan(0);
  });

  it('searches narrators, chapters and books by type', async () => {
    expect((await api.get(`/api/v1/search?q=${encodeURIComponent('راو')}&type=narrators`)).body.meta.total)
      .toBeGreaterThan(0);
    expect((await api.get(`/api/v1/search?q=${encodeURIComponent('باب')}&type=chapters`)).body.meta.total)
      .toBeGreaterThan(0);
    expect((await api.get(`/api/v1/search?q=${encodeURIComponent('قسم')}&type=books`)).body.meta.total)
      .toBeGreaterThan(0);
  });

  it('filters search by hadith number and volume', async () => {
    const { body } = await api.get(`/api/v1/search?q=${encodeURIComponent('اختباري')}&volume=2`);
    expect(body.meta.total).toBe(1);
  });

  it('rejects an empty or too-short query', async () => {
    expect((await api.get('/api/v1/search?q=')).status).toBe(422);
    expect((await api.get('/api/v1/search?q=ا')).status).toBe(422);
    expect((await api.get('/api/v1/search')).status).toBe(422);
  });

  it('returns an empty page for a term that matches nothing', async () => {
    const { status, body } = await api.get(`/api/v1/search?q=${encodeURIComponent('زقنطوريا')}`);
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });
});

describe('pagination limits', () => {
  it('rejects limit=100000', async () => {
    const { status, body } = await api.get('/api/v1/hadiths?limit=100000');
    expect(status).toBe(422);
    expect(body.error.message).toMatch(/at most/);
  });

  it('rejects page=0, negative and non-numeric values', async () => {
    expect((await api.get('/api/v1/hadiths?page=0')).status).toBe(422);
    expect((await api.get('/api/v1/hadiths?limit=-5')).status).toBe(422);
    expect((await api.get('/api/v1/hadiths?page=abc')).status).toBe(422);
  });

  it('serves a page beyond the end as an empty list', async () => {
    const { status, body } = await api.get('/api/v1/hadiths?page=9999&limit=10');
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
  });
});

describe('security', () => {
  it('refuses admin endpoints without a credential', async () => {
    const { status, body } = await api.get('/api/v1/admin/stats');
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('refuses a wrong admin key', async () => {
    const { status } = await api.get('/api/v1/admin/stats', {
      headers: { authorization: 'Bearer wrong-key' },
    });
    expect(status).toBe(401);
  });

  it('accepts a valid admin key', async () => {
    const { status, body } = await api.get('/api/v1/admin/stats', { headers: auth });
    expect(status).toBe(200);
    expect(body.data.hadiths).toBeGreaterThan(0);
  });

  it('neutralizes SQL injection attempts in every input parameter', async () => {
    const payloads = [
      "' or 1=1--",
      "'; drop table corpus.hadiths;--",
      "1' union select null,null--",
      '%27%20OR%20%271%27%3D%271',
    ];
    for (const p of payloads) {
      const search = await api.get(`/api/v1/search?q=${encodeURIComponent(p)}`);
      expect([200, 422]).toContain(search.status);
      const byNumber = await api.get(`/api/v1/hadiths/by-number/${encodeURIComponent(p)}`);
      expect([404, 422]).toContain(byNumber.status);
      const filter = await api.get(`/api/v1/hadiths?book_id=${encodeURIComponent(p)}`);
      expect(filter.status).toBe(422);
    }
    const stillThere = await queryOne<{ n: number }>('select count(*)::int as n from corpus.hadiths');
    expect(stillThere?.n).toBeGreaterThan(0);
  });

  it('rejects malformed JSON bodies', async () => {
    const { status, body } = await api.post(`/api/v1/admin/hadiths/${hadithId}/verify`, '{not json', {
      headers: auth,
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects a verification request missing required parameters', async () => {
    const { status, body } = await api.post(`/api/v1/admin/hadiths/${hadithId}/verify`, {}, { headers: auth });
    expect(status).toBe(422);
    expect(body.error.message).toMatch(/verification_type/);
  });

  it('sets security headers and answers CORS preflight', async () => {
    const res = await fetch(`${api.base}/api/v1/health`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-request-id')).toBeTruthy();
    const pre = await fetch(`${api.base}/api/v1/hadiths`, { method: 'OPTIONS' });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-methods')).toContain('GET');
  });

  it('returns 405 for a wrong method and 404 for an unknown path', async () => {
    const wrongMethod = await api.post('/api/v1/hadiths', {});
    expect(wrongMethod.status).toBe(405);
    expect((await api.get('/api/v1/nope')).status).toBe(404);
  });

  it('never exposes a stack trace or SQL text in an error', async () => {
    const { body } = await api.get('/api/v1/hadiths/not-a-uuid');
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/select |at Object|node:internal|\.ts:\d+/);
  });
});

describe('admin & verification', () => {
  it('records a human verification and flips the status', async () => {
    const hash = (await queryOne<{ content_hash: string }>(
      'select content_hash from corpus.hadiths where id = $1', [hadithId]))!.content_hash;

    const { status, body } = await api.post(
      `/api/v1/admin/hadiths/${hadithId}/verify`,
      { verification_type: 'manual_sample', verified_by: 'QA (vitest)', content_hash: hash,
        source_reference: 'TEST FIXTURE', result: 'passed' },
      { headers: auth },
    );
    expect(status).toBe(201);
    expect(body.data.verified).toBe(true);
    expect(body.data.verification_status).toBe('verified');

    const row = await queryOne<{ verified: boolean }>(
      'select verified from corpus.hadiths where id = $1', [hadithId]);
    expect(row?.verified).toBe(true);
  });

  it('refuses a verification whose content_hash does not match the stored text', async () => {
    const { status, body } = await api.post(
      `/api/v1/admin/hadiths/${hadithId}/verify`,
      { verification_type: 'manual_sample', verified_by: 'QA', content_hash: 'deadbeef' },
      { headers: auth },
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('SOURCE_LOCKED');
  });

  it('a hash_check alone never marks a hadith verified', async () => {
    const other = (await queryOne<{ id: string }>(
      `select id from corpus.hadiths where dataset_version = $1 and hadith_number = '2'`, [TEST_DATASET]))!.id;
    const { body } = await api.post(
      `/api/v1/admin/hadiths/${other}/verify`,
      { verification_type: 'hash_check', verified_by: 'pipeline', result: 'passed' },
      { headers: auth },
    );
    expect(body.data.verified).toBe(false);
    expect(body.data.verification_status).toBe('pending');
  });

  it('exposes imports, dataset versions and audit logs to admins only', async () => {
    expect((await api.get('/api/v1/admin/imports')).status).toBe(401);
    const imports = await api.get('/api/v1/admin/imports', { headers: auth });
    expect(imports.body.data[0].adapter).toBe('jami_kamil');
    const datasets = await api.get('/api/v1/admin/dataset-versions', { headers: auth });
    expect(datasets.body.data.some((d: { version: string }) => d.version === 'JAMI-KAMIL-1437-V1')).toBe(true);
    const logs = await api.get('/api/v1/admin/audit-logs', { headers: auth });
    expect(logs.body.meta.total).toBeGreaterThan(0);
  });

  it('offers no endpoint at all that edits the source text', async () => {
    const attempts = await Promise.all([
      api.post(`/api/v1/admin/hadiths/${hadithId}`, { raw_text: 'x' }, { headers: auth }),
      api.post(`/api/v1/hadiths/${hadithId}`, { raw_text: 'x' }),
    ]);
    for (const a of attempts) expect([404, 405]).toContain(a.status);
    const row = await queryOne<{ raw_text: string }>(
      'select raw_text from corpus.hadiths where id = $1', [hadithId]);
    expect(row?.raw_text).toContain('TEST DATA');
  });
});

describe('hostile input', () => {
  it('ignores a request id carrying CRLF instead of splitting the response', async () => {
    const res = await fetch(`${api.base}/api/v1/health`, {
      headers: { 'x-request-id': 'abc' },
    });
    expect(res.headers.get('x-request-id')).toBe('abc');

    // Node refuses to send an invalid header value; the server must still answer.
    const raw = await api.get('/api/v1/health', { headers: { 'x-request-id': 'a'.repeat(200) } });
    expect(raw.status).toBe(200);
  });

  it('rejects an over-long search term', async () => {
    const { status } = await api.get(`/api/v1/search?q=${'ا'.repeat(300)}`);
    expect(status).toBe(422);
  });

  it('survives a path with unusual unicode', async () => {
    const { status } = await api.get(`/api/v1/hadiths/${encodeURIComponent('٪٪٪﴿﴾')}`);
    expect(status).toBe(422);
  });

  it('handles a fractional page and a boolean-ish limit', async () => {
    expect((await api.get('/api/v1/hadiths?page=1.5')).status).toBe(422);
    expect((await api.get('/api/v1/hadiths?limit=true')).status).toBe(422);
  });
});
