import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import {
  createTestUser,
  startHarness,
  testUrl,
  TEST_JWT_SECRET,
  type Harness,
} from './helpers.ts';
import { signSupabaseJwt } from '../src/auth/jwt.ts';
import { withRls } from '../src/db/pool.ts';
import { contentHash } from '../src/core/hash.ts';

let api: Harness;
let userA: { id: string; token: string };
let userB: { id: string; token: string };
let ayahId: string;
let secondAyahId: string;

beforeAll(async () => {
  api = await startHarness();
  userA = await createTestUser(api.pool);
  userB = await createTestUser(api.pool);
  const { rows } = await api.pool.query<{ id: string }>(
    'select id from quran.ayahs order by global_ayah_number limit 2',
  );
  ayahId = rows[0]!.id;
  secondAyahId = rows[1]!.id;
});
afterAll(async () => {
  await api.close();
});

describe('authentication', () => {
  it('rejects anonymous, malformed and forged tokens on user endpoints', async () => {
    expect((await api.request('/api/v1/me/bookmarks')).status).toBe(401);
    expect(
      (await api.request('/api/v1/me/bookmarks', { headers: { authorization: 'Basic abc' } })).status,
    ).toBe(401);
    expect((await api.request('/api/v1/me/bookmarks', { token: 'forged.token.value' })).status).toBe(401);
  });

  it('accepts a valid Supabase token', async () => {
    const { status, body } = await api.request('/api/v1/me/bookmarks', { token: userA.token });
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
  });
});

describe('user data lifecycle', () => {
  it('creates, lists and deletes bookmarks', async () => {
    const created = await api.request('/api/v1/me/bookmarks', {
      method: 'POST',
      token: userA.token,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ayah_id: ayahId, note: 'أول آية' }),
    });
    expect(created.status).toBe(201);

    const list = await api.request('/api/v1/me/bookmarks', { token: userA.token });
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ surah_number: 1, ayah_number: 1 });

    const removed = await api.request(`/api/v1/me/bookmarks/${ayahId}`, {
      method: 'DELETE',
      token: userA.token,
    });
    expect(removed.status).toBe(200);
    expect((await api.request(`/api/v1/me/bookmarks/${ayahId}`, { method: 'DELETE', token: userA.token })).status).toBe(404);
  });

  it('stores reading progress and settings', async () => {
    const progress = await api.request('/api/v1/me/progress', {
      method: 'PUT',
      token: userA.token,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ayah_id: secondAyahId }),
    });
    expect(progress.status).toBe(200);
    const read = await api.request('/api/v1/me/progress', { token: userA.token });
    expect(read.body.data[0].ayah_id).toBe(secondAyahId);

    const settings = await api.request('/api/v1/me/settings', {
      method: 'PUT',
      token: userA.token,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ autoplay_next_ayah: false, selected_quality: '128' }),
    });
    expect(settings.body.data.autoplay_next_ayah).toBe(false);
  });

  it('turns a token for an unknown user into a 4xx, not a 500', async () => {
    const ghost = signSupabaseJwt(
      { sub: '11111111-1111-1111-1111-111111111111', role: 'authenticated' },
      TEST_JWT_SECRET,
    );
    const { status, body } = await api.request('/api/v1/me/bookmarks', {
      method: 'POST',
      token: ghost,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ayah_id: ayahId }),
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(body)).not.toMatch(/constraint|foreign key|postgres/i);
  });

  it('rejects malformed JSON and invalid ids', async () => {
    const malformed = await api.request('/api/v1/me/bookmarks', {
      method: 'POST',
      token: userA.token,
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('BAD_REQUEST');

    const invalid = await api.request('/api/v1/me/favorites', {
      method: 'POST',
      token: userA.token,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ayah_id: 'abc' }),
    });
    expect(invalid.status).toBe(422);
  });
});

