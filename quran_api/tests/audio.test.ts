import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { createHash } from 'node:crypto';
import {
  importAudioManifest,
  validateAudioManifest,
  verifyAudioUrl,
  type AudioManifest,
} from '../src/import/audio.ts';
import { startHarness, testUrl, type Harness } from './helpers.ts';

let pool: pg.Pool;
let api: Harness;

const CHECKSUM = 'a'.repeat(64);

const manifest: AudioManifest = {
  source: {
    id: 'test-audio-source',
    name: 'Test audio source (mock)',
    url: 'https://example.invalid/',
    license: 'test-only',
    license_url: 'https://example.invalid/license',
    attribution_text: 'test',
    status: 'restricted',
    version: '1',
  },
  reciter: { slug: 'test-reciter', name_ar: 'قارئ اختبار', name_en: 'Test Reciter' },
  recitation: {
    name: 'Murattal 128',
    type: 'murattal',
    riwayah_slug: 'hafs',
    edition_slug: 'quran-json-uthmani-hafs',
    quality: '128',
    format: 'mp3',
    bitrate: 128,
    sample_rate: 44100,
    status: 'restricted',
    version: '1',
  },
  files: [
    {
      sequence_number: 1,
      surah: 1,
      ayah: 1,
      audio_url: 'https://example.invalid/001001.mp3',
      format: 'mp3',
      codec: 'mp3',
      bitrate: 128,
      sample_rate: 44100,
      duration_ms: 5000,
      file_size: 11,
      checksum: CHECKSUM,
    },
    {
      sequence_number: 2,
      surah: 1,
      ayah: 2,
      audio_url: 'https://example.invalid/001002.mp3',
      format: 'mp3',
      codec: 'mp3',
      bitrate: 128,
      sample_rate: 44100,
      duration_ms: 6000,
      file_size: 11,
      checksum: CHECKSUM,
    },
  ],
};

/** Stand-in for the network: the pipeline must accept only real, checked files. */
const fakeFetch = (okUrls: Set<string>, body = Buffer.from('audio-bytes')): typeof fetch =>
  (async (input: any, init: any = {}) => {
    const url = String(input);
    if (!okUrls.has(url)) return new Response(null, { status: 404 });
    if (init.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: { 'content-type': 'audio/mpeg', 'content-length': String(body.length) },
      });
    }
    return new Response(body, { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  }) as unknown as typeof fetch;

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: testUrl(), max: 3 });
  api = await startHarness();
});
afterAll(async () => {
  await pool.end();
  await api.close();
});

describe('audio manifest schema', () => {
  it('accepts a complete manifest', () => {
    expect(validateAudioManifest(manifest)).toEqual([]);
  });

  it('refuses a manifest that is missing licensed metadata', () => {
    const incomplete = {
      ...manifest,
      files: [{ sequence_number: 1, surah: 1, audio_url: 'https://example.invalid/1.mp3' }],
    };
    const issues = validateAudioManifest(incomplete);
    expect(issues.join(' ')).toMatch(/codec/);
    expect(issues.join(' ')).toMatch(/duration_ms/);
    expect(issues.join(' ')).toMatch(/file_size/);
    expect(issues.join(' ')).toMatch(/checksum/);
  });

  it('refuses invented formats, bad URLs and duplicate sequence numbers', () => {
    const broken = {
      ...manifest,
      source: { ...manifest.source, license: '' },
      files: [
        { ...manifest.files[0]!, format: 'wma' as never, audio_url: 'not-a-url' },
        { ...manifest.files[1]!, sequence_number: 1 },
      ],
    };
    const issues = validateAudioManifest(broken).join(' ');
    expect(issues).toMatch(/format must be one of/);
    expect(issues).toMatch(/audio_url must be an absolute/);
    expect(issues).toMatch(/sequence_number is duplicated/);
    expect(issues).toMatch(/source.license/);
  });

  it('writes nothing when the manifest is invalid', async () => {
    const report = await importAudioManifest(
      { query: async () => { throw new Error('must not touch the database'); } } as never,
      { ...manifest, files: [] } as AudioManifest,
      { mode: 'import', network: false, datasetVersion: 'test-1' },
    );
    expect(report.totals.imported).toBe(0);
    expect(report.errors.join(' ')).toMatch(/manifest invalid/);
  });
});

describe('audio verification', () => {
  it('marks a reachable audio file as verified', async () => {
    const result = await verifyAudioUrl(
      'https://example.invalid/001001.mp3',
      {},
      fakeFetch(new Set(['https://example.invalid/001001.mp3'])),
    );
    expect(result.ok).toBe(true);
    expect(result.file_size).toBe(11);
  });

  it('fails a missing file, a wrong content type, a size mismatch and a bad checksum', async () => {
    const ok = new Set(['https://example.invalid/001001.mp3']);
    expect((await verifyAudioUrl('https://example.invalid/nope.mp3', {}, fakeFetch(ok))).ok).toBe(false);

    const htmlFetch = (async () =>
      new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;
    const html = await verifyAudioUrl('https://example.invalid/001001.mp3', {}, htmlFetch);
    expect(html.ok).toBe(false);
    expect(html.reason).toMatch(/content type/);

    const size = await verifyAudioUrl('https://example.invalid/001001.mp3', { file_size: 999 }, fakeFetch(ok));
    expect(size.reason).toMatch(/size mismatch/);

    const checksum = await verifyAudioUrl(
      'https://example.invalid/001001.mp3',
      { checksum: 'a'.repeat(64) },
      fakeFetch(ok),
    );
    expect(checksum.reason).toMatch(/checksum mismatch/);
  });
});

describe('audio manifest import', () => {
  it('imports metadata and only marks verified files as verified', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      // The first file's declared checksum matches the fake body; the second
      // URL does not exist. Only the first may end up verified.
      const body = Buffer.from('audio-bytes');
      const realChecksum = createHash('sha256').update(body).digest('hex');
      const checked: AudioManifest = {
        ...manifest,
        files: [
          { ...manifest.files[0]!, checksum: realChecksum, file_size: body.length },
          { ...manifest.files[1]!, checksum: realChecksum, file_size: body.length },
        ],
      };
      const report = await importAudioManifest(
        client,
        checked,
        { mode: 'import', network: true, datasetVersion: 'test-1' },
        fakeFetch(new Set(['https://example.invalid/001001.mp3']), body),
      );
      expect(report.totals).toMatchObject({ files: 2, imported: 2, verified: 1, failed: 1 });

      const { rows } = await client.query(
        `select af.verified, af.verification_status, af.status, af.download_url
         from quran.audio_files af order by af.sequence_number`,
      );
      expect(rows[0]).toMatchObject({ verified: true, verification_status: 'verified', status: 'restricted' });
      expect(rows[1]).toMatchObject({ verified: false, verification_status: 'failed' });

      // The API withholds download URLs while AUDIO_LICENSE_CONFIRMED=false.
      const { rows: reciterRows } = await client.query(`select id from quran.reciters where slug = 'test-reciter'`);
      expect(reciterRows).toHaveLength(1);

      await client.query('rollback');
    } finally {
      client.release();
    }
  });

  it('does not write anything in dry-run mode', async () => {
    const client = await pool.connect();
    try {
      const report = await importAudioManifest(
        client,
        manifest,
        { mode: 'dry-run', network: true, datasetVersion: 'test-1' },
        fakeFetch(new Set()),
      );
      expect(report.totals.imported).toBe(0);
      const { rows } = await client.query('select count(*)::int as count from quran.audio_files');
      expect(rows[0].count).toBe(0);
    } finally {
      client.release();
    }
  });
});
