import { get } from '../http/router.ts';
import { paginated } from '../http/respond.ts';
import { query, queryOne } from '../db.ts';
import { badRequest } from '../http/errors.ts';
import { optionalEnum, optionalText, pagination } from '../http/validate.ts';
import { serializeHadith, type HadithRow } from '../domain/serialize.ts';
import { HADITH_FROM, HADITH_SELECT, isAdminRequest } from './shared.ts';
import { hadithFilters } from './hadiths.ts';

const TYPES = ['hadiths', 'narrators', 'chapters', 'books'] as const;

/**
 * §21 — Arabic search over FTS (`search_tsv`, GIN) plus a pg_trgm substring
 * pass so partial words still hit. Both sides are normalized identically by
 * corpus.normalize_ar; the stored text is untouched.
 */
get('/api/v1/search', async ({ res, query: q, req }) => {
  const term = optionalText(q, 'q', 200);
  if (!term || term.length < 2) throw badRequest('"q" must be at least 2 characters');
  const type = optionalEnum(q, 'type', TYPES) ?? 'hadiths';
  const { page, limit, offset } = pagination(q);

  if (type === 'hadiths') {
    const f = hadithFilters(q);
    const nq = f.push(term);
    const source = optionalText(q, 'source', 120);
    const number = optionalText(q, 'hadith_number', 40);
    if (number) f.raw(`h.hadith_number = ${f.push(number)}`);
    if (source) {
      const sp = f.push(source);
      f.raw(`(corpus.normalize_ar(h.takhrij) like '%' || corpus.normalize_ar(${sp}) || '%'
              or exists (select 1 from corpus.hadith_sources hs
                         where hs.hadith_id = h.id
                           and corpus.normalize_ar(hs.source_name) like '%' || corpus.normalize_ar(${sp}) || '%'))`);
    }
    f.raw(`(
      h.search_tsv @@ websearch_to_tsquery('simple', corpus.normalize_ar(${nq}))
      or corpus.normalize_ar(h.raw_text) like '%' || corpus.normalize_ar(${nq}) || '%'
      or exists (select 1 from corpus.narrators nn where nn.id = h.narrator_id
                 and corpus.normalize_ar(nn.name) like '%' || corpus.normalize_ar(${nq}) || '%')
      or corpus.normalize_ar(coalesce(c.name, '')) like '%' || corpus.normalize_ar(${nq}) || '%'
      or corpus.normalize_ar(coalesce(b.name, '')) like '%' || corpus.normalize_ar(${nq}) || '%'
    )`);
    const where = f.where();

    const total =
      (await queryOne<{ total: number }>(`select count(*)::int as total ${HADITH_FROM} ${where}`, f.params))?.total ?? 0;
    const rows = await query<HadithRow>(
      `select ${HADITH_SELECT},
              ts_rank(h.search_tsv, websearch_to_tsquery('simple', corpus.normalize_ar(${nq}))) as rank
       ${HADITH_FROM} ${where}
       order by rank desc, h.hadith_number_int nulls last
       limit ${f.push(limit)} offset ${f.push(offset)}`,
      f.params,
    );
    const isAdmin = isAdminRequest(req);
    paginated(res, rows.map((r) => serializeHadith(r, isAdmin)), page, limit, total, {
      query: term,
      type,
    });
    return;
  }

  const table = { narrators: 'narrators', chapters: 'chapters', books: 'books' }[type];
  const cols =
    type === 'narrators'
      ? 'id, name, kunya, laqab, edition_id'
      : type === 'chapters'
        ? 'id, name, chapter_number, book_id, parent_id'
        : 'id, name, order_number, edition_id';

  const like = `corpus.normalize_ar(name) like '%' || corpus.normalize_ar($1) || '%'`;
  const total =
    (await queryOne<{ total: number }>(`select count(*)::int as total from corpus.${table} where ${like}`, [term]))
      ?.total ?? 0;
  const rows = await query(
    `select ${cols} from corpus.${table} where ${like}
     order by similarity(corpus.normalize_ar(name), corpus.normalize_ar($1)) desc, name
     limit $2 offset $3`,
    [term, limit, offset],
  );
  paginated(res, rows, page, limit, total, { query: term, type });
});