describe('row level security', () => {
  it('keeps one user from reading another user data through the API', async () => {
    await api.request('/api/v1/me/favorites', {
      method: 'POST',
      token: userA.token,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ayah_id: ayahId }),
    });
    const other = await api.request('/api/v1/me/favorites', { token: userB.token });
    expect(other.body.data).toEqual([]);
  });

  it('enforces RLS at the database level, not only in the API', async () => {
    const pool = new pg.Pool({ connectionString: testUrl(), max: 2 });
    try {
      const visibleToB = await withRls(pool, userB.id, (client) =>
        client.query('select id from quran.user_favorites'),
      );
      expect(visibleToB.rowCount).toBe(0);

      const visibleToA = await withRls(pool, userA.id, (client) =>
        client.query('select id from quran.user_favorites'),
      );
      expect(visibleToA.rowCount).toBe(1);

      // Inserting a row for someone else is refused by the WITH CHECK policy.
      await expect(
        withRls(pool, userB.id, (client) =>
          client.query('insert into quran.user_favorites (user_id, ayah_id) values ($1, $2)', [
            userA.id,
            secondAyahId,
          ]),
        ),
      ).rejects.toThrow(/row-level security/i);
    } finally {
      await pool.end();
    }
  });

  it('makes the public catalogue read-only for anon and authenticated roles', async () => {
    const pool = new pg.Pool({ connectionString: testUrl(), max: 2 });
    try {
      await expect(
        withRls(pool, null, (client) =>
          client.query(`update quran.ayahs set raw_text = 'tampered'`),
        ),
      ).rejects.toThrow(/permission denied|row-level security/i);

      await expect(
        withRls(pool, userA.id, (client) =>
          client.query(`delete from quran.surahs`),
        ),
      ).rejects.toThrow(/permission denied|row-level security/i);

      const readable = await withRls(pool, null, (client) =>
        client.query('select count(*)::int as count from quran.ayahs'),
      );
      expect(readable.rows[0].count).toBe(6236);
    } finally {
      await pool.end();
    }
  });
});

describe('source lock', () => {
  it('refuses any update of raw_text even with full privileges', async () => {
    await expect(
      api.pool.query(`update quran.ayahs set raw_text = raw_text || 'x' where ayah_number = 1`),
    ).rejects.toThrow(/SOURCE_LOCK/);
  });

  it('allows derived columns to be updated', async () => {
    await expect(
      api.pool.query(`update quran.ayahs set search_text = search_text where id = $1`, [ayahId]),
    ).resolves.toBeTruthy();
  });
});

describe('integrity in the database', () => {
  it('has no duplicate or missing ayahs and every hash matches its text', async () => {
    const { rows } = await api.pool.query<{ check: string; value: number }>(`
      select 'duplicates' as check, count(*)::int as value from (
        select surah_id, ayah_number from quran.ayahs group by 1,2 having count(*) > 1
      ) d
      union all
      select 'count_mismatch', count(*)::int from (
        select s.id from quran.surahs s
        join quran.ayahs a on a.surah_id = s.id
        group by s.id, s.ayah_count having count(a.id) <> s.ayah_count
      ) m
      union all
      select 'unverified', count(*)::int from quran.ayahs where not verified
      union all
      select 'orphan_translations', count(*)::int from quran.ayah_translations at
        left join quran.ayahs a on a.id = at.ayah_id where a.id is null
    `);
    for (const row of rows) expect([row.check, row.value]).toEqual([row.check, 0]);
  });

  it('recomputes every stored hash from the stored text', async () => {
    const { rows } = await api.pool.query<{ raw_text: string; content_hash: string }>(
      'select raw_text, content_hash from quran.ayahs',
    );
    expect(rows).toHaveLength(6236);
    const mismatches = rows.filter((row) => contentHash(row.raw_text) !== row.content_hash);
    expect(mismatches).toHaveLength(0);
  });

  it('keeps every source character, including the thin space in 2:72', async () => {
    const { rows } = await api.pool.query<{ raw_text: string }>(
      `select a.raw_text from quran.ayahs a join quran.surahs s on s.id = a.surah_id
       where s.surah_number = 2 and a.ayah_number = 72`,
    );
    expect(rows[0]!.raw_text).toContain('\u2009');
  });
});
