import { get } from '../http/router.ts';
import { ok, paginated } from '../http/respond.ts';
import { query, queryOne } from '../db.ts';
import { notFound } from '../http/errors.ts';
import { optionalText, optionalUuid, pagination, uuidParam } from '../http/validate.ts';
import { serializeHadithListItem, type HadithRow } from '../domain/serialize.ts';
import { HADITH_FROM, HADITH_SELECT, SqlFilters, isAdminRequest } from './shared.ts';

// ---------------- sources ----------------
get('/api/v1/sources', async ({ res, query: q }) => {
  const { page, limit, offset } = pagination(q);
  const total = (await queryOne<{ total: number }>('select count(*)::int as total from corpus.sources'))?.total ?? 0;
  const rows = await query(
    `select id, slug, name, description, url, publisher, country, language,
            source_type, license_status, created_at, updated_at
     from corpus.sources order by name limit $1 offset $2`,
    [limit, offset],
  );
  paginated(res, rows, page, limit, total);
});

get('/api/v1/sources/:id', async ({ res, params }) => {
  const row = await queryOne(
    `select s.id, s.slug, s.name, s.description, s.url, s.publisher, s.country,
            s.language, s.source_type, s.license_status, s.created_at, s.updated_at,
            (select count(*)::int from corpus.editions e where e.source_id = s.id) as edition_count,
            (select count(*)::int from corpus.hadiths h
              join corpus.editions e2 on e2.id = h.edition_id
             where e2.source_id = s.id) as hadith_count
     from corpus.sources s where s.id = $1`,
    [uuidParam(params['id'] as string)],
  );
  if (!row) throw notFound('Source');
  ok(res, row);
});

// ---------------- editions ----------------
get('/api/v1/editions', async ({ res, query: q }) => {
  const { page, limit, offset } = pagination(q);
  const f = new SqlFilters();
  f.add((p) => `e.source_id = ${p}`, optionalUuid(q, 'source_id'));
  const where = f.where();
  const total =
    (await queryOne<{ total: number }>(`select count(*)::int as total from corpus.editions e ${where}`, f.params))
      ?.total ?? 0;
  const rows = await query(
    `select e.id, e.slug, e.title, e.author, e.publisher, e.edition_name, e.edition_number,
            e.publication_year, e.hijri_year, e.volume_count, e.isbn, e.page_count,
            e.source_url, e.dataset_version, e.source_id, s.name as source_name,
            e.created_at, e.updated_at
     from corpus.editions e join corpus.sources s on s.id = e.source_id
     ${where} order by e.title limit ${f.push(limit)} offset ${f.push(offset)}`,
    f.params,
  );
  paginated(res, rows, page, limit, total);
});

get('/api/v1/editions/:id', async ({ res, params }) => {
  const row = await queryOne(
    `select e.id, e.slug, e.title, e.author, e.publisher, e.edition_name, e.edition_number,
            e.publication_year, e.hijri_year, e.volume_count, e.isbn, e.page_count,
            e.source_url, e.dataset_version, e.source_id, s.name as source_name,
            e.created_at, e.updated_at
     from corpus.editions e join corpus.sources s on s.id = e.source_id where e.id = $1`,
    [uuidParam(params['id'] as string)],
  );
  if (!row) throw notFound('Edition');
  ok(res, row);
});

// ---------------- books ----------------
const BOOK_COLS = `b.id, b.edition_id, b.external_key, b.name, b.order_number, b.description,
                   b.created_at, b.updated_at,
                   (select count(*)::int from corpus.hadiths h where h.book_id = b.id) as hadith_count`;

get('/api/v1/books', async ({ res, query: q }) => {
  const { page, limit, offset } = pagination(q);
  const f = new SqlFilters();
  f.add((p) => `b.edition_id = ${p}`, optionalUuid(q, 'edition_id'));
  const where = f.where();
  const total =
    (await queryOne<{ total: number }>(`select count(*)::int as total from corpus.books b ${where}`, f.params))?.total ?? 0;
  const rows = await query(
    `select ${BOOK_COLS} from corpus.books b ${where}
     order by b.order_number nulls last, b.name limit ${f.push(limit)} offset ${f.push(offset)}`,
    f.params,
  );
  paginated(res, rows, page, limit, total);
});

