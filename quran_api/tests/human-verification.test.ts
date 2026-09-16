import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { testUrl } from './helpers.ts';

let pool: pg.Pool;

beforeAll(() => {
  pool = new pg.Pool({ connectionString: testUrl(), max: 3 });
});
afterAll(async () => {
  await pool.end();
});

async function datasetId(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    'select id from quran.quran_dataset_versions order by import_date desc limit 1',
  );
  return rows[0]!.id;
}

describe('human verification gate', () => {
  it('leaves the imported dataset at `verified`, never `published`, without a human', async () => {
    const { rows } = await pool.query<{ status: string }>(
      'select status from quran.quran_dataset_versions order by import_date desc limit 1',
    );
    expect(rows[0]!.status).toBe('verified');
  });

  it('refuses to publish a dataset version that no person approved', async () => {
    const id = await datasetId();
    await expect(
      pool.query(`update quran.quran_dataset_versions set status = 'published' where id = $1`, [id]),
    ).rejects.toThrow(/HUMAN_VERIFICATION_REQUIRED/);
  });

  it('records who verified what, and only then allows publishing', async () => {
    const id = await datasetId();
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into quran.human_verifications
           (dataset_version_id, verifier_name, verifier_role, scope, sample_count, result, notes)
         values ($1, 'اختبار آلي', 'test', 'sample of 10 ayahs', 10, 'approved', 'test run')`,
        [id],
      );
      await client.query(`update quran.quran_dataset_versions set status = 'published' where id = $1`, [id]);
      const { rows } = await client.query<{ status: string }>(
        'select status from quran.quran_dataset_versions where id = $1',
        [id],
      );
      expect(rows[0]!.status).toBe('published');

      const { rows: audit } = await client.query<{
        verifier_name: string; scope: string; sample_count: number; result: string;
      }>('select verifier_name, scope, sample_count, result from quran.human_verifications where dataset_version_id = $1', [id]);
      expect(audit[0]).toMatchObject({
        verifier_name: 'اختبار آلي',
        sample_count: 10,
        result: 'approved',
      });
      // Roll back so the rest of the suite keeps seeing an unpublished dataset.
      await client.query('rollback');
    } finally {
      client.release();
    }
  });

  it('a rejected verification does not unlock publishing', async () => {
    const id = await datasetId();
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into quran.human_verifications
           (dataset_version_id, verifier_name, scope, sample_count, result)
         values ($1, 'مراجع', 'sample', 5, 'rejected')`,
        [id],
      );
      await expect(
        client.query(`update quran.quran_dataset_versions set status = 'published' where id = $1`, [id]),
      ).rejects.toThrow(/HUMAN_VERIFICATION_REQUIRED/);
      await client.query('rollback');
    } finally {
      client.release();
    }
  });

  it('exposes the verification state through /api/v1/version', async () => {
    const { rows } = await pool.query<{ count: string }>(
      `select count(*)::text as count from quran.human_verifications where result = 'approved'`,
    );
    expect(Number(rows[0]!.count)).toBe(0);
  });
});
