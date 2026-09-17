import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { startHarness, testUrl, type Harness } from './helpers.ts';

let api: Harness;
let pool: pg.Pool;

beforeAll(async () => {
  api = await startHarness();
  pool = new pg.Pool({ connectionString: testUrl(), max: 3 });
});
afterAll(async () => {
  await pool.end();
  await api.close();
});

describe('declared data schemes', () => {
  it('states which sajdah and page conventions the data follows', async () => {
    const { status, body } = await api.request('/api/v1/schemes');
    expect(status).toBe(200);
    const byKind = new Map<string, Record<string, any>>(
      (body.data as Record<string, any>[]).map((row) => [row.scheme_kind as string, row]),
    );

    const sajdah = byKind.get('sajdah')!;
    expect(sajdah.scheme_code).toBe('tanzil-hafs-15');
    expect(sajdah.observed_summary.count).toBe(15);
    expect(sajdah.observed_summary.positions).toContain('22:77');
    expect(sajdah.alternatives[0].count).toBe(14);

    const page = byKind.get('page')!;
    expect(page.scheme_code).toBe('madani-604-tanzil');
    expect(page.observed_summary.pages).toBe(604);
    expect(page.alternatives[0].differs_for_ayahs).toBe(56);
  });

  it('keeps both decisions PENDING until the owner makes them', async () => {
    const { body } = await api.request('/api/v1/schemes');
    expect(body.data.every((row: { decision_status: string }) => row.decision_status === 'PENDING')).toBe(true);
    expect(body.meta.pending).toBe(2);
  });

  it('reports the scheme state in /version too', async () => {
    const { body } = await api.request('/api/v1/version');
    expect(body.data.declared_schemes).toHaveLength(2);
    expect(body.data.integrity_status).toBe('automated_verified');
    expect(body.data.integrity.ayahs).toBe(6236);
    expect(body.data.integrity.unverified).toBe(0);
    expect(body.data.data_status).toBe('verified'); // never `published` without a human
    expect(body.data.schema.migrations_applied).toBe('007');
  });

  it('refuses to confirm a scheme without a named person', async () => {
    await expect(
      pool.query(
        `update quran.data_schemes set decision_status = 'CONFIRMED' where scheme_kind = 'sajdah'`,
      ),
    ).rejects.toThrow(/SCHEME_DECISION_REQUIRES_OWNER/);
  });

  it('accepts a confirmation that names the decider, and dates it', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query<{ decision_status: string; decided_at: string | null }>(
        `update quran.data_schemes
         set decision_status = 'CONFIRMED', decided_by = 'اختبار آلي'
         where scheme_kind = 'page'
         returning decision_status, decided_at`,
      );
      expect(rows[0]!.decision_status).toBe('CONFIRMED');
      expect(rows[0]!.decided_at).not.toBeNull();
      await client.query('rollback'); // leave the suite's state untouched
    } finally {
      client.release();
    }
  });
});

describe('catalogue detail', () => {
  it('carries source, versions, checksum and verification state per category', async () => {
    const { rows } = await pool.query<{
      category: string; source: string | null; source_version: string | null;
      dataset_version: string | null; checksum_status: string; verification_status: string;
      availability: string; notes: string | null;
    }>('select * from quran.data_catalog where category in (\'quran_text\', \'pages\', \'audio_files\')');

    const quranText = rows.find((row) => row.category === 'quran_text')!;
    expect(quranText.source).toBe('quran-json');
    expect(quranText.source_version).toBe('3.1.2');
    expect(quranText.dataset_version).toBe('test-1');
    expect(quranText.checksum_status).toBe('complete');
    expect(quranText.verification_status).toBe('automated_verified');
    // Licence is not confirmed, so it is never "ready" no matter how verified.
    expect(quranText.availability).toBe('private_pending_license');

    expect(rows.find((row) => row.category === 'pages')!.availability).toBe('ready');
    expect(rows.find((row) => row.category === 'audio_files')!.availability).toBe('empty');
  });
});