get('/api/v1/books/:id', async ({ res, params }) => {
  const row = await queryOne(`select ${BOOK_COLS} from corpus.books b where b.id = $1`, [
    uuidParam(params['id'] as string),
  ]);
  if (!row) throw notFound('Book');
  ok(res, row);
});

/** §6 — the chapters of one book, the way Falah walks the tree. */
get('/api/v1/books/:id/chapters', async ({ res, params, query: q }) => {
  const id = uuidParam(params['id'] as string);
  const exists = await queryOne('select 1 from corpus.books where id = $1', [id]);
  if (!exists) throw notFound('Book');
  const { page, limit, offset } = pagination(q);
  const total =
    (await queryOne<{ total: number }>(
      'select count(*)::int as total from corpus.chapters where book_id = $1', [id]))?.total ?? 0;
  const rows = await query(
    `select c.id, c.book_id, c.parent_id, c.chapter_number as number, c.name as title,
            c.order_number,
            (select min(h.page_number) from corpus.hadiths h where h.chapter_id = c.id) as page_start,
            (select max(h.page_number) from corpus.hadiths h where h.chapter_id = c.id) as page_end,
            (select count(*)::int from corpus.hadiths h where h.chapter_id = c.id) as hadith_count
     from corpus.chapters c where c.book_id = $1
     order by c.order_number nulls last, c.name
     limit $2 offset $3`,
    [id, limit, offset],
  );
  paginated(res, rows, page, limit, total);
});

get('/api/v1/books/:id/hadiths', async ({ res, params, query: q, req }) => {
  const id = uuidParam(params['id'] as string);
  const exists = await queryOne('select 1 from corpus.books where id = $1', [id]);
  if (!exists) throw notFound('Book');
  await listChildHadiths(res, req, q, 'h.book_id', id);
});

// ---------------- chapters ----------------
const CHAPTER_COLS = `c.id, c.book_id, c.parent_id, c.external_key,
                      c.name as title, c.name, c.chapter_number as number,
                      c.order_number, c.created_at, c.updated_at,
                      (select min(h.page_number) from corpus.hadiths h where h.chapter_id = c.id) as page_start,
                      (select max(h.page_number) from corpus.hadiths h where h.chapter_id = c.id) as page_end,
                      (select count(*)::int from corpus.hadiths h where h.chapter_id = c.id) as hadith_count`;

get('/api/v1/chapters', async ({ res, query: q }) => {
  const { page, limit, offset } = pagination(q);
  const f = new SqlFilters();
  f.add((p) => `c.book_id = ${p}`, optionalUuid(q, 'book_id'));
  f.add((p) => `c.parent_id = ${p}`, optionalUuid(q, 'parent_id'));
  if (q.get('root') === 'true') f.raw('c.parent_id is null');
  const where = f.where();
  const total =
    (await queryOne<{ total: number }>(`select count(*)::int as total from corpus.chapters c ${where}`, f.params))
      ?.total ?? 0;
  const rows = await query(
    `select ${CHAPTER_COLS} from corpus.chapters c ${where}
     order by c.order_number nulls last, c.name limit ${f.push(limit)} offset ${f.push(offset)}`,
    f.params,
  );
  paginated(res, rows, page, limit, total);
});

get('/api/v1/chapters/:id', async ({ res, params }) => {
  const row = await queryOne(`select ${CHAPTER_COLS} from corpus.chapters c where c.id = $1`, [
    uuidParam(params['id'] as string),
  ]);
  if (!row) throw notFound('Chapter');
  ok(res, row);
});

