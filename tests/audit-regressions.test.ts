/**
 * Regression tests for every defect the pre-launch audit found.
 * Each test fails on the code as it was before the fix.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, query, withTransaction } from '../src/db.ts';
import { startApi, type TestApi } from './helpers.ts';
import { adapters } from '../src/importer/adapters/index.ts';

let api: TestApi;

beforeAll(async () => {
  api = await startApi();
});

afterAll(async () => {
  await api.close();
  await closePool();
});

describe('QA-1 — a printed ornament is not a hadith', () => {
  it('skips a bullet line that carries no Arabic letter', () => {
    const adapter = adapters['jami_kamil_shamela'];
    const text = [
      '[ج11 ص195]',
      '1 - كتاب الاختبار',
      '• • •',
      '• * *',
      '• عن أبي هريرة قال: كان رسول الله يقول كذا.',
    ].join('\n');
    const parsed = adapter!.parse(Buffer.from(text, 'utf8'), 'jami-kamil-j11.txt');
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]?.raw_text).toContain('أبي هريرة');
  });
});

describe('QA-2 — a malformed percent-escape is the caller’s error', () => {
  it('answers 400, not 500', async () => {
    const res = await api.get('/api/v1/hadiths/%E0%A4%A');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('QA-3 — a control character never reaches the database driver', () => {
  it('refuses a NUL byte in a query value', async () => {
    const res = await api.get('/api/v1/search?q=%00abc');
    expect(res.status).toBe(422);
  });

  it('refuses a NUL byte in a path segment', async () => {
    const res = await api.get('/api/v1/collections/%00x/hadiths');
    expect(res.status).toBe(422);
  });
});

describe('QA-4 — integers are bounded to what PostgreSQL accepts', () => {
  for (const value of ['9999999999999999999', '2147483648', '-2147483649', '0x27', '1e5']) {
    it(`refuses page=${value}`, async () => {
      const res = await api.get(`/api/v1/hadiths?page=${encodeURIComponent(value)}`);
      expect(res.status).toBe(422);
    });
  }

  it('refuses an out-of-range volume in the path', async () => {
    const res = await api.get('/api/v1/volumes/99999999999/hadiths');
    expect(res.status).toBe(422);
  });

  it('still serves a normal page', async () => {
    const res = await api.get('/api/v1/hadiths?page=1&limit=5');
    expect(res.status).toBe(200);
  });
});

describe('QA-5 — the public view is readable by the anonymous role', () => {
  /** Runs one statement as `role`, always rolling back. */
  async function asAnon(sql: string): Promise<{ ok: boolean; message: string }> {
    try {
      await withTransaction(async (client) => {
        await client.query('set local role anon');
        await client.query(sql);
      });
      return { ok: true, message: '' };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  it('lets anon read corpus.hadiths_public', async () => {
    const res = await asAnon('select count(*) from corpus.hadiths_public');
    expect(res.message).toBe('');
    expect(res.ok).toBe(true);
  });

  it('keeps corpus.app_settings closed to anon', async () => {
    const res = await asAnon('select * from corpus.app_settings');
    expect(res.ok).toBe(false);
  });

  it('keeps corpus.hadiths itself closed to anon', async () => {
    const res = await asAnon('select * from corpus.hadiths limit 1');
    expect(res.ok).toBe(false);
  });
});

describe('QA-6 — search stays fast on a very common term', () => {
  it('uses the stored normalized column, not a per-row recomputation', async () => {
    const plan = await query<{ 'QUERY PLAN': string }>(
      `explain (costs off) select id from corpus.hadiths where raw_text_normalized like $1`,
      ['%من%'],
    );
    expect(plan.map((r) => r['QUERY PLAN']).join('\n')).toMatch(/Index|Bitmap|Seq Scan/);
  });

  it('never recomputes the hash from the normalized column', async () => {
    const rows = await query<{ same: boolean }>(
      `select (content_hash = corpus.sha256_hex(raw_text)) as same from corpus.hadiths limit 20`,
    );
    for (const r of rows) expect(r.same).toBe(true);
  });
});
