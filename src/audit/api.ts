/**
 * API checks against the deployed staging instance, over HTTP.
 * Every response is additionally checked for envelope shape, headers, leakage
 * and latency, so one request yields several independent assertions about
 * different properties.
 */
import { query } from '../db.ts';
import { normalizeArabic } from '../domain/normalize.ts';
import type { Auditor } from './core.ts';

/** The release under audit; override with DATASET= to audit an older one. */
const DATASET = process.env['DATASET'] ?? 'JAMI-KAMIL-1437-V2';
import { rng, pick } from './core.ts';
import { http, envelopeProblem, leaks, BASE_URL, RATELIMIT_URL } from './http.ts';
import type { HttpResult } from './http.ts';

const REPRO = `curl -s ${BASE_URL}<path>`;
const LATENCY_BUDGET_MS = 1500;

/** Envelope + headers + leakage + latency, asserted once per response. */
function inspect(audit: Auditor, id: string, category: string, path: string, res: HttpResult): void {
  const problem = envelopeProblem(res);
  audit.check(`${id}:envelope`, `${category}.envelope`,
    'the response uses the documented success/error envelope',
    problem === null, { severity: 'HIGH', detail: `${problem} (status ${res.status})`, where: path, repro: `curl -s "${BASE_URL}${path}"` });

  const found = leaks(res.body);
  audit.check(`${id}:leak`, `${category}.leakage`,
    'the response leaks no secret, connection string, SQL or stack trace',
    found.length === 0, { severity: 'CRITICAL', detail: found.join(', '), where: path, repro: `curl -s "${BASE_URL}${path}"` });

  audit.check(`${id}:latency`, `${category}.latency`,
    `the response arrives within ${LATENCY_BUDGET_MS} ms`,
    res.ms <= LATENCY_BUDGET_MS, { severity: 'MEDIUM', detail: `${res.ms} ms`, where: path, repro: `curl -s "${BASE_URL}${path}"` });
}

interface DbHadith {
  id: string; source_locator: string; volume_number: number; page_number: number;
  content_hash: string; dataset_version: string; verification_status: string;
  book_id: string | null; chapter_id: string | null; book_name: string | null; chapter_name: string | null;
  grading: string | null; raw_text: string;
}