get('/api/v1/chapters/:id/hadiths', async ({ res, params, query: q, req }) => {
  const id = uuidParam(params['id'] as string);
  const exists = await queryOne('select 1 from corpus.chapters where id = $1', [id]);
  if (!exists) throw notFound('Chapter');
  await listChildHadiths(res, req, q, 'h.chapter_id', id);
});

// ---------------- narrators ----------------
const NARRATOR_COLS = `n.id, n.edition_id, n.name, n.normalized_name, n.kunya, n.laqab,
                       n.biography, n.source_reference, n.created_at, n.updated_at,
                       (select count(*)::int from corpus.hadiths h where h.narrator_id = n.id) as hadith_count`;

get('/api/v1/narrators', async ({ res, query: q }) => {
  const { page, limit, offset } = pagination(q);
  const f = new SqlFilters();
  f.add((p) => `n.edition_id = ${p}`, optionalUuid(q, 'edition_id'));
  const name = optionalText(q, 'name', 120);
  if (name) f.raw(`corpus.normalize_ar(n.name) like '%' || corpus.normalize_ar(${f.push(name)}) || '%'`);
  const where = f.where();
  const total =
    (await queryOne<{ total: number }>(`select count(*)::int as total from corpus.narrators n ${where}`, f.params))
      ?.total ?? 0;
  const rows = await query(
    `select ${NARRATOR_COLS} from corpus.narrators n ${where}
     order by n.name limit ${f.push(limit)} offset ${f.push(offset)}`,
    f.params,
  );
  paginated(res, rows, page, limit, total);
});

get('/api/v1/narrators/:id', async ({ res, params }) => {
  const row = await queryOne(`select ${NARRATOR_COLS} from corpus.narrators n where n.id = $1`, [
    uuidParam(params['id'] as string),
  ]);
  if (!row) throw notFound('Narrator');
  ok(res, row);
});

get('/api/v1/narrators/:id/hadiths', async ({ res, params, query: q, req }) => {
  const id = uuidParam(params['id'] as string);
  const exists = await queryOne('select 1 from corpus.narrators where id = $1', [id]);
  if (!exists) throw notFound('Narrator');
  const { page, limit, offset } = pagination(q);
  const f = new SqlFilters();
  const p = f.push(id);
  const where = `where h.narrator_id = ${p} or exists (
      select 1 from corpus.hadith_narrators hn where hn.hadith_id = h.id and hn.narrator_id = ${p})`;
  const total =
    (await queryOne<{ total: number }>(`select count(*)::int as total ${HADITH_FROM} ${where}`, f.params))?.total ?? 0;
  const rows = await query<HadithRow>(
    `select ${HADITH_SELECT} ${HADITH_FROM} ${where}
     order by h.hadith_number_int nulls last, h.volume_number nulls last,
              h.page_number nulls last, h.source_ordinal nulls last limit ${f.push(limit)} offset ${f.push(offset)}`,
    f.params,
  );
  const isAdmin = isAdminRequest(req);
  paginated(res, rows.map((r) => serializeHadithListItem(r, isAdmin)), page, limit, total);
});

async function listChildHadiths(
  res: Parameters<typeof ok>[0],
  req: Parameters<typeof isAdminRequest>[0],
  q: URLSearchParams,
  column: string,
  id: string,
): Promise<void> {
  const { page, limit, offset } = pagination(q);
  const f = new SqlFilters();
  f.raw(`${column} = ${f.push(id)}`);
  const where = f.where();
  const total =
    (await queryOne<{ total: number }>(`select count(*)::int as total ${HADITH_FROM} ${where}`, f.params))?.total ?? 0;
  const rows = await query<HadithRow>(
    `select ${HADITH_SELECT} ${HADITH_FROM} ${where}
     order by h.hadith_number_int nulls last, h.volume_number nulls last,
              h.page_number nulls last, h.source_ordinal nulls last, h.created_at
     limit ${f.push(limit)} offset ${f.push(offset)}`,
    f.params,
  );
  const isAdmin = isAdminRequest(req);
  paginated(res, rows.map((r) => serializeHadithListItem(r, isAdmin)), page, limit, total);
}
