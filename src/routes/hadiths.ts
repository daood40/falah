import { get } from '../http/router.ts';
import { paginated, ok } from '../http/respond.ts';
import { query, queryOne } from '../db.ts';
import {
  serializeHadith,
  serializeHadithListItem,
  serializeTakhrij,
  textVisible,
  type HadithRow,
} from '../domain/serialize.ts';
import { badRequest, notFound } from '../http/errors.ts';
import {
  optionalEnum, optionalInt, optionalText, optionalUuid, pagination, sortDirection, uuidParam,
} from '../http/validate.ts';
import { HADITH_FROM, HADITH_ORDER, HADITH_SELECT, SqlFilters, isAdminRequest } from './shared.ts';
import { hadithIncludes, INCLUDABLE, type IncludeName } from './hadith-parts.ts';

const STATUSES = ['pending', 'verified', 'needs_review', 'rejected'] as const;

/** §16 — the filters Falah combines: book, chapter, source, grading, volume, page. */
export function hadithFilters(q: URLSearchParams): SqlFilters {
  const f = new SqlFilters();
  f.add((p) => `h.edition_id = ${p}`, optionalUuid(q, 'edition_id'));
  f.add((p) => `e.source_id = ${p}`, optionalUuid(q, 'source_id'));
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

/** ?include=narrators,references,takhrij,gradings,verification */
function parseIncludes(q: URLSearchParams): IncludeName[] {
  const raw = q.get('include');
  if (!raw) return [];
  const names = raw.split(',').map((n) => n.trim()).filter(Boolean);
  const unknown = names.filter((n) => !(INCLUDABLE as readonly string[]).includes(n));
  if (unknown.length > 0) {
    throw badRequest(
      `unknown include: ${unknown.join(', ').slice(0, 80)}. Available: ${INCLUDABLE.join(', ')}`,
    );
  }
  return names as IncludeName[];
}

async function fetchHadith(id: string): Promise<HadithRow | null> {
  return queryOne<HadithRow>(`select ${HADITH_SELECT} ${HADITH_FROM} where h.id = $1`, [id]);
}

// ---------------- list ----------------
get('/api/v1/hadiths', async ({ res, query: q, req }) => {
  const isAdmin = isAdminRequest(req);
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
     order by ${dir === 'desc' ? HADITH_ORDER.replaceAll('nulls last', 'desc nulls last') : HADITH_ORDER}
     limit ${f.push(limit)} offset ${f.push(offset)}`,
    f.params,
  );
  paginated(
    res,
    rows.map((r) => serializeHadithListItem(r, isAdmin)),
    page,
    limit,
    countRow?.total ?? 0,
    { text_available: textVisible(isAdmin) },
  );
});

// ---------------- random (§18) ----------------
get('/api/v1/hadiths/random', async ({ res, query: q, req }) => {
  const isAdmin = isAdminRequest(req);
  const f = hadithFilters(q);
  // Only a record that exists is ever returned — nothing is generated.
  const row = await queryOne<HadithRow>(
    `select ${HADITH_SELECT} ${HADITH_FROM} ${f.where()} order by random() limit 1`,
    f.params,
  );
  if (!row) throw notFound('Hadith');
  ok(res, serializeHadith(row, isAdmin, await hadithIncludes(row, parseIncludes(q), isAdmin)));
});

// ---------------- daily (§19) ----------------
get('/api/v1/hadiths/daily', async ({ res, query: q, req }) => {
  const isAdmin = isAdminRequest(req);
  const date = optionalText(q, 'date', 10) ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('"date" must be YYYY-MM-DD');

  const f = hadithFilters(q);
  const where = f.where();
  const totalRow = await queryOne<{ total: number }>(
    `select count(*)::int as total ${HADITH_FROM} ${where}`,
    f.params,
  );
  const total = totalRow?.total ?? 0;
  if (total === 0) throw notFound('Hadith');

  /**
   * Deterministic: the same day and the same dataset always pick the same
   * record. The seed is the date plus the dataset fingerprint, so a dataset
   * change rotates the selection instead of silently keeping a stale pick.
   */
  const dataset = await queryOne<{ version: string; dataset_hash: string | null }>(
    `select version, dataset_hash from corpus.dataset_versions
     where is_active order by created_at desc limit 1`,
  );
  const seed = `${date}:${dataset?.version ?? ''}:${dataset?.dataset_hash ?? ''}`;
  const offsetRow = await queryOne<{ idx: number }>(
    `select (abs(hashtextextended($1, 0)) % $2)::int as idx`,
    [seed, total],
  );
  const index = offsetRow?.idx ?? 0;

  const row = await queryOne<HadithRow>(
    `select ${HADITH_SELECT} ${HADITH_FROM} ${where}
     order by ${HADITH_ORDER} limit 1 offset ${f.push(index)}`,
    f.params,
  );
  if (!row) throw notFound('Hadith');
  ok(
    res,
    serializeHadith(row, isAdmin, await hadithIncludes(row, parseIncludes(q), isAdmin)),
    { date, dataset_version: dataset?.version ?? null, deterministic: true },
  );
});

// ---------------- by the number the source prints ----------------
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
  ok(res, rows.map((r) => serializeHadithListItem(r, isAdmin)), { total: rows.length });
});

// ---------------- detail (§13) ----------------
get('/api/v1/hadiths/:id', async ({ res, params, query: q, req }) => {
  const id = uuidParam(params['id'] as string);
  const includes = parseIncludes(q);
  const row = await fetchHadith(id);
  if (!row) throw notFound('Hadith');
  const isAdmin = isAdminRequest(req);
  ok(res, serializeHadith(row, isAdmin, await hadithIncludes(row, includes, isAdmin)));
});

export { fetchHadith, serializeTakhrij };
