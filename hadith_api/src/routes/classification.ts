/**
 * Browsing surfaces: every way the corpus is organised, each as its own
 * resource. All of them are counts and labels — no hadith text passes through
 * here, so they stay readable whatever the content licence says.
 */
import { get } from '../http/router.ts';
import { ok, paginated } from '../http/respond.ts';
import { query, queryOne } from '../db.ts';
import { notFound } from '../http/errors.ts';
import { parseBoundedInt, rejectControlCharacters, optionalInt, optionalText, optionalUuid, pagination, uuidParam } from '../http/validate.ts';

// ---------------- collections cited in takhrij ----------------
get('/api/v1/collections', async ({ res, query: q }) => {
  const { page, limit, offset } = pagination(q);
  const total =
    (await queryOne<{ total: number }>('select count(*)::int as total from corpus.collections_view'))?.total ?? 0;
  const rows = await query(
    `select name, hadith_count, book_count, first_volume, last_volume, corroborated_count
     from corpus.collections_view order by hadith_count desc limit $1 offset $2`,
    [limit, offset],
  );
  paginated(res, rows, page, limit, total);
});

get('/api/v1/collections/:name/hadiths', async ({ res, query: q, params }) => {
  // the router already decoded the segment; a control character here would
  // reach the driver as a NUL and surface as a 500
  const name = rejectControlCharacters(params['name'] as string, 'name').trim();
  const { page, limit, offset } = pagination(q);
  const exists = await queryOne('select 1 from corpus.hadith_sources where source_name = $1 limit 1', [name]);
  if (!exists) throw notFound('Collection');
  const total =
    (await queryOne<{ total: number }>(
      'select count(distinct hadith_id)::int as total from corpus.hadith_sources where source_name = $1',
      [name],
    ))?.total ?? 0;
  const rows = await query(
    `select h.id, h.hadith_number, h.volume_number as volume, h.page_number as page,
            h.grading, h.source_locator, b.name as book, c.name as chapter
     from corpus.hadith_sources hs
     join corpus.hadiths h on h.id = hs.hadith_id
     left join corpus.books b on b.id = h.book_id
     left join corpus.chapters c on c.id = h.chapter_id
     where hs.source_name = $1
     order by h.volume_number, h.page_number, h.source_ordinal
     limit $2 offset $3`,
    [name, limit, offset],
  );
  paginated(res, rows, page, limit, total, { collection: name });
});

// ---------------- grading labels ----------------
get('/api/v1/gradings', async ({ res }) => {
  const rows = await query(
    `select label, hadith_count, book_count, grader, verified_count
     from corpus.gradings_view order by hadith_count desc`,
  );
  ok(res, rows, { total: rows.length });
});

// ---------------- volumes and pages ----------------
get('/api/v1/volumes', async ({ res, query: q }) => {
  const editionId = optionalUuid(q, 'edition_id');
  const rows = await query(
    `select edition_id, volume, hadith_count, first_page, last_page, pages_with_text, book_count
     from corpus.volumes_view
     ${editionId ? 'where edition_id = $1' : ''}
     order by volume`,
    editionId ? [editionId] : [],
  );
  ok(res, rows, { total: rows.length });
});

get('/api/v1/volumes/:volume/hadiths', async ({ res, params, query: q }) => {
  const volume = parseBoundedInt(params['volume'] as string, 'volume');
  if (volume < 1) throw notFound('Volume');
  const { page, limit, offset } = pagination(q);
  const pageFilter = optionalInt(q, 'page_number');
  const params2: unknown[] = [volume];
  let where = 'where h.volume_number = $1';
  if (pageFilter !== null) {
    params2.push(pageFilter);
    where += ` and h.page_number = $${params2.length}`;
  }
  const total =
    (await queryOne<{ total: number }>(`select count(*)::int as total from corpus.hadiths h ${where}`, params2))
      ?.total ?? 0;
  if (total === 0) throw notFound('Volume');
  params2.push(limit, offset);
  const rows = await query(
    `select h.id, h.hadith_number, h.volume_number as volume, h.page_number as page,
            h.grading, h.source_locator, b.name as book, c.name as chapter
     from corpus.hadiths h
     left join corpus.books b on b.id = h.book_id
     left join corpus.chapters c on c.id = h.chapter_id
     ${where}
     order by h.page_number, h.source_ordinal
     limit $${params2.length - 1} offset $${params2.length}`,
    params2,
  );
  paginated(res, rows, page, limit, total, { volume });
});

