import type pg from 'pg';
import { normalizeForSearch, searchSkeleton } from '../core/arabic.ts';
import type { AyahRow } from './serializers.ts';
import { AYAH_SELECT } from './quran.ts';

export type SearchFilters = {
  editionId: string;
  q: string;
  surah?: number;
  ayah?: number;
  juz?: number;
  hizb?: number;
  page?: number;
  riwayah?: string;
  qiraah?: string;
  language?: string;
  exact: boolean;
  limit: number;
  offset: number;
};

export type SearchHit = AyahRow & { rank: number; match_type: 'text' | 'translation' };

/**
 * Full-text search over the normalised `search_text` (GIN tsvector), with a
 * pg_trgm similarity fallback for partial words, plus optional translation
 * search. `raw_text` is never modified; only the derived column is queried.
 */
export async function searchAyahs(
  client: pg.PoolClient,
  filters: SearchFilters,
): Promise<{ rows: SearchHit[]; total: number }> {
  const normalized = normalizeForSearch(filters.q);
  const skeleton = searchSkeleton(filters.q);
  const values: unknown[] = [filters.editionId, normalized, skeleton];
  const conditions: string[] = ['a.edition_id = $1'];

  const add = (sql: string, value: unknown): void => {
    conditions.push(sql.replace('$$', `$${values.push(value)}`));
  };
  if (filters.surah !== undefined) add('s.surah_number = $$::int', filters.surah);
  if (filters.ayah !== undefined) add('a.ayah_number = $$::int', filters.ayah);
  if (filters.juz !== undefined) add('a.juz_number = $$::int', filters.juz);
  if (filters.hizb !== undefined) add('a.hizb_number = $$::int', filters.hizb);
  if (filters.page !== undefined) add('a.page_number = $$::int', filters.page);
  if (filters.riwayah !== undefined) add('e.riwayah = $$', filters.riwayah);
  if (filters.qiraah !== undefined) add('e.qiraah = $$', filters.qiraah);

  const translationJoin = filters.language
    ? `left join quran.ayah_translations at on at.ayah_id = a.id
       left join quran.translations t on t.id = at.translation_id and t.language = $${values.push(filters.language)}`
    : '';

  // Exact mode matches the normalised text as a phrase; the default mode also
  // matches the alef-less skeleton so both Uthmani and plain spellings hit.
  const textMatch = filters.exact
    ? `a.search_text like '%' || $2 || '%'`
    : `(a.search_vector @@ plainto_tsquery('simple', $2)
        or a.search_skeleton_vector @@ plainto_tsquery('simple', $3)
        or a.search_text like '%' || $2 || '%'
        or a.search_skeleton like '%' || $3 || '%')`;
  const translationMatch = filters.language
    ? ` or (t.id is not null and at.text ilike '%' || $2 || '%')`
    : '';

  const from = `
    from quran.ayahs a
    join quran.surahs s on s.id = a.surah_id
    join quran.sources src on src.id = a.source_id
    join quran.quran_editions e on e.id = a.edition_id
    ${translationJoin}`;
  const where = `${conditions.join(' and ')} and (${textMatch}${translationMatch})`;

  const countResult = await client.query<{ count: string }>(
    `select count(distinct a.id)::text as count ${from} where ${where}`,
    values,
  );

  const limitIdx = values.push(filters.limit);
  const offsetIdx = values.push(filters.offset);
  const { rows } = await client.query<SearchHit>(
    `select distinct ${AYAH_SELECT},
       greatest(
         ts_rank(a.search_vector, plainto_tsquery('simple', $2)),
         ts_rank(a.search_skeleton_vector, plainto_tsquery('simple', $3))
       ) as rank,
       'text'::text as match_type
     ${from} where ${where}
     order by rank desc, a.global_ayah_number
     limit $${limitIdx} offset $${offsetIdx}`,
    values,
  );
  return { rows, total: Number(countResult.rows[0]?.count ?? 0) };
}
