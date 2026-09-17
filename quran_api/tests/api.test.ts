import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, startHarness, testEnv, type Harness } from './helpers.ts';
import { createApp } from '../src/app.ts';
import { loadEnv } from '../src/config/env.ts';
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
    expect(body.data.license_flags).toMatchObject({
      publicDataEnabled: true,
      publicApiEnabled: false,
      audioLicenseConfirmed: false,
      tafsirLicenseConfirmed: false,
    });
    expect(body.data.private_mode).toBe(false); // the test harness is an internal instance
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
      rukus: 556,
      sajdahs: 15,
      ayah_translations: 6236,
    });
  });

  it('lists every classification of the mushaf with its boundaries', async () => {
    const rubs = await api.request('/api/v1/rubs');
    expect(rubs.body.data).toHaveLength(240);
    expect(rubs.body.data[0]).toMatchObject({ number: 1, hizb_number: 1, quarter: 1, juz_number: 1 });
    expect(rubs.body.data[239]).toMatchObject({ number: 240, hizb_number: 60, quarter: 4, juz_number: 30 });

    const rub = await api.request('/api/v1/rubs/5');
    expect(rub.body.data).toMatchObject({ number: 5, hizb_number: 2, quarter: 1 });

    const pages = await api.request('/api/v1/pages');
    expect(pages.body.data).toHaveLength(604);
    expect(pages.body.data[603]).toMatchObject({ number: 604, end_surah: 114, end_ayah: 6 });

    const manzil = await api.request('/api/v1/manzils/7');
    expect(manzil.body.data).toMatchObject({ number: 7, end_surah: 114, end_global_ayah: 6236 });

    const rukus = await api.request('/api/v1/rukus');
    expect(rukus.body.data).toHaveLength(556);
    expect(rukus.body.data[0]).toMatchObject({ number: 1, surah_number: 1, start_ayah: 1, end_ayah: 7 });
    expect(rukus.body.data[555]).toMatchObject({ number: 556, surah_number: 114 });

    const baqarah = await api.request('/api/v1/rukus?surah=2');
    expect(baqarah.body.data).toHaveLength(40);
    expect(baqarah.body.data.every((r: any) => r.surah_number === 2)).toBe(true);

    const ruku = await api.request('/api/v1/rukus/2');
    expect(ruku.body.data).toMatchObject({ number: 2, surah_number: 2, start_ayah: 1, end_ayah: 7 });

    const rukuAyahs = await api.request('/api/v1/rukus/2/ayahs?limit=100');
    expect(rukuAyahs.body.meta.total).toBe(7);
    expect(rukuAyahs.body.data[0].ayah_key).toBe('2:1');
    expect(rukuAyahs.body.data.every((a: any) => a.ruku === 2)).toBe(true);

    for (const bad of ['/api/v1/rukus/557', '/api/v1/rukus/0', '/api/v1/rukus?surah=115', '/api/v1/rubs/241', '/api/v1/manzils/8']) {
      expect((await api.request(bad)).status).toBe(422);
    }
  });

  it('classifies surahs by place and order of revelation and reports where each sits', async () => {
    const makkah = await api.request('/api/v1/surahs?revelation=makkah');
    const madinah = await api.request('/api/v1/surahs?revelation=madinah');
    expect(makkah.body.meta.total + madinah.body.meta.total).toBe(114);
    expect(makkah.body.data.every((s: any) => s.revelation_place === 'makkah')).toBe(true);
    expect(madinah.body.data.every((s: any) => s.revelation_place === 'madinah')).toBe(true);
    expect(makkah.body.data.map((s: any) => s.surah_number)).toContain(1);
    expect(madinah.body.data.map((s: any) => s.surah_number)).toContain(2);

    const byRevelation = await api.request('/api/v1/surahs?sort=revelation_order');
    const orders = byRevelation.body.data.map((s: any) => s.revelation_order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(byRevelation.body.data[0].surah_number).toBe(96); // al-ʿAlaq, first revealed

    expect((await api.request('/api/v1/surahs?revelation=mars')).status).toBe(422);
    expect((await api.request('/api/v1/surahs?sort=length')).status).toBe(422);

    const surah = await api.request('/api/v1/surahs/2');
    expect(surah.body.data.structure).toMatchObject({
      start_page: 2,
      end_page: 49,
      start_juz: 1,
      end_juz: 3,
      manzil: 1,
      ruku_count: 40,
      sajdah_count: 0,
      first_global_ayah: 8,
      last_global_ayah: 293,
    });
    const alaq = await api.request('/api/v1/surahs/96');
    expect(alaq.body.data.structure.sajdah_count).toBe(1);
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
  it('offers the manifest only when licence AND redistribution are confirmed', async () => {
    // The harness runs with both confirmed, so the manifest is downloadable.
    const { body } = await api.request('/api/v1/downloads/quran');
    expect(body.data.dataset_version).toBe('test-1');
    expect(body.data.checksum).toHaveLength(64);
    expect(body.data.downloadable).toBe(true);
    expect(body.data.download_url).not.toBeNull();
  });

  it('withholds the download in private mode, even for an authenticated caller', async () => {
    const privateApi = await startHarness(testEnv({ privateMode: true }));
    try {
      const user = await createTestUser(privateApi.pool);
      const anonymous = await privateApi.request('/api/v1/downloads/quran');
      expect(anonymous.status).toBe(451);
      expect(anonymous.body.error.message).toMatch(/PRIVATE_MODE/);

      const authenticated = await privateApi.request('/api/v1/downloads/quran', {
        token: user.token,
      });
      expect(authenticated.status).toBe(200);
      expect(authenticated.body.data.downloadable).toBe(false);
      expect(authenticated.body.data.download_url).toBeNull();
      expect(authenticated.body.data.license_note).toMatch(/not confirmed/i);
    } finally {
      await privateApi.close();
    }
  });
});

describe('private mode', () => {
  it('forces every public switch off regardless of the environment', async () => {
    const privateApi = await startHarness(
      testEnv({
        privateMode: true,
        flags: {
          contentLicenseConfirmed: true,
          translationsLicenseConfirmed: true,
          audioLicenseConfirmed: true,
          tafsirLicenseConfirmed: true,
          qiraatLicenseConfirmed: true,
          // These three are what loadEnv() forces off in private mode; passing
          // them as true here proves the API still refuses anonymous access.
          dataRedistributionAllowed: false,
          publicDataEnabled: false,
          publicApiEnabled: false,
        },
      }),
    );
    try {
      const health = await privateApi.request('/api/v1/health');
      expect(health.body.data.private_mode).toBe(true);
      expect(health.body.data.public_api_enabled).toBe(false);

      const version = await privateApi.request('/api/v1/version');
      expect(version.body.data.private_mode).toBe(true);

      for (const path of ['/api/v1/surahs', '/api/v1/search?q=a', '/api/v1/sajdahs']) {
        const response = await privateApi.request(path);
        expect(response.status).toBe(451);
        expect(response.body.error.code).toBe('LICENSE_RESTRICTED');
      }
    } finally {
      await privateApi.close();
    }
  });

  it('loadEnv cannot be talked into a public posture while private', () => {
    const flags = loadEnv({
      PRIVATE_MODE: 'true',
      PUBLIC_DATA_ENABLED: 'true',
      PUBLIC_API_ENABLED: 'true',
      DATA_REDISTRIBUTION_ALLOWED: 'true',
      CONTENT_LICENSE_CONFIRMED: 'true',
    } as NodeJS.ProcessEnv).flags;
    expect(flags.publicDataEnabled).toBe(false);
    expect(flags.publicApiEnabled).toBe(false);
    expect(flags.dataRedistributionAllowed).toBe(false);
  });

  it('refuses to start a public instance without the matching licences', () => {
    expect(() =>
      createApp(
        loadEnv({
          PRIVATE_MODE: 'false',
          PUBLIC_DATA_ENABLED: 'true',
          CONTENT_LICENSE_CONFIRMED: 'false',
        } as NodeJS.ProcessEnv),
        api.pool,
      ),
    ).toThrow(/unsafe public configuration/);
  });

  it('binds to loopback by default in private mode', () => {
    expect(loadEnv({ PRIVATE_MODE: 'true' } as NodeJS.ProcessEnv).host).toBe('127.0.0.1');
    expect(loadEnv({ PRIVATE_MODE: 'false' } as NodeJS.ProcessEnv).host).toBe('0.0.0.0');
  });
});

describe('licence gating', () => {
  it('blocks content endpoints for anonymous callers when PUBLIC_DATA_ENABLED=false', async () => {
    const restricted = await startHarness(
      testEnv({
        flags: {
          contentLicenseConfirmed: false,
          translationsLicenseConfirmed: false,
          audioLicenseConfirmed: false,
          tafsirLicenseConfirmed: false,
          qiraatLicenseConfirmed: false,
          dataRedistributionAllowed: false,
          publicDataEnabled: false,
          publicApiEnabled: false,
        },
      }),
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
