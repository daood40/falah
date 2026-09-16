import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness, testEnv, type Harness } from './helpers.ts';
import { parseDataset } from '../src/import/parse.ts';

let api: Harness;

beforeAll(async () => {
  api = await startHarness();
});
afterAll(async () => {
  await api.close();
});

describe('system endpoints', () => {
  it('reports health with dataset and licence flags, without secrets', async () => {
    const { status, body } = await api.request('/api/v1/health');
    expect(status).toBe(200);
    expect(body.data.checks.database).toBe('ok');
    expect(body.data.checks.dataset.version).toBe('test-1');
    expect(body.data.license_flags).toEqual({
      contentLicenseConfirmed: false,
      audioLicenseConfirmed: false,
      publicDataEnabled: true,
    });
    expect(JSON.stringify(body)).not.toMatch(/secret|password|postgresql:\/\//i);
  });

  it('reports the API release, dataset version and human-verification state', async () => {
    const { status, body } = await api.request('/api/v1/version');
    expect(status).toBe(200);
    expect(body.data.api_version).toBe('v1');
    expect(body.data.api_release).toMatch(/^\d+\.\d+\.\d+$/);
    expect(body.data.dataset.version).toBe('test-1');
    expect(body.data.dataset.source_file_hash).toHaveLength(64);
    // No human has signed this dataset off in the test run.
    expect(body.data.human_verification.verified).toBe(false);
    expect(body.data.dataset.status).toBe('verified');
    expect(body.data.openapi_url).toBe('/api/v1/openapi.yaml');
  });

  it('serves its own OpenAPI document', async () => {
    const response = await fetch(`${api.baseUrl}/api/v1/openapi.yaml`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/yaml');
    const text = await response.text();
    expect(text).toContain('openapi: 3.1.0');
    expect(text).toContain('/api/v1/surahs');
  });

  it('returns real counts', async () => {
    const { body } = await api.request('/api/v1/stats');
    expect(body.data).toMatchObject({
      surahs: 114,
      ayahs: 6236,
      juzs: 30,
      hizbs: 60,
      rubs: 240,
      pages: 604,
      manzils: 7,
      sajdahs: 15,
      ayah_translations: 6236,
    });
  });

  it('exposes the source registry with licences', async () => {
    const { body } = await api.request('/api/v1/sources');
    const ids = body.data.map((s: any) => s.id);
    expect(ids).toContain('quran-json');
    expect(ids).toContain('quran-meta');
    expect(body.data.every((s: any) => s.license && s.attribution_text)).toBe(true);
  });

  it('sends security headers on every response', async () => {
    const { headers } = await api.request('/api/v1/health');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('x-frame-options')).toBe('DENY');
    expect(headers.get('content-security-policy')).toContain("default-src 'none'");
  });
});

describe('quran endpoints', () => {
  it('lists all 114 surahs in order', async () => {
    const { body } = await api.request('/api/v1/surahs?limit=114');
    expect(body.data).toHaveLength(114);
    expect(body.data[0].surah_number).toBe(1);
    expect(body.data[113].surah_number).toBe(114);
    expect(body.meta.total).toBe(114);
  });

  it('returns an ayah in the documented shape with hash and source', async () => {
    const { body } = await api.request('/api/v1/ayahs/by-key/1:1?translation=en-saheeh');
    const ayah = body.data;
    expect(ayah.ayah_key).toBe('1:1');
    expect(ayah.surah.number).toBe(1);
    // SOURCE_LOCK: the served text is byte-for-byte the source text — not even
    // Unicode normalisation is applied (the source is not in NFC form).
    const sourceAyah = parseDataset([]).ayahs[0]!;
    expect(ayah.text).toBe(sourceAyah.raw_text);
    expect(ayah.text).toContain('\u0671');
    expect(ayah.content_hash).toBe(sourceAyah.content_hash);
    expect(ayah.content_hash).toHaveLength(64);
    expect(ayah.source.id).toBe('quran-json');
    expect(ayah.verification).toEqual({ verified: true, status: 'verified' });
    expect(ayah.edition.riwayah).toBe('hafs');
    expect(ayah.translation.language).toBe('en');
  });

  it('serves the last ayah of the mushaf', async () => {
    const { body } = await api.request('/api/v1/ayahs/by-key/114:6');
    expect(body.data.global_ayah_number).toBe(6236);
    expect(body.data.page).toBe(604);
  });

  it('paginates surah ayahs', async () => {
    const { body } = await api.request('/api/v1/surahs/2/ayahs?limit=5&page=2');
    expect(body.data).toHaveLength(5);
    expect(body.data[0].ayah_number).toBe(6);
    expect(body.meta).toMatchObject({ page: 2, limit: 5, total: 286 });
  });

  it('rejects unknown resources and malformed identifiers', async () => {
    expect((await api.request('/api/v1/surahs/999')).status).toBe(404);
    expect((await api.request('/api/v1/ayahs/by-key/1:99')).status).toBe(404);
    expect((await api.request('/api/v1/ayahs/by-key/1:9999')).status).toBe(422);
    expect((await api.request('/api/v1/ayahs/by-key/oops')).status).toBe(422);
    expect((await api.request('/api/v1/ayahs/not-a-uuid')).status).toBe(422);
    expect((await api.request('/api/v1/juzs/31')).status).toBe(422);
    expect((await api.request('/api/v1/pages/9999')).status).toBe(404);
    const missing = await api.request('/api/v1/does-not-exist');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
  });

  it('never turns a hostile path into a 500', async () => {
    const traversal = await api.request('/api/v1/surahs/%2e%2e%2f%2e%2e');
    expect(traversal.status).toBe(404);
    const weirdId = await api.request('/api/v1/surahs/not-a-surah/ayahs');
    expect(weirdId.status).toBe(404);
    expect(JSON.stringify(traversal.body)).not.toMatch(/uuid|syntax|postgres/i);
  });

  it('answers HEAD like GET with an empty body', async () => {
    const { status, body } = await api.request('/api/v1/health', { method: 'HEAD' });
    expect(status).toBe(200);
    expect(body).toBe('');
  });

  it('answers 405 for a wrong method on a known path', async () => {
    const { status, body } = await api.request('/api/v1/surahs', { method: 'DELETE' });
    expect(status).toBe(405);
    expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('caps the page size', async () => {
    const { status, body } = await api.request('/api/v1/surahs/2/ayahs?limit=1000000');
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('structure endpoints', () => {
  it('covers juz, hizb, rub, page and manzil divisions', async () => {
    const juzs = await api.request('/api/v1/juzs');
    expect(juzs.body.data).toHaveLength(30);
    expect(juzs.body.data[0]).toMatchObject({ number: 1, start_surah: 1, start_ayah: 1 });

    const hizbs = await api.request('/api/v1/hizbs');
    expect(hizbs.body.data).toHaveLength(60);

    const hizb = await api.request('/api/v1/hizbs/1');
    expect(hizb.body.data.quarters).toHaveLength(4);

    const manzils = await api.request('/api/v1/manzils');
    expect(manzils.body.data).toHaveLength(7);

    const page = await api.request('/api/v1/pages/1');
    expect(page.body.data).toMatchObject({ number: 1, start_surah: 1, start_ayah: 1 });
  });

  it('returns exactly the ayahs of a juz', async () => {
    const { body } = await api.request('/api/v1/juzs/30/ayahs?limit=100');
    expect(body.meta.total).toBe(564);
    expect(body.data[0].ayah_key).toBe('78:1');
  });

  it('lists sajdah positions without inventing a ruling', async () => {
    const { body } = await api.request('/api/v1/sajdahs');
    expect(body.data).toHaveLength(15);
    expect(body.data.every((s: any) => s.sajdah_type === null)).toBe(true);
    expect(body.data[0]).toMatchObject({ surah: 7, ayah: 206 });
  });
});

describe('search', () => {
  it('matches both the Uthmani and the plain spelling of a word', async () => {
    const uthmani = await api.request(`/api/v1/search?q=${encodeURIComponent('العلمين')}`);
    const plain = await api.request(`/api/v1/search?q=${encodeURIComponent('العالمين')}`);
    expect(uthmani.body.meta.total).toBeGreaterThan(0);
    expect(plain.body.meta.total).toBe(uthmani.body.meta.total);
  });

  it('finds an exact phrase regardless of diacritics', async () => {
    const { body } = await api.request(`/api/v1/search?q=${encodeURIComponent('الحمد لله رب العالمين')}`);
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.data[0].ayah_key).toBe('1:2');
  });

  it('applies filters', async () => {
    const { body } = await api.request(`/api/v1/search?q=${encodeURIComponent('الحمد')}&surah=1`);
    expect(body.data.every((hit: any) => hit.surah.number === 1)).toBe(true);
  });

  it('requires a query and rejects an empty one', async () => {
    const empty = await api.request('/api/v1/search?q=');
    expect(empty.status).toBe(422);
    expect((await api.request('/api/v1/search')).status).toBe(422);
  });

  it('returns no rows (not an error) for nonsense queries', async () => {
    const { status, body } = await api.request('/api/v1/search?q=zzzzqqqq');
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it('is not vulnerable to SQL injection in q or filters', async () => {
    const injection = encodeURIComponent("' or 1=1; drop table quran.ayahs; --");
    const { status, body } = await api.request(`/api/v1/search?q=${injection}`);
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
    const still = await api.request('/api/v1/stats');
    expect(still.body.data.ayahs).toBe(6236);
    const badFilter = await api.request(`/api/v1/search?q=a&surah=1;drop%20table`);
    expect(badFilter.status).toBe(422);
  });
});

describe('audio and reciters', () => {
  it('returns an empty, honest catalogue while no licensed audio is imported', async () => {
    const reciters = await api.request('/api/v1/reciters');
    expect(reciters.body.data).toEqual([]);
    expect(reciters.body.meta.total).toBe(0);
    expect((await api.request('/api/v1/reciters/unknown-slug')).status).toBe(404);
    const search = await api.request('/api/v1/audio/search?surah=1');
    expect(search.body.data).toEqual([]);
  });

  it('exposes qiraat and riwayat from the source dataset', async () => {
    const qiraat = await api.request('/api/v1/qiraat');
    expect(qiraat.body.data[0]).toMatchObject({ slug: 'asim', verified: true });
    const riwayat = await api.request('/api/v1/riwayat');
    expect(riwayat.body.data[0]).toMatchObject({ slug: 'hafs', qiraah_slug: 'asim' });
  });
});

describe('downloads', () => {
  it('returns the text manifest with checksum and honest download state', async () => {
    const { body } = await api.request('/api/v1/downloads/quran');
    expect(body.data.dataset_version).toBe('test-1');
    expect(body.data.checksum).toHaveLength(64);
    expect(body.data.downloadable).toBe(false);
    expect(body.data.download_url).toBeNull();
    expect(body.data.license_note).toMatch(/not confirmed/i);
  });
});

describe('licence gating', () => {
  it('blocks content endpoints for anonymous callers when PUBLIC_DATA_ENABLED=false', async () => {
    const restricted = await startHarness(
      testEnv({ flags: { contentLicenseConfirmed: false, audioLicenseConfirmed: false, publicDataEnabled: false } }),
    );
    try {
      const anonymous = await restricted.request('/api/v1/surahs');
      expect(anonymous.status).toBe(451);
      expect(anonymous.body.error.code).toBe('LICENSE_RESTRICTED');
      // metadata endpoints stay open
      expect((await restricted.request('/api/v1/health')).status).toBe(200);
      expect((await restricted.request('/api/v1/sources')).status).toBe(200);
    } finally {
      await restricted.close();
    }
  });
});
