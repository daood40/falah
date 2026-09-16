import type pg from 'pg';
import type { AyahRow } from './serializers.ts';

export const AYAH_SELECT = `
  a.id, s.surah_number, s.name_ar as surah_name_ar, s.name_en as surah_name_en,
  a.ayah_number, a.global_ayah_number, a.juz_number, a.hizb_number, a.rub_number,
  a.page_number, a.manzil_number, a.ruku_number, a.sajdah, a.sajdah_type,
  a.raw_text, a.text_uthmani, a.text_simple, a.content_hash, a.verified,
  a.verification_status, a.dataset_version, a.source_id,
  src.name as source_name, src.version as source_version`;

const AYAH_FROM = `
  from quran.ayahs a
  join quran.surahs s on s.id = a.surah_id
  join quran.sources src on src.id = a.source_id`;

export type SurahRow = {
  id: string;
  surah_number: number;
  name_ar: string;
  name_en: string | null;
  name_transliteration: string | null;
  revelation_place: string | null;
  revelation_order: number | null;
  ayah_count: number;
  bismillah: string | null;
  source_id: string;
  verified: boolean;
  dataset_version: string | null;
};

const SURAH_COLUMNS = `id, surah_number, name_ar, name_en, name_transliteration,
  revelation_place, revelation_order, ayah_count, bismillah, source_id, verified, dataset_version`;

export async function listSurahs(
  client: pg.PoolClient,
  editionId: string,
  limit: number,
  offset: number,
): Promise<{ rows: SurahRow[]; total: number }> {
  const [data, count] = await Promise.all([
    client.query<SurahRow>(
      `select ${SURAH_COLUMNS} from quran.surahs
       where edition_id = $1 order by surah_number limit $2 offset $3`,
      [editionId, limit, offset],
    ),
    client.query<{ count: string }>(
      'select count(*)::text as count from quran.surahs where edition_id = $1',
      [editionId],
    ),
  ]);
  return { rows: data.rows, total: Number(count.rows[0]?.count ?? 0) };
}

export async function findSurah(
  client: pg.PoolClient,
  editionId: string,
  ref: string,
): Promise<SurahRow | null> {
  const numeric = /^\d+$/.test(ref);
  // Anything that is neither a surah number nor a uuid is simply unknown —
  // it must never reach Postgres as a cast.
  if (!numeric && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
    return null;
  }
  const { rows } = await client.query<SurahRow>(
    `select ${SURAH_COLUMNS} from quran.surahs
     where edition_id = $1 and ${numeric ? 'surah_number = $2::int' : 'id = $2::uuid'} limit 1`,
    [editionId, ref],
  );
  return rows[0] ?? null;
}

type AyahQuery = {
  editionId: string;
  where: string;
  params: unknown[];
  limit?: number;
  offset?: number;
  translationId?: string | null;
};

export async function queryAyahs(
  client: pg.PoolClient,
  { editionId, where, params, limit, offset, translationId }: AyahQuery,
): Promise<{ rows: AyahRow[]; total: number }> {
  const values = [editionId, ...params];
  const translationJoin = translationId
    ? `left join quran.ayah_translations at on at.ayah_id = a.id and at.translation_id = $${values.push(translationId)}::uuid
       left join quran.translations t on t.id = at.translation_id`
    : '';
  const translationColumns = translationId
    ? ', at.text as translation_text, t.title as translation_title, t.language as translation_language'
    : '';

  const countResult = await client.query<{ count: string }>(
    `select count(*)::text as count ${AYAH_FROM} where a.edition_id = $1 and ${where}`,
    values.slice(0, 1 + params.length),
  );

  let sql = `select ${AYAH_SELECT}${translationColumns} ${AYAH_FROM} ${translationJoin}
    where a.edition_id = $1 and ${where} order by a.global_ayah_number`;
  if (limit !== undefined) {
    sql += ` limit $${values.push(limit)} offset $${values.push(offset ?? 0)}`;
  }
  const { rows } = await client.query<AyahRow>(sql, values);
  return { rows, total: Number(countResult.rows[0]?.count ?? 0) };
}

export type DivisionRow = {
  id: string;
  number: number;
  start_surah: number;
  start_ayah: number;
  end_surah: number;
  end_ayah: number;
  start_global_ayah: number;
  end_global_ayah: number;
  source_id: string;
  verified: boolean;
  juz_number?: number;
  quarter?: number;
};

export async function listJuzs(client: pg.PoolClient, editionId: string): Promise<DivisionRow[]> {
  const { rows } = await client.query<DivisionRow>(
    `select id, juz_number as number, start_surah, start_ayah, end_surah, end_ayah,
            start_global_ayah, end_global_ayah, source_id, verified
     from quran.juzs where edition_id = $1 order by juz_number`,
    [editionId],
  );
  return rows;
}

export async function findJuz(
  client: pg.PoolClient,
  editionId: string,
  number: number,
): Promise<DivisionRow | null> {
  const { rows } = await client.query<DivisionRow>(
    `select id, juz_number as number, start_surah, start_ayah, end_surah, end_ayah,
            start_global_ayah, end_global_ayah, source_id, verified
     from quran.juzs where edition_id = $1 and juz_number = $2`,
    [editionId, number],
  );
  return rows[0] ?? null;
}

export async function listHizbs(client: pg.PoolClient, editionId: string): Promise<DivisionRow[]> {
  const { rows } = await client.query<DivisionRow>(
    `select min(id::text)::uuid as id, hizb_number as number,
            min(start_surah) as start_surah, min(start_ayah) as start_ayah,
            max(end_surah) as end_surah, max(end_ayah) as end_ayah,
            min(start_global_ayah) as start_global_ayah, max(end_global_ayah) as end_global_ayah,
            min(source_id) as source_id, bool_and(verified) as verified,
            min(juz_number) as juz_number
     from quran.hizbs where edition_id = $1 group by hizb_number order by hizb_number`,
    [editionId],
  );
  return rows;
}

export async function findHizb(
  client: pg.PoolClient,
  editionId: string,
  number: number,
): Promise<{ hizb: DivisionRow; quarters: DivisionRow[] } | null> {
  const { rows } = await client.query<DivisionRow>(
    `select id, rub_number as number, quarter, juz_number, start_surah, start_ayah,
            end_surah, end_ayah, start_global_ayah, end_global_ayah, source_id, verified
     from quran.hizbs where edition_id = $1 and hizb_number = $2 order by quarter`,
    [editionId, number],
  );
  if (rows.length === 0) return null;
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  return {
    hizb: {
      ...first,
      number,
      end_surah: last.end_surah,
      end_ayah: last.end_ayah,
      end_global_ayah: last.end_global_ayah,
    },
    quarters: rows,
  };
}

export async function findPage(
  client: pg.PoolClient,
  editionId: string,
  number: number,
): Promise<DivisionRow | null> {
  const { rows } = await client.query<DivisionRow>(
    `select id, page_number as number, start_surah, start_ayah, end_surah, end_ayah,
            start_global_ayah, end_global_ayah, source_id, verified
     from quran.pages where edition_id = $1 and page_number = $2`,
    [editionId, number],
  );
  return rows[0] ?? null;
}

export async function listManzils(client: pg.PoolClient, editionId: string): Promise<DivisionRow[]> {
  const { rows } = await client.query<DivisionRow>(
    `select id, manzil_number as number, start_surah, start_ayah, end_surah, end_ayah,
            start_global_ayah, end_global_ayah, source_id, verified
     from quran.manzils where edition_id = $1 order by manzil_number`,
    [editionId],
  );
  return rows;
}
