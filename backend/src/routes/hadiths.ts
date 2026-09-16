import { get } from '../http/router.ts';
import { paginated, ok } from '../http/respond.ts';
import { query, queryOne } from '../db.ts';
import { serializeHadith, textVisible, type HadithRow } from '../domain/serialize.ts';
import { notFound } from '../http/errors.ts';
import { optionalEnum, optionalInt, optionalText, optionalUuid, pagination, sortDirection, uuidParam } from '../http/validate.ts';
import { HADITH_FROM, HADITH_SELECT, SqlFilters, isAdminRequest } from './shared.ts';

const STATUSES = ['pending', 'verified', 'needs_review', 'rejected'] as const;

export function hadithFilters(q: URLSearchParams): SqlFilters {
  const f = new SqlFilters();
  f.add((p) => `h.edition_id = ${p}`, optionalUuid(q, 'edition_id'));
  f.add((p) => `h.book_id = ${p}`, optionalUuid(q, 'book_id'));
  f.add((p) => `h.chapter_id = ${p}`, optionalUuid(q, 'chapter_id'));
  f.add((p) => `h.narrator_id = ${p}`, optionalUuid(q, 'narrator_id'));
  f.add((p) => `h.volume_number = ${p}`, optionalInt(q, 'volume'));
  f.add((p) => `h.page_number = ${p}`, optionalInt(q, 'page_number'));
  f.add((p) => `h.verification_status = ${p}`, optionalEnum(q, 'verification_status', STATUSES));
  f.add((p) => `h.dataset_version = ${p}`, optionalText(q, 'dataset_version', 64));
  f.add(
    (p) => `corpus.normalize_ar(h.grading) = corpus.normalize_ar(${p})`,
    optionalText(q, 'grading', 120),
  );
  return f;
}

async function listHadiths(q: URLSearchParams, isAdmin: boolean) {
  const { page, limit, offset } = pagination(q);
  const dir = sortDirection(q);
  const f = hadithFilters(q);
  const where = f.where();

  const countRow = await queryOne<{ total: number }>(
    `select count(*)::int as total ${HADITH_FROM} ${where}`,
    f.params,
  );
  const rows = await query<HadithRow>(
    `select ${HADITH_SELECT} ${HADITH_FROM} ${where}
     order by h.hadith_number_int ${dir} nulls last,
              h.volume_number ${dir} nulls last, h.page_number ${dir} nulls last,
              h.source_ordinal ${dir} nulls last, h.created_at ${dir}
     limit ${f.push(limit)} offset ${f.push(offset)}`,
    f.params,
  );
  return {
    page,
    limit,
    total: countRow?.total ?? 0,
    data: rows.map((r) => serializeHadith(r, isAdmin)),
  };
}

get('/api/v1/hadiths', async ({ res, query: q, req }) => {
  const isAdmin = isAdminRequest(req);
  const out = await listHadiths(q, isAdmin);
  paginated(res, out.data, out.page, out.limit, out.total, { text_available: textVisible(isAdmin) });
});

get('/api/v1/hadiths/:id', async ({ res, params, req }) => {
  const id = uuidParam(params['id'] as string);
  const row = await queryOne<HadithRow>(
    `select ${HADITH_SELECT} ${HADITH_FROM} where h.id = $1`,
    [id],
  );
  if (!row) throw notFound('Hadith');
  ok(res, serializeHadith(row, isAdminRequest(req)));
});

get('/api/v1/hadiths/by-number/:number', async ({ res, params, query: q, req }) => {
  const number = (params['number'] as string).trim();
  const f = new SqlFilters();
  f.raw(`h.hadith_number = ${f.push(number)}`);
  f.add((p) => `h.edition_id = ${p}`, optionalUuid(q, 'edition_id'));
  f.add((p) => `h.dataset_version = ${p}`, optionalText(q, 'dataset_version', 64));

  const rows = await query<HadithRow>(
    `select ${HADITH_SELECT} ${HADITH_FROM} ${f.where()} order by e.slug limit 50`,
    f.params,
  );
  if (rows.length === 0) throw notFound('Hadith');
  const isAdmin = isAdminRequest(req);
  // A number can repeat across editions; the source structure is preserved (§37).
  ok(res, rows.map((r) => serializeHadith(r, isAdmin)), { total: rows.length });
});
