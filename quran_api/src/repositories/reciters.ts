import type pg from 'pg';

const RECITER_COLUMNS = `id, slug, name_ar, name_en, display_name, bio, country,
  birth_year, death_year, photo_url, website, source_id, license, license_url,
  attribution_required, attribution_text, verified, verification_status`;

export type ReciterRow = Record<string, unknown> & { id: string; slug: string };

export async function listReciters(
  client: pg.PoolClient,
  opts: { search?: string; limit: number; offset: number },
): Promise<{ rows: ReciterRow[]; total: number }> {
  const values: unknown[] = [];
  let where = 'true';
  if (opts.search) {
    values.push(`%${opts.search}%`);
    where = `(name_ar ilike $1 or coalesce(name_en, '') ilike $1 or slug ilike $1)`;
  }
  const count = await client.query<{ count: string }>(
    `select count(*)::text as count from quran.reciters where ${where}`,
    values,
  );
  const { rows } = await client.query<ReciterRow>(
    `select ${RECITER_COLUMNS} from quran.reciters where ${where}
     order by name_ar limit $${values.push(opts.limit)} offset $${values.push(opts.offset)}`,
    values,
  );
  return { rows, total: Number(count.rows[0]?.count ?? 0) };
}

export async function findReciter(client: pg.PoolClient, ref: string): Promise<ReciterRow | null> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(ref);
  const { rows } = await client.query<ReciterRow>(
    `select ${RECITER_COLUMNS} from quran.reciters where ${isUuid ? 'id = $1::uuid' : 'slug = $1'}`,
    [ref],
  );
  return rows[0] ?? null;
}

export async function listReciterRiwayat(
  client: pg.PoolClient,
  reciterId: string,
): Promise<Record<string, unknown>[]> {
  const { rows } = await client.query(
    `select r.id, r.slug, r.name_ar, r.name_en, r.description, r.source_id, r.verified,
            q.id as qiraah_id, q.name_ar as qiraah_name_ar, q.name_en as qiraah_name_en,
            rr.verified as link_verified
     from quran.reciter_riwayat rr
     join quran.riwayat r on r.id = rr.riwayah_id
     join quran.qiraat q on q.id = r.qiraah_id
     where rr.reciter_id = $1 order by r.name_ar`,
    [reciterId],
  );
  return rows;
}

export async function listRecitations(
  client: pg.PoolClient,
  reciterId: string,
): Promise<Record<string, unknown>[]> {
  const { rows } = await client.query(
    `select id, reciter_id, riwayah_id, edition_id, name, type, quality, format, bitrate,
            sample_rate, source_id, license, license_url, version, status, verified
     from quran.recitations where reciter_id = $1 order by name`,
    [reciterId],
  );
  return rows;
}

export type AudioScope =
  | { kind: 'reciter'; reciterId: string }
  | { kind: 'reciter_surah'; reciterId: string; surahNumber: number }
  | { kind: 'reciter_juz'; reciterId: string; juzNumber: number }
  | { kind: 'ayah'; ayahId: string }
  | { kind: 'surah'; surahId: string }
  | { kind: 'search'; reciter?: string; surah?: number; riwayah?: string; format?: string };

const AUDIO_COLUMNS = `af.id, af.recitation_id, af.surah_id, af.ayah_id, af.juz_id,
  af.sequence_number, af.audio_url, af.stream_url, af.download_url, af.format, af.codec,
  af.bitrate, af.sample_rate, af.duration_ms, af.file_size, af.checksum, af.source_id,
  af.license, af.license_url, af.status, af.verified, af.verification_status, af.dataset_version`;

export async function listAudioFiles(
  client: pg.PoolClient,
  scope: AudioScope,
  opts: { limit: number; offset: number },
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const values: unknown[] = [];
  const joins = [`join quran.recitations rec on rec.id = af.recitation_id`];
  const conditions: string[] = [];

  switch (scope.kind) {
    case 'reciter':
      conditions.push(`rec.reciter_id = $${values.push(scope.reciterId)}::uuid`);
      break;
    case 'reciter_surah':
      joins.push('left join quran.surahs s on s.id = af.surah_id');
      joins.push('left join quran.ayahs ay on ay.id = af.ayah_id');
      joins.push('left join quran.surahs s2 on s2.id = ay.surah_id');
      conditions.push(`rec.reciter_id = $${values.push(scope.reciterId)}::uuid`);
      conditions.push(
        `coalesce(s.surah_number, s2.surah_number) = $${values.push(scope.surahNumber)}::int`,
      );
      break;
    case 'reciter_juz':
      joins.push('left join quran.ayahs ay on ay.id = af.ayah_id');
      conditions.push(`rec.reciter_id = $${values.push(scope.reciterId)}::uuid`);
      conditions.push(`ay.juz_number = $${values.push(scope.juzNumber)}::int`);
      break;
    case 'ayah':
      conditions.push(`af.ayah_id = $${values.push(scope.ayahId)}::uuid`);
      break;
    case 'surah':
      conditions.push(`af.surah_id = $${values.push(scope.surahId)}::uuid`);
      break;
    case 'search': {
      joins.push('join quran.reciters r on r.id = rec.reciter_id');
      joins.push('left join quran.ayahs ay on ay.id = af.ayah_id');
      joins.push('left join quran.surahs s on s.id = coalesce(af.surah_id, ay.surah_id)');
      if (scope.reciter) {
        const idx = values.push(`%${scope.reciter}%`);
        conditions.push(`(r.name_ar ilike $${idx} or coalesce(r.name_en, '') ilike $${idx} or r.slug ilike $${idx})`);
      }
      if (scope.surah !== undefined) {
        conditions.push(`s.surah_number = $${values.push(scope.surah)}::int`);
      }
      if (scope.riwayah) {
        joins.push('left join quran.riwayat rw on rw.id = rec.riwayah_id');
        conditions.push(`rw.slug = $${values.push(scope.riwayah)}`);
      }
      if (scope.format) conditions.push(`af.format = $${values.push(scope.format)}`);
      break;
    }
  }

  const where = conditions.length > 0 ? conditions.join(' and ') : 'true';
  const from = `from quran.audio_files af ${joins.join(' ')} where ${where}`;
  const count = await client.query<{ count: string }>(
    `select count(*)::text as count ${from}`,
    values,
  );
  const { rows } = await client.query(
    `select ${AUDIO_COLUMNS} ${from} order by af.sequence_number
     limit $${values.push(opts.limit)} offset $${values.push(opts.offset)}`,
    values,
  );
  return { rows, total: Number(count.rows[0]?.count ?? 0) };
}
