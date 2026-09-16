import type pg from 'pg';

export type SqlClient = Pick<pg.PoolClient, 'query'>;
import { createHash } from 'node:crypto';

/**
 * Audio manifest import + verification.
 *
 * Nothing about a recitation is inferred: the manifest must state the reciter,
 * riwayah, licence and every file's URL. A file becomes `verified` only after a
 * live HTTP check confirms it exists, is an audio content type, and matches the
 * declared size/checksum when those are provided.
 */
export type AudioManifest = {
  source: {
    id: string;
    name: string;
    url?: string;
    license?: string;
    license_url?: string;
    attribution_text?: string;
    /** 'restricted' unless redistribution rights are documented. */
    status?: 'pending' | 'approved' | 'restricted' | 'blocked';
    version?: string;
  };
  reciter: {
    slug: string;
    name_ar: string;
    name_en?: string | null;
    country?: string | null;
    bio?: string | null;
    photo_url?: string | null;
    website?: string | null;
  };
  recitation: {
    name: string;
    type: 'murattal' | 'mujawwad' | 'muallim' | 'translation';
    riwayah_slug?: string | null;
    edition_slug?: string | null;
    quality?: string | null;
    format?: string | null;
    bitrate?: number | null;
    sample_rate?: number | null;
    status?: 'restricted' | 'streaming_only' | 'public';
    version?: string | null;
  };
  files: {
    sequence_number: number;
    surah: number;
    ayah?: number | null;
    audio_url: string;
    stream_url?: string | null;
    download_url?: string | null;
    format?: string | null;
    codec?: string | null;
    bitrate?: number | null;
    sample_rate?: number | null;
    duration_ms?: number | null;
    file_size?: number | null;
    checksum?: string | null;
  }[];
};

export type AudioVerification = {
  url: string;
  ok: boolean;
  status?: number;
  content_type?: string | null;
  file_size?: number | null;
  checksum?: string | null;
  reason?: string;
};

export type AudioImportReport = {
  mode: 'dry-run' | 'import';
  network: boolean;
  totals: { files: number; imported: number; verified: number; failed: number; skipped: number };
  verifications: AudioVerification[];
  errors: string[];
};

const AUDIO_CONTENT_TYPES = ['audio/', 'application/octet-stream'];

