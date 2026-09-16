import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { createTestUser, startHarness, testUrl, type Harness } from './helpers.ts';

let api: Harness;
let pool: pg.Pool;
let token: string;

beforeAll(async () => {
  api = await startHarness();
  pool = new pg.Pool({ connectionString: testUrl(), max: 3 });
  token = (await createTestUser(api.pool)).token;
});
afterAll(async () => {
  await pool.end();
  await api.close();
});

describe('license center', () => {
  it('is internal: anonymous callers get 401', async () => {
    const { status, body } = await api.request('/api/v1/licenses');
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('lists a record for every licensable dataset kind', async () => {
    const { status, body } = await api.request('/api/v1/licenses', { token });
    expect(status).toBe(200);
    const kinds = new Set(body.data.map((row: { dataset_kind: string }) => row.dataset_kind));
    for (const kind of [
      'software', 'quran_text', 'translation', 'tafsir', 'audio', 'reciter',
      'qiraat', 'riwayat', 'word_by_word', 'morphology', 'tajweed', 'metadata',
    ]) {
      expect(kinds).toContain(kind);
    }
    expect(body.meta.summary.length).toBeGreaterThan(0);
  });

  it('records the real state: Quran text restricted, translations pending', async () => {
    const { body } = await api.request('/api/v1/licenses', { token });
    const rows: { dataset_kind: string; subject: string; status: string }[] = body.data;
    const quranText = rows.find((row) => row.dataset_kind === 'quran_text');
    expect(quranText?.status).toBe('RESTRICTED');

    // The ledger covers every translation the registry knows about, not only
    // the ones imported in this run — an unimported translation still has a
    // licence question to answer.
    const translations = rows.filter((row) => row.dataset_kind === 'translation');
    expect(translations).toHaveLength(10);
    expect(translations.every((row) => row.status === 'PENDING')).toBe(true);

    const audio = rows.find((row) => row.dataset_kind === 'audio');
    expect(audio?.status).toBe('UNKNOWN');
  });

  it('refuses CONFIRMED without evidence', async () => {
    await expect(
      pool.query(
        `insert into quran.license_records (dataset_kind, subject, status, redistribution)
         values ('tafsir', 'test-no-evidence', 'CONFIRMED', 'allowed')`,
      ),
    ).rejects.toThrow(/LICENSE_EVIDENCE_REQUIRED/);
  });

  it('refuses CONFIRMED while redistribution is unknown', async () => {
    await expect(
      pool.query(
        `insert into quran.license_records (dataset_kind, subject, status, evidence)
         values ('tafsir', 'test-unknown-redistribution', 'CONFIRMED', 'signed letter, file X')`,
      ),
    ).rejects.toThrow(/LICENSE_EVIDENCE_REQUIRED/);
  });

  it('accepts CONFIRMED when evidence and permissions are recorded', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into quran.license_records
           (dataset_kind, subject, status, redistribution, commercial_use, evidence, recorded_by)
         values ('tafsir', 'test-with-evidence', 'CONFIRMED', 'allowed', 'allowed',
                 'written permission dated 2026-09-16, owner_dropzone/licenses/test.pdf', 'owner')`,
      );
      const { rows } = await client.query<{ all_confirmed: boolean }>(
        `select all_confirmed from quran.license_gate where dataset_kind = 'tafsir'`,
      );
      expect(rows[0]?.all_confirmed).toBe(false); // the UNKNOWN placeholder is still there
      await client.query('rollback');
    } finally {
      client.release();
    }
  });
});