// ---------------- the whole catalogue in one call ----------------
get('/api/v1/catalog', async ({ res, query: q }) => {
  const editionId = optionalUuid(q, 'edition_id');
  const books = await query(
    `select book_id as id, book_name as name, book_order as order_number,
            chapter_count, hadith_count, first_volume, last_volume
     from corpus.catalog_view
     ${editionId ? 'where edition_id = $1' : ''}
     order by book_order nulls last, book_name`,
    editionId ? [editionId] : [],
  );
  const withChapters = q.get('chapters') === 'true';
  if (!withChapters) {
    ok(res, books, { total: books.length, chapters: 'add ?chapters=true to include them' });
    return;
  }
  const chapters = await query<{ book_id: string }>(
    `select c.id, c.book_id, c.name, c.chapter_number, c.order_number,
            (select count(*)::int from corpus.hadiths h where h.chapter_id = c.id) as hadith_count
     from corpus.chapters c
     ${editionId ? 'join corpus.books b on b.id = c.book_id where b.edition_id = $1' : ''}
     order by c.order_number nulls last, c.name`,
    editionId ? [editionId] : [],
  );
  const byBook = new Map<string, unknown[]>();
  for (const chapter of chapters) {
    const list = byBook.get(chapter.book_id);
    if (list) list.push(chapter);
    else byBook.set(chapter.book_id, [chapter]);
  }
  ok(
    res,
    books.map((b) => ({ ...b, chapters: byBook.get((b as { id: string }).id) ?? [] })),
    { total: books.length },
  );
});

// ---------------- cross-checks against independent corpora ----------------
get('/api/v1/references', async ({ res }) => {
  const rows = await query(
    `select slug, name, description, url, license, version, record_count, retrieved_at
     from corpus.reference_corpora order by slug`,
  );
  ok(res, rows, { total: rows.length });
});

get('/api/v1/cross-checks/summary', async ({ res }) => {
  const rows = await query('select * from corpus.cross_check_summary order by dataset_version, reference_slug');
  ok(res, rows, { total: rows.length });
});

get('/api/v1/hadiths/:id/cross-checks', async ({ res, params }) => {
  const id = uuidParam(params['id'] as string);
  const exists = await queryOne('select 1 from corpus.hadiths where id = $1', [id]);
  if (!exists) throw notFound('Hadith');
  const rows = await query(
    `select r.slug as reference, r.name as reference_name, c.reference_collection,
            c.reference_number, c.method, c.similarity, c.verdict, c.takhrij_agrees,
            c.takhrij_collections, c.details, c.checked_at
     from corpus.cross_checks c
     join corpus.reference_corpora r on r.id = c.reference_corpus_id
     where c.hadith_id = $1
     order by c.similarity desc`,
    [id],
  );
  ok(res, rows, { total: rows.length });
});

/** The records an independent corpus did not corroborate — a human's work queue. */
get('/api/v1/cross-checks/review-queue', async ({ res, query: q }) => {
  const { page, limit, offset } = pagination(q);
  const verdict = optionalText(q, 'verdict', 20) ?? 'not_found';
  const total =
    (await queryOne<{ total: number }>(
      `select count(*)::int as total from corpus.cross_checks where verdict = $1`, [verdict]))?.total ?? 0;
  const rows = await query(
    `select c.hadith_id, h.source_locator, h.volume_number as volume, h.page_number as page,
            h.grading, c.similarity, c.verdict, c.takhrij_collections, c.takhrij_agrees,
            c.reference_collection, b.name as book, ch.name as chapter
     from corpus.cross_checks c
     join corpus.hadiths h on h.id = c.hadith_id
     left join corpus.books b on b.id = h.book_id
     left join corpus.chapters ch on ch.id = h.chapter_id
     where c.verdict = $1
     order by c.similarity asc, h.volume_number, h.page_number
     limit $2 offset $3`,
    [verdict, limit, offset],
  );
  paginated(res, rows, page, limit, total, { verdict });
});