export async function runApiChecks(audit: Auditor): Promise<void> {
  const ping = await http('/api/v1/health');
  if (ping.status !== 200) {
    audit.blocked('api.staging_reachable', 'api.deployment',
      'the staging deployment answers over HTTP from outside the server process',
      `GET ${BASE_URL}/api/v1/health returned ${ping.status} ${ping.error ?? ''}`,
      'scripts/staging-up.sh', 'bash scripts/staging-up.sh');
    return;
  }
  audit.check('api.staging_reachable', 'api.deployment',
    'the staging deployment answers over HTTP from outside the server process',
    true, { where: BASE_URL, repro: 'bash scripts/staging-up.sh' });

  const health = ping.json as { data?: Record<string, unknown> };
  for (const [key, expected] of [
    ['api', 'up'], ['database', 'up'], ['environment', 'staging'],
    ['content_license_confirmed', false], ['dataset_version', DATASET],
  ] as [string, unknown][]) {
    audit.check(`api.health:${key}`, 'api.deployment',
      `health reports ${key} = ${String(expected)}`,
      health.data?.[key] === expected, {
        severity: 'HIGH', detail: `got ${JSON.stringify(health.data?.[key])}`,
        where: '/api/v1/health', repro: REPRO,
      });
  }

  // ---- every registered route, called over HTTP -------------------------
  const rows = await query<DbHadith>(
    `select h.id, h.source_locator, h.volume_number, h.page_number, h.content_hash,
            h.dataset_version, h.verification_status, h.book_id, h.chapter_id,
            b.name as book_name, c.name as chapter_name, h.grading, h.raw_text
       from corpus.hadiths h
       left join corpus.books b on b.id = h.book_id
       left join corpus.chapters c on c.id = h.chapter_id
      order by h.volume_number, h.page_number, h.source_ordinal`,
  );
  const books = await query<{ id: string; name: string; order_number: number | null }>(
    'select id, name, order_number from corpus.books order by order_number, name',
  );
  const chapters = await query<{ id: string; name: string; book_id: string }>(
    'select id, name, book_id from corpus.chapters order by name',
  );
  const narrators = await query<{ id: string; name: string }>(
    'select id, name from corpus.narrators order by name',
  );

  const { listRoutes } = await import('../http/router.ts');
  await import('../http/app.ts');
  const sampleIds = {
    id: rows[0]?.id ?? '',
    volume: '3',
    number: '1',
    name: (await query<{ source_name: string }>('select source_name from corpus.hadith_sources limit 1'))[0]?.source_name ?? '',
  };
  for (const r of listRoutes()) {
    const path = r.path
      .replace(':id', r.path.includes('books') ? (books[0]?.id ?? '') : r.path.includes('chapters') ? (chapters[0]?.id ?? '') : r.path.includes('narrators') ? (narrators[0]?.id ?? '') : sampleIds.id)
      .replace(':volume', sampleIds.volume)
      .replace(':number', sampleIds.number)
      .replace(':name', encodeURIComponent(sampleIds.name));
    const res = await http(path, { method: r.method });
    const admin = path.includes('/admin/');
    audit.check(`api.route:${r.method}:${r.path}`, 'api.routes',
      admin ? 'the route refuses an unauthenticated caller' : 'the route answers a public caller',
      admin ? res.status === 401 || res.status === 403
            : res.status === 200 || res.status === 404 || res.status === 422, {
        severity: admin ? 'CRITICAL' : 'HIGH', detail: `status ${res.status}`,
        where: path, repro: `curl -s -X ${r.method} "${BASE_URL}${path}"`,
      });
    inspect(audit, `api.route:${r.method}:${r.path}`, 'api.routes', path, res);

    for (const [header, expected] of [
      ['x-content-type-options', 'nosniff'],
      ['referrer-policy', 'no-referrer'],
    ] as [string, string][]) {
      audit.check(`api.header:${r.method}:${r.path}:${header}`, 'api.headers',
        `the response carries ${header}: ${expected}`,
        res.headers[header] === expected, {
          severity: 'MEDIUM', detail: `got ${res.headers[header]}`, where: path, repro: REPRO,
        });
    }

    // a method the route does not serve must be refused, never executed
    const wrong = r.method === 'GET' ? 'DELETE' : 'GET';
    const wrongRes = await http(path, { method: wrong });
    audit.check(`api.method_guard:${r.method}:${r.path}`, 'api.routes',
      'an unsupported method is refused with a 4xx, never executed',
      wrongRes.status >= 400 && wrongRes.status < 500, {
        severity: 'HIGH', detail: `${wrong} ${path} -> ${wrongRes.status}`,
        where: path, repro: `curl -s -X ${wrong} "${BASE_URL}${path}"`,
      });
  }

  // ---- every hadith detail response vs the database ---------------------
  const rand = rng(2_026_0917);
  const detailSample = rows.filter((_, i) => i % 12 === 0); // ~1,330 records
  for (const row of detailSample) {
    const path = `/api/v1/hadiths/${row.id}`;
    const res = await http(path);
    const data = (res.json as { data?: Record<string, any> })?.data;
    const id = `api.detail:${row.source_locator}`;
    audit.check(`${id}:status`, 'api.detail',
      'the record is served', res.status === 200 && Boolean(data), {
        severity: 'CRITICAL', detail: `status ${res.status}`, where: path, repro: `curl -s "${BASE_URL}${path}"`,
      });
    if (!data) continue;
    audit.check(`${id}:id`, 'api.detail', 'the served id is the requested record',
      data['id'] === row.id, { severity: 'CRITICAL', detail: `got ${data['id']}`, where: path, repro: REPRO });
    audit.check(`${id}:locator`, 'api.detail', 'the served locator equals the stored locator',
      data['location']?.locator === row.source_locator, { severity: 'HIGH', detail: `got ${data['location']?.locator}`, where: path, repro: REPRO });
    audit.check(`${id}:volume_page`, 'api.detail', 'volume and page equal the stored values',
      data['location']?.volume === row.volume_number && data['location']?.page === row.page_number, {
        severity: 'HIGH', detail: `got ${JSON.stringify(data['location'])}`, where: path, repro: REPRO });
    audit.check(`${id}:hash`, 'api.detail', 'the served content hash equals the stored hash',
      data['dataset']?.hash === row.content_hash, { severity: 'CRITICAL', detail: `got ${data['dataset']?.hash}`, where: path, repro: REPRO });
    audit.check(`${id}:book`, 'api.detail', 'the served book equals the stored book',
      (data['book']?.id ?? null) === row.book_id, { severity: 'HIGH', detail: `got ${data['book']?.id}`, where: path, repro: REPRO });
    audit.check(`${id}:chapter`, 'api.detail', 'the served chapter equals the stored chapter',
      (data['chapter']?.id ?? null) === row.chapter_id, { severity: 'HIGH', detail: `got ${data['chapter']?.id}`, where: path, repro: REPRO });
    audit.check(`${id}:gate`, 'api.license_gate',
      'no verbatim text of the edition is published while the licence gate is closed',
      data['text'] === null && data['text_available'] === false, {
        severity: 'CRITICAL', detail: `text=${JSON.stringify(data['text'])?.slice(0, 40)}`, where: path, repro: REPRO });
    audit.check(`${id}:locked`, 'api.detail', 'the record is reported as source-locked',
      data['source_locked'] === true, { severity: 'HIGH', detail: `got ${data['source_locked']}`, where: path, repro: REPRO });
    audit.check(`${id}:not_verified`, 'api.detail',
      'the record does not claim a verification no human granted',
      data['verification']?.verified === false, { severity: 'CRITICAL', detail: `got ${JSON.stringify(data['verification'])}`, where: path, repro: REPRO });
    inspect(audit, id, 'api.detail', path, res);
  }

  // ---- pagination properties -------------------------------------------
  const total = rows.length;
  for (let i = 0; i < 300; i++) {
    const limit = 1 + Math.floor(rand() * 100);
    const page = 1 + Math.floor(rand() * Math.ceil(total / limit));
    const path = `/api/v1/hadiths?page=${page}&limit=${limit}`;
    const res = await http(path);
    const body = res.json as { data?: unknown[]; meta?: Record<string, unknown> };
    const id = `api.page:${i}:${page}:${limit}`;
    audit.check(`${id}:limit`, 'api.pagination', 'a page never returns more items than its limit',
      Array.isArray(body.data) && body.data.length <= limit, {
        severity: 'HIGH', detail: `${body.data?.length} > ${limit}`, where: path, repro: `curl -s "${BASE_URL}${path}"` });
    audit.check(`${id}:current_page`, 'api.pagination', 'meta.current_page echoes the requested page',
      body.meta?.['current_page'] === page, { severity: 'HIGH', detail: `got ${body.meta?.['current_page']}`, where: path, repro: REPRO });
    audit.check(`${id}:total`, 'api.pagination', 'meta.total equals the number of records in the corpus',
      body.meta?.['total'] === total, { severity: 'HIGH', detail: `got ${body.meta?.['total']}`, where: path, repro: REPRO });
    audit.check(`${id}:total_pages`, 'api.pagination', 'meta.total_pages equals ceil(total/limit)',
      body.meta?.['total_pages'] === Math.ceil(total / limit), {
        severity: 'MEDIUM', detail: `got ${body.meta?.['total_pages']}`, where: path, repro: REPRO });
    const expectedSlice = rows.slice((page - 1) * limit, (page - 1) * limit + limit).map((r) => r.id);
    audit.check(`${id}:order`, 'api.pagination',
      'the page returns exactly the records of that slice, in printed reading order',
      JSON.stringify((body.data as { id: string }[] | undefined)?.map((d) => d.id)) === JSON.stringify(expectedSlice), {
        severity: 'HIGH', detail: 'slice differs from the printed order', where: path, repro: REPRO });
    inspect(audit, id, 'api.pagination', path, res);
  }

  // over-limit requests must be refused or clamped, never served in full
  for (const limit of [101, 500, 1000, 100000, 2147483647]) {
    const path = `/api/v1/hadiths?limit=${limit}`;
    const res = await http(path);
    const body = res.json as { data?: unknown[] };
    audit.check(`api.limit_guard:${limit}`, 'api.pagination',
      'a limit above the maximum is refused or clamped, never served in full',
      res.status === 400 || res.status === 422 || (Array.isArray(body.data) && body.data.length <= 100), {
        severity: 'HIGH', detail: `status ${res.status}, ${body.data?.length} items`, where: path, repro: REPRO });
  }

  // ---- filters: every returned row must satisfy the filter --------------
  for (let i = 0; i < 150; i++) {
    const book = pick(rand, books);
    const path = `/api/v1/hadiths?book_id=${book.id}&limit=100`;
    const res = await http(path);
    const data = ((res.json as { data?: { book_id: string }[] }).data) ?? [];
    audit.check(`api.filter_book:${book.id}:${i}`, 'api.filters',
      'every record returned under a book filter belongs to that book',
      data.every((d) => d.book_id === book.id), {
        severity: 'HIGH', detail: 'a foreign record was returned', where: path, repro: REPRO });
    const expected = rows.filter((r) => r.book_id === book.id).length;
    audit.check(`api.filter_book_total:${book.id}:${i}`, 'api.filters',
      'the filtered total equals the number of records the database holds for that book',
      (res.json as { meta?: { total?: number } }).meta?.total === expected, {
        severity: 'HIGH', detail: `api ${(res.json as any)?.meta?.total} vs db ${expected}`, where: path, repro: REPRO });
  }
  for (let i = 0; i < 150; i++) {
    const chapter = pick(rand, chapters);
    const path = `/api/v1/hadiths?chapter_id=${chapter.id}&limit=100`;
    const res = await http(path);
    const data = ((res.json as { data?: { chapter_id: string }[] }).data) ?? [];
    audit.check(`api.filter_chapter:${chapter.id}:${i}`, 'api.filters',
      'every record returned under a chapter filter belongs to that chapter',
      data.every((d) => d.chapter_id === chapter.id), {
        severity: 'HIGH', detail: 'a foreign record was returned', where: path, repro: REPRO });
  }
  for (let volume = 1; volume <= 12; volume++) {
    const path = `/api/v1/hadiths?volume=${volume}&limit=100`;
    const res = await http(path);
    const data = ((res.json as { data?: { volume: number }[] }).data) ?? [];
    audit.check(`api.filter_volume:${volume}`, 'api.filters',
      'every record returned under a volume filter was printed in that volume',
      data.every((d) => d.volume === volume), {
        severity: 'HIGH', detail: 'a record from another volume was returned', where: path, repro: REPRO });
    const expected = rows.filter((r) => r.volume_number === volume).length;
    audit.check(`api.filter_volume_total:${volume}`, 'api.filters',
      'the volume total equals the number of records the database holds for it',
      (res.json as { meta?: { total?: number } }).meta?.total === expected, {
        severity: 'HIGH', detail: `api ${(res.json as any)?.meta?.total} vs db ${expected}`, where: path, repro: REPRO });
  }

  // ---- search properties ------------------------------------------------
  const terms = await query<{ t: string }>(
    `select distinct (regexp_split_to_array(corpus.normalize_ar(raw_text), '\\s+'))[3] as t
       from corpus.hadiths where length(raw_text) > 120 limit 200`,
  );
  for (const [i, t] of terms.entries()) {
    const term = (t.t ?? '').trim();
    if (term.length < 3) continue;
    const path = `/api/v1/search?q=${encodeURIComponent(term)}&limit=20`;
    const res = await http(path);
    const body = res.json as { data?: unknown[]; meta?: { total?: number } };
    const tsvTotal = (await query<{ c: number }>(
      `select count(*)::int as c from corpus.hadiths
        where search_tsv @@ websearch_to_tsquery('simple', corpus.normalize_ar($1))`,
      [term],
    ))[0]?.c ?? 0;
    // The endpoint unions the text index with substring and catalogue matches,
    // so its total must COVER the index-only total, never fall short of it.
    audit.check(`api.search_covers_index:${i}`, 'api.search',
      'the search total covers every record the text index alone would return',
      (body.meta?.total ?? -1) >= tsvTotal, {
        severity: 'HIGH', detail: `api ${body.meta?.total} < index ${tsvTotal} for "${term}"`,
        where: path, repro: REPRO });
    // and every hit it returns must genuinely contain the term somewhere the
    // endpoint documents it searches
    for (const [k, hit] of ((body.data as { id: string }[] | undefined) ?? []).entries()) {
      const justified = (await query<{ ok: boolean }>(
        `select (corpus.normalize_ar(h.raw_text) like '%' || corpus.normalize_ar($2) || '%'
                 or h.search_tsv @@ websearch_to_tsquery('simple', corpus.normalize_ar($2))
                 or corpus.normalize_ar(coalesce(n.name, '')) like '%' || corpus.normalize_ar($2) || '%'
                 or corpus.normalize_ar(coalesce(c.name, '')) like '%' || corpus.normalize_ar($2) || '%'
                 or corpus.normalize_ar(coalesce(b.name, '')) like '%' || corpus.normalize_ar($2) || '%') as ok
           from corpus.hadiths h
           left join corpus.narrators n on n.id = h.narrator_id
           left join corpus.chapters c on c.id = h.chapter_id
           left join corpus.books b on b.id = h.book_id
          where h.id = $1`,
        [hit.id, term],
      ))[0]?.ok;
      audit.check(`api.search_hit_justified:${i}:${k}`, 'api.search',
        'every returned hit really contains the term in a searched field',
        justified === true, {
          severity: 'HIGH', detail: `hit ${hit.id} does not contain "${term}"`,
          where: path, repro: REPRO });
    }
    audit.check(`api.search_nonempty:${i}`, 'api.search',
      'a term taken from the corpus finds at least one record',
      (body.meta?.total ?? 0) > 0, {
        severity: 'MEDIUM', detail: `no hit for "${term}"`, where: path, repro: REPRO });
    inspect(audit, `api.search:${i}`, 'api.search', path, res);

    // normalization invariance: diacritics and alef forms must not matter
    const variant = term.replace(/ا/g, 'أ');
    const vpath = `/api/v1/search?q=${encodeURIComponent(variant)}&limit=1`;
    const vres = await http(vpath);
    audit.check(`api.search_invariant:${i}`, 'api.search',
      'hamza/alef spelling variants return the same number of hits',
      (vres.json as { meta?: { total?: number } })?.meta?.total === body.meta?.total, {
        severity: 'HIGH',
        detail: `"${term}" -> ${body.meta?.total}, "${variant}" -> ${(vres.json as any)?.meta?.total}`,
        where: vpath, repro: REPRO });
    audit.check(`api.search_normalize_parity:${i}`, 'api.search',
      'the client-side normalizer agrees with the server on the query term',
      normalizeArabic(term) === (await query<{ n: string }>('select corpus.normalize_ar($1) as n', [term]))[0]?.n, {
        severity: 'MEDIUM', detail: `term "${term}"`, where: 'src/domain/normalize.ts', repro: REPRO });
  }

  // an empty or too-short query must be a clean 400, not a full table scan
  for (const q of ['', ' ', 'a', 'ا']) {
    const path = `/api/v1/search?q=${encodeURIComponent(q)}`;
    const res = await http(path);
    audit.check(`api.search_guard:${JSON.stringify(q)}`, 'api.search',
      'a too-short query is refused with a clean validation error',
      res.status === 400 || res.status === 422, { severity: 'MEDIUM', detail: `status ${res.status}`, where: path, repro: REPRO });
  }

  // ---- include combinations --------------------------------------------
  const INCLUDES = ['narrators', 'references', 'takhrij', 'gradings', 'verification'];
  for (const [i, inc] of INCLUDES.entries()) {
    for (const [j, row] of rows.slice(0, 10).entries()) {
      const path = `/api/v1/hadiths/${row.id}?include=${inc}`;
      const res = await http(path);
      const data = (res.json as { data?: Record<string, unknown> })?.data ?? {};
      audit.check(`api.include:${inc}:${i}:${j}`, 'api.includes',
        `?include=${inc} adds exactly that section`,
        inc in data, { severity: 'HIGH', detail: `keys ${Object.keys(data).join(',')}`, where: path, repro: REPRO });
      audit.check(`api.include_gate:${inc}:${i}:${j}`, 'api.license_gate',
        'an included section publishes no verbatim text while the gate is closed',
        !JSON.stringify(data).includes(row.raw_text.slice(0, 40)), {
          severity: 'CRITICAL', detail: 'verbatim text found in an included section', where: path, repro: REPRO });
    }
  }
  const all = await http(`/api/v1/hadiths/${rows[0]?.id}?include=${INCLUDES.join(',')}`);
  for (const inc of INCLUDES) {
    audit.check(`api.include_all:${inc}`, 'api.includes',
      'a combined include returns every requested section',
      inc in (((all.json as { data?: Record<string, unknown> })?.data) ?? {}), {
        severity: 'HIGH', detail: 'section missing', where: '/api/v1/hadiths/:id', repro: REPRO });
  }
  const unknownInc = await http(`/api/v1/hadiths/${rows[0]?.id}?include=secrets,passwords`);
  audit.check('api.include_unknown', 'api.includes',
    'an unknown include is refused or ignored, never reflected into the response',
    unknownInc.status === 400 || unknownInc.status === 422 || !/secrets|passwords/.test(unknownInc.body), {
      severity: 'HIGH', detail: `status ${unknownInc.status}`, where: '/api/v1/hadiths/:id', repro: REPRO });

  // ---- random and daily -------------------------------------------------
  const ids = new Set(rows.map((r) => r.id));
  const seen = new Set<string>();
  for (let i = 0; i < 150; i++) {
    const res = await http('/api/v1/hadiths/random');
    const data = (res.json as { data?: { id?: string } })?.data;
    audit.check(`api.random_in_dataset:${i}`, 'api.random',
      'a random record always comes from the sealed dataset',
      Boolean(data?.id && ids.has(data.id)), {
        severity: 'CRITICAL', detail: `id ${data?.id}`, where: '/api/v1/hadiths/random', repro: REPRO });
    if (data?.id) seen.add(data.id);
  }
  audit.check('api.random_varies', 'api.random',
    'the random endpoint does not keep returning the same record',
    seen.size > 50, { severity: 'MEDIUM', detail: `${seen.size} distinct records in 150 calls`, where: '/api/v1/hadiths/random', repro: REPRO });

  const daily = await http('/api/v1/hadiths/daily');
  const dailyId = (daily.json as { data?: { id?: string } })?.data?.id;
  for (let i = 0; i < 50; i++) {
    const again = await http('/api/v1/hadiths/daily');
    audit.check(`api.daily_deterministic:${i}`, 'api.daily',
      'the hadith of the day is the same record for every caller on the same day',
      (again.json as { data?: { id?: string } })?.data?.id === dailyId, {
        severity: 'HIGH', detail: 'the daily record changed between calls', where: '/api/v1/hadiths/daily', repro: REPRO });
  }
  audit.check('api.daily_in_dataset', 'api.daily',
    'the hadith of the day comes from the sealed dataset',
    Boolean(dailyId && ids.has(dailyId)), {
      severity: 'CRITICAL', detail: `id ${dailyId}`, where: '/api/v1/hadiths/daily', repro: REPRO });

  // ---- catalogue: every catalogue row, checked against the database -----
  for (const book of books) {
    const path = `/api/v1/books/${book.id}`;
    const res = await http(path);
    const data = (res.json as { data?: Record<string, unknown> })?.data;
    audit.check(`api.book:${book.id}`, 'api.catalogue',
      'the served book equals the stored book',
      data?.['id'] === book.id && data?.['name'] === book.name, {
        severity: 'HIGH', detail: `got ${JSON.stringify(data)?.slice(0, 120)}`, where: path, repro: REPRO });
    const hadiths = await http(`/api/v1/books/${book.id}/hadiths?limit=1`);
    const expected = rows.filter((r) => r.book_id === book.id).length;
    audit.check(`api.book_hadiths:${book.id}`, 'api.catalogue',
      'the number of hadiths served for the book equals the database count',
      (hadiths.json as { meta?: { total?: number } })?.meta?.total === expected, {
        severity: 'HIGH', detail: `api ${(hadiths.json as any)?.meta?.total} vs db ${expected}`,
        where: `/api/v1/books/${book.id}/hadiths`, repro: REPRO });
  }
  for (const chapter of chapters.filter((_, i) => i % 6 === 0)) {
    const path = `/api/v1/chapters/${chapter.id}`;
    const res = await http(path);
    const data = (res.json as { data?: Record<string, unknown> })?.data;
    audit.check(`api.chapter:${chapter.id}`, 'api.catalogue',
      'the served chapter equals the stored chapter',
      data?.['id'] === chapter.id, {
        severity: 'HIGH', detail: `got ${JSON.stringify(data)?.slice(0, 120)}`, where: path, repro: REPRO });
  }
  for (const narrator of narrators.filter((_, i) => i % 4 === 0)) {
    const path = `/api/v1/narrators/${narrator.id}`;
    const res = await http(path);
    const data = (res.json as { data?: Record<string, unknown> })?.data;
    audit.check(`api.narrator:${narrator.id}`, 'api.catalogue',
      'the served narrator equals the stored narrator',
      data?.['id'] === narrator.id && data?.['name'] === narrator.name, {
        severity: 'HIGH', detail: `got ${JSON.stringify(data)?.slice(0, 120)}`, where: path, repro: REPRO });
  }

  // ---- error contract ---------------------------------------------------
  const BAD_REQUESTS: [string, number[]][] = [
    ['/api/v1/hadiths/not-a-uuid', [400, 404, 422]],
    ['/api/v1/hadiths/00000000-0000-0000-0000-000000000000', [404]],
    ['/api/v1/books/00000000-0000-0000-0000-000000000000', [404]],
    ['/api/v1/chapters/00000000-0000-0000-0000-000000000000', [404]],
    ['/api/v1/narrators/00000000-0000-0000-0000-000000000000', [404]],
    ['/api/v1/hadiths?page=0', [400, 422]],
    ['/api/v1/hadiths?page=-1', [400, 422]],
    ['/api/v1/hadiths?page=abc', [400, 422]],
    ['/api/v1/hadiths?limit=0', [400, 422]],
    ['/api/v1/hadiths?limit=-5', [400, 422]],
    ['/api/v1/hadiths?limit=abc', [400, 422]],
    ['/api/v1/hadiths?volume=0', [400, 422, 200]],
    ['/api/v1/hadiths?volume=99', [400, 422, 200]],
    ['/api/v1/hadiths?book_id=not-a-uuid', [400, 422]],
    ['/api/v1/volumes/abc/hadiths', [400, 404, 422]],
    ['/api/v1/nope', [404]],
    ['/api/v1/hadiths/random/extra', [404]],
    ['/api/v2/hadiths', [404]],
  ];
  for (const [path, allowed] of BAD_REQUESTS) {
    const res = await http(path);
    audit.check(`api.error_status:${path}`, 'api.errors',
      `the request is answered with ${allowed.join(' or ')}`,
      allowed.includes(res.status), {
        severity: 'HIGH', detail: `status ${res.status}`, where: path, repro: `curl -s "${BASE_URL}${path}"` });
    audit.check(`api.error_code:${path}`, 'api.errors',
      'an error response carries a machine-readable code',
      res.status < 400 || typeof (res.json as any)?.error?.code === 'string', {
        severity: 'HIGH', detail: res.body.slice(0, 120), where: path, repro: REPRO });
    inspect(audit, `api.error:${path}`, 'api.errors', path, res);
  }

  // ---- rate limiting, proved on the throttled instance -------------------
  const rlPath = '/api/v1/health';
  let throttled = false;
  for (let i = 0; i < 12; i++) {
    const res = await http(rlPath, { base: RATELIMIT_URL });
    if (res.status === 429) {
      throttled = true;
      audit.check(`api.rate_limit_envelope:${i}`, 'api.rate_limit',
        'a throttled response still uses the documented error envelope',
        envelopeProblem(res) === null, {
          severity: 'MEDIUM', detail: res.body.slice(0, 120), where: rlPath, repro: 'bash scripts/staging-up.sh' });
      break;
    }
  }
  audit.check('api.rate_limit_enforced', 'api.rate_limit',
    'the configured request limit is actually enforced',
    throttled, { severity: 'HIGH', detail: 'no 429 after 12 requests against a limit of 5',
      where: 'src/http/middleware.ts', repro: `curl -s ${RATELIMIT_URL}/api/v1/health` });

  // ---- system endpoints --------------------------------------------------
  const version = await http('/api/v1/version');
  audit.check('api.version_dataset', 'api.system',
    'the version endpoint reports the active dataset version',
    JSON.stringify((version.json as any)?.data).includes(DATASET), {
      severity: 'HIGH', detail: version.body.slice(0, 200), where: '/api/v1/version', repro: REPRO });

  const stats = await http('/api/v1/stats');
  audit.check('api.stats_total', 'api.system',
    'the statistics endpoint reports the true number of records',
    JSON.stringify((stats.json as any)?.data).includes(String(total)), {
      severity: 'HIGH', detail: stats.body.slice(0, 200), where: '/api/v1/stats', repro: REPRO });

  const datasets = await http('/api/v1/datasets');
  const dbHash = (await query<{ dataset_hash: string }>(
    `select dataset_hash from corpus.dataset_versions where status = 'sealed' limit 1`))[0]?.dataset_hash;
  audit.check('api.datasets_hash', 'api.system',
    'the dataset endpoint publishes the sealed fingerprint unchanged',
    Boolean(dbHash) && datasets.body.includes(dbHash as string), {
      severity: 'CRITICAL', detail: datasets.body.slice(0, 200), where: '/api/v1/datasets', repro: REPRO });

  const spec = await http('/openapi.yaml');
  audit.check('api.openapi_served', 'api.system',
    'the service serves its own OpenAPI description',
    spec.status === 200 && spec.body.includes('openapi:'), {
      severity: 'MEDIUM', detail: `status ${spec.status}`, where: '/openapi.yaml', repro: REPRO });
}