/** Live check of one audio URL. HEAD first; full GET only when a checksum is required. */
export async function verifyAudioUrl(
  url: string,
  expected: { file_size?: number | null; checksum?: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<AudioVerification> {
  try {
    const head = await fetchImpl(url, { method: 'HEAD', redirect: 'follow' });
    if (!head.ok) {
      return { url, ok: false, status: head.status, reason: `HTTP ${head.status}` };
    }
    const contentType = head.headers.get('content-type');
    const lengthHeader = head.headers.get('content-length');
    const size = lengthHeader === null ? null : Number.parseInt(lengthHeader, 10);
    if (contentType && !AUDIO_CONTENT_TYPES.some((prefix) => contentType.startsWith(prefix))) {
      return { url, ok: false, status: head.status, content_type: contentType, reason: 'not an audio content type' };
    }
    if (expected.file_size != null && size != null && expected.file_size !== size) {
      return { url, ok: false, status: head.status, file_size: size, reason: 'file size mismatch' };
    }
    if (expected.checksum) {
      const body = await fetchImpl(url, { redirect: 'follow' });
      if (!body.ok) return { url, ok: false, status: body.status, reason: `HTTP ${body.status}` };
      const buffer = Buffer.from(await body.arrayBuffer());
      const checksum = createHash('sha256').update(buffer).digest('hex');
      if (checksum !== expected.checksum) {
        return { url, ok: false, checksum, file_size: buffer.length, reason: 'checksum mismatch' };
      }
      return { url, ok: true, status: body.status, content_type: contentType, file_size: buffer.length, checksum };
    }
    return { url, ok: true, status: head.status, content_type: contentType, file_size: size };
  } catch (error) {
    return { url, ok: false, reason: error instanceof Error ? error.message : 'request failed' };
  }
}

export async function importAudioManifest(
  client: SqlClient,
  manifest: AudioManifest,
  options: { mode: 'dry-run' | 'import'; network: boolean; datasetVersion: string },
  fetchImpl: typeof fetch = fetch,
): Promise<AudioImportReport> {
  const report: AudioImportReport = {
    mode: options.mode,
    network: options.network,
    totals: { files: manifest.files.length, imported: 0, verified: 0, failed: 0, skipped: 0 },
    verifications: [],
    errors: [],
  };

  if (options.network) {
    for (const file of manifest.files) {
      const verification = await verifyAudioUrl(
        file.audio_url,
        { file_size: file.file_size, checksum: file.checksum },
        fetchImpl,
      );
      report.verifications.push(verification);
      if (verification.ok) report.totals.verified += 1;
      else report.totals.failed += 1;
    }
  } else {
    report.totals.skipped = manifest.files.length;
  }

  if (options.mode === 'dry-run') return report;

  await client.query(
    `insert into quran.sources (id, name, url, license, license_url, attribution_text, status, version)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (id) do update set name = excluded.name, license = excluded.license,
       status = excluded.status, updated_at = now()`,
    [
      manifest.source.id, manifest.source.name, manifest.source.url ?? null,
      manifest.source.license ?? null, manifest.source.license_url ?? null,
      manifest.source.attribution_text ?? null, manifest.source.status ?? 'restricted',
      manifest.source.version ?? null,
    ],
  );

  const reciter = await client.query<{ id: string }>(
    `insert into quran.reciters (slug, name_ar, name_en, country, bio, photo_url, website,
       source_id, license, license_url, verified, verification_status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,'pending')
     on conflict (slug) do update set name_ar = excluded.name_ar, updated_at = now()
     returning id`,
    [
      manifest.reciter.slug, manifest.reciter.name_ar, manifest.reciter.name_en ?? null,
      manifest.reciter.country ?? null, manifest.reciter.bio ?? null,
      manifest.reciter.photo_url ?? null, manifest.reciter.website ?? null,
      manifest.source.id, manifest.source.license ?? null, manifest.source.license_url ?? null,
    ],
  );
  const reciterId = reciter.rows[0]!.id;

  let riwayahId: string | null = null;
  if (manifest.recitation.riwayah_slug) {
    const { rows } = await client.query<{ id: string }>(
      'select id from quran.riwayat where slug = $1',
      [manifest.recitation.riwayah_slug],
    );
    riwayahId = rows[0]?.id ?? null;
    if (!riwayahId) report.errors.push(`unknown riwayah slug: ${manifest.recitation.riwayah_slug}`);
    else {
      await client.query(
        `insert into quran.reciter_riwayat (reciter_id, riwayah_id, source_id, verified)
         values ($1,$2,$3,false) on conflict (reciter_id, riwayah_id) do nothing`,
        [reciterId, riwayahId, manifest.source.id],
      );
    }
  }

  const editionRow = manifest.recitation.edition_slug
    ? await client.query<{ id: string }>('select id from quran.quran_editions where slug = $1', [
        manifest.recitation.edition_slug,
      ])
    : { rows: [] as { id: string }[] };
  const editionId = editionRow.rows[0]?.id ?? null;

  const recitation = await client.query<{ id: string }>(
    `insert into quran.recitations (reciter_id, riwayah_id, edition_id, name, type, quality,
       format, bitrate, sample_rate, source_id, license, license_url, version, status, verified)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,false)
     returning id`,
    [
      reciterId, riwayahId, editionId, manifest.recitation.name, manifest.recitation.type,
      manifest.recitation.quality ?? null, manifest.recitation.format ?? null,
      manifest.recitation.bitrate ?? null, manifest.recitation.sample_rate ?? null,
      manifest.source.id, manifest.source.license ?? null, manifest.source.license_url ?? null,
      manifest.recitation.version ?? null, manifest.recitation.status ?? 'restricted',
    ],
  );
  const recitationId = recitation.rows[0]!.id;

  for (const [index, file] of manifest.files.entries()) {
    const verification = report.verifications[index];
    const verified = verification?.ok === true;
    const surah = await client.query<{ id: string }>(
      `select id from quran.surahs where surah_number = $1 ${editionId ? 'and edition_id = $2' : ''} limit 1`,
      editionId ? [file.surah, editionId] : [file.surah],
    );
    const surahId = surah.rows[0]?.id ?? null;
    if (!surahId) {
      report.errors.push(`unknown surah ${file.surah} for file ${file.audio_url}`);
      continue;
    }
    let ayahId: string | null = null;
    if (file.ayah != null) {
      const { rows } = await client.query<{ id: string }>(
        'select id from quran.ayahs where surah_id = $1 and ayah_number = $2',
        [surahId, file.ayah],
      );
      ayahId = rows[0]?.id ?? null;
      if (!ayahId) {
        report.errors.push(`unknown ayah ${file.surah}:${file.ayah}`);
        continue;
      }
    }
    await client.query(
      `insert into quran.audio_files (recitation_id, surah_id, ayah_id, sequence_number, audio_url,
         stream_url, download_url, format, codec, bitrate, sample_rate, duration_ms, file_size,
         checksum, source_id, license, license_url, status, verified, verification_status, dataset_version)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [
        recitationId, ayahId ? null : surahId, ayahId, file.sequence_number, file.audio_url,
        file.stream_url ?? null, file.download_url ?? null, file.format ?? null, file.codec ?? null,
        file.bitrate ?? null, file.sample_rate ?? null, file.duration_ms ?? null,
        verification?.file_size ?? file.file_size ?? null,
        verification?.checksum ?? file.checksum ?? null,
        manifest.source.id, manifest.source.license ?? null, manifest.source.license_url ?? null,
        manifest.recitation.status ?? 'restricted', verified,
        verified ? 'verified' : options.network ? 'failed' : 'pending',
        options.datasetVersion,
      ],
    );
    report.totals.imported += 1;
  }

  await client.query(
    `insert into quran.audit_logs (actor, actor_role, action, entity, entity_id, details)
     values ('audio-import', 'service_role', 'audio.import', 'recitations', $1, $2)`,
    [recitationId, JSON.stringify(report.totals)],
  );

  return report;
}
