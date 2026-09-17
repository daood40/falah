/**
 * Category: api — real HTTP requests against the real server. Every surah and
 * every one of the 6,236 ayahs is fetched through the API and compared with
 * the source dataset, then the parameter combinations and error paths are
 * exercised.
 */
import type { GateContext } from '../context.ts';

const CATEGORY = 'api';
const V1 = '/api/v1';

export async function run(ctx: GateContext): Promise<void> {
  const { gate, request, dataset } = ctx;
  const sourceByKey = new Map(dataset.ayahs.map((ayah) => [`${ayah.surah_number}:${ayah.ayah_number}`, ayah]));

  // 1. Every ayah, through the public read path, compared with the source.
  for (const ayah of dataset.ayahs) {
    const key = `${ayah.surah_number}:${ayah.ayah_number}`;
    const response = await request(`${V1}/ayahs/by-key/${key}`);
    const data = response.body?.data;
    const failures: string[] = [];
    if (response.status !== 200) failures.push(`status ${response.status}`);
    if (data?.text !== ayah.raw_text) failures.push('text differs from source');
    if (data?.ayah_key !== key) failures.push('ayah_key');
    if (data?.global_ayah_number !== ayah.global_ayah_number) failures.push('global_ayah_number');
    if (data?.page !== ayah.page_number) failures.push('page');
    gate.check(
      `API-AYAH-${String(ayah.global_ayah_number).padStart(4, '0')}`,
      CATEGORY,
      `GET /ayahs/by-key/${key} returns the source text unchanged`,
      { method: 'GET', path: `${V1}/ayahs/by-key/${key}` },
      failures.length === 0,
      '200 with text identical to the source dataset',
      failures.length === 0 ? '200 + identical text' : failures.join(','),
      'CRITICAL',
      5,
    );
  }

  // 2. Every surah: metadata endpoint and the full ayah listing.
  for (const surah of dataset.surahs) {
    const detail = await request(`${V1}/surahs/${surah.surah_number}`);
    const data = detail.body?.data;
    const detailOk =
      detail.status === 200 &&
      data?.surah_number === surah.surah_number &&
      data?.name_ar === surah.name_ar &&
      data?.ayah_count === surah.ayah_count;
    gate.check(
      `API-SURAH-${String(surah.surah_number).padStart(3, '0')}`,
      CATEGORY,
      `GET /surahs/${surah.surah_number} returns the source metadata`,
      { method: 'GET', path: `${V1}/surahs/${surah.surah_number}` },
      detailOk,
      '200 with name_ar and ayah_count identical to the source',
      detailOk ? '200 + identical metadata' : `status ${detail.status}, name ${data?.name_ar}, count ${data?.ayah_count}`,
      'HIGH',
      4,
    );

    // The API caps a page at 100 rows, so a long surah is walked page by page —
    // the whole surah still travels through the HTTP layer.
    const rows: any[] = [];
    let pageNumber = 1;
    let list = await request(`${V1}/surahs/${surah.surah_number}/ayahs?limit=100&page=1`);
    while (list.status === 200 && Array.isArray(list.body?.data) && list.body.data.length > 0) {
      rows.push(...list.body.data);
      if (rows.length >= surah.ayah_count) break;
      pageNumber += 1;
      list = await request(`${V1}/surahs/${surah.surah_number}/ayahs?limit=100&page=${pageNumber}`);
    }
    let textMismatch = 0;
    for (const row of rows) {
      const source = sourceByKey.get(row.ayah_key);
      if (!source || source.raw_text !== row.text) textMismatch += 1;
    }
    const listOk = list.status === 200 && rows.length === surah.ayah_count && textMismatch === 0;
    gate.check(
      `API-SURAH-AYAHS-${String(surah.surah_number).padStart(3, '0')}`,
      CATEGORY,
      `GET /surahs/${surah.surah_number}/ayahs returns all ${surah.ayah_count} ayahs with source text`,
      { method: 'GET', path: `${V1}/surahs/${surah.surah_number}/ayahs?limit=100 (paged)` },
      listOk,
      `200 with ${surah.ayah_count} ayahs, zero text mismatches`,
      `status ${list.status}, ${rows.length} ayahs, ${textMismatch} mismatches`,
      'CRITICAL',
      surah.ayah_count + 2,
    );
  }

  // 3. Structural endpoints, one case per real division.
  const divisions: { path: (n: number) => string; count: number; prefix: string; expect: number }[] = [
    { path: (n) => `${V1}/juzs/${n}`, count: 30, prefix: 'API-JUZ', expect: 200 },
    { path: (n) => `${V1}/juzs/${n}/ayahs?limit=100`, count: 30, prefix: 'API-JUZ-AYAHS', expect: 200 },
    { path: (n) => `${V1}/hizbs/${n}`, count: 60, prefix: 'API-HIZB', expect: 200 },
    { path: (n) => `${V1}/hizbs/${n}/ayahs?limit=100`, count: 60, prefix: 'API-HIZB-AYAHS', expect: 200 },
    { path: (n) => `${V1}/rubs/${n}/ayahs?limit=100`, count: 240, prefix: 'API-RUB-AYAHS', expect: 200 },
    { path: (n) => `${V1}/pages/${n}`, count: 604, prefix: 'API-PAGE', expect: 200 },
    { path: (n) => `${V1}/pages/${n}/ayahs?limit=100`, count: 604, prefix: 'API-PAGE-AYAHS', expect: 200 },
    { path: (n) => `${V1}/manzils/${n}/ayahs?limit=100`, count: 7, prefix: 'API-MANZIL-AYAHS', expect: 200 },
  ];
  for (const division of divisions) {
    for (let number = 1; number <= division.count; number += 1) {
      const target = division.path(number);
      const response = await request(target);
      const payload = response.body?.data;
      const nonEmpty = Array.isArray(payload) ? payload.length > 0 : payload != null;
      gate.check(
        `${division.prefix}-${String(number).padStart(3, '0')}`,
        CATEGORY,
        `GET ${target} responds ${division.expect} with data`,
        { method: 'GET', path: target },
        response.status === division.expect && nonEmpty,
        `${division.expect} with a non-empty payload`,
        `status ${response.status}, payload ${Array.isArray(payload) ? `${payload.length} rows` : typeof payload}`,
        'HIGH',
        2,
      );
    }
  }

  // 4. Out-of-range and malformed identifiers on every numeric endpoint.
  const rangeCases: { path: string; expect: number[] }[] = [];
  for (const [prefix, max] of [
    ['juzs', 30],
    ['hizbs', 60],
  ] as const) {
    for (const value of ['0', String(max + 1), '-1', 'abc', '1.5', '999999999999', ' ', '1;drop']) {
      rangeCases.push({ path: `${V1}/${prefix}/${encodeURIComponent(value)}`, expect: [400, 404, 422] });
    }
  }
  for (const value of ['0', '605', '-3', 'x', '1e3']) {
    rangeCases.push({ path: `${V1}/pages/${encodeURIComponent(value)}`, expect: [400, 404, 422] });
  }
  for (const value of ['0:1', '115:1', '2:0', '2:287', 'x:1', '1:', ':1', '1:1:1']) {
    rangeCases.push({ path: `${V1}/ayahs/by-key/${encodeURIComponent(value)}`, expect: [400, 404, 422] });
  }
  for (const [index, testCase] of rangeCases.entries()) {
    const response = await request(testCase.path);
    gate.check(
      `API-RANGE-${String(index + 1).padStart(3, '0')}`,
      CATEGORY,
      `GET ${testCase.path} is refused cleanly, never with a server error`,
      { method: 'GET', path: testCase.path },
      testCase.expect.includes(response.status),
      testCase.expect.join(' or '),
      response.status,
      'HIGH',
      1,
    );
  }

  // 5. Pagination and query-parameter combinations on the ayah listing.
  const limits = [1, 2, 5, 10, 25, 50, 75, 100];
  const pages = [1, 2, 3, 4, 5, 6, 10, 20];
  let combination = 0;
  for (const limit of limits) {
    for (const pageNumber of pages) {
      combination += 1;
      const target = `${V1}/surahs/2/ayahs?limit=${limit}&page=${pageNumber}`;
      const response = await request(target);
      const rows: any[] = response.body?.data ?? [];
      const expectedRows = Math.max(0, Math.min(limit, 286 - (pageNumber - 1) * limit));
      const meta = response.body?.meta;
      const ok =
        response.status === 200 &&
        rows.length === expectedRows &&
        meta?.total === 286 &&
        meta?.page === pageNumber &&
        meta?.total_pages === Math.ceil(286 / limit);
      gate.check(
        `API-PAGE-COMBO-${String(combination).padStart(3, '0')}`,
        CATEGORY,
        `limit=${limit} page=${pageNumber} returns exactly the expected window of surah 2`,
        { method: 'GET', path: target },
        ok,
        `200 with ${expectedRows} rows and meta.total 286`,
        `status ${response.status}, ${rows.length} rows, total ${meta?.total}, page ${meta?.page}, total_pages ${meta?.total_pages}`,
        'MEDIUM',
        5,
      );
    }
  }

  // 5b. Paging really moves the window (a page that ignored `page` would pass
  // the size check above but fail this one).
  const firstPage = await request(`${V1}/surahs/2/ayahs?limit=10&page=1`);
  const secondPage = await request(`${V1}/surahs/2/ayahs?limit=10&page=2`);
  const firstKeys = (firstPage.body?.data ?? []).map((row: any) => row.ayah_key);
  const secondKeys = (secondPage.body?.data ?? []).map((row: any) => row.ayah_key);
  gate.check(
    'API-PAGE-WINDOW',
    CATEGORY,
    'page 2 returns the next ten ayahs, not the first ten again',
    { first: firstKeys.slice(0, 3), second: secondKeys.slice(0, 3) },
    firstKeys[0] === '2:1' && secondKeys[0] === '2:11' && firstKeys.every((key: string) => !secondKeys.includes(key)),
    'page 1 starts at 2:1, page 2 starts at 2:11, no overlap',
    `page1[0]=${firstKeys[0]}, page2[0]=${secondKeys[0]}`,
    'HIGH',
    3,
  );

  // 6. Invalid pagination input.
  let invalid = 0;
  for (const query of ['limit=0', 'limit=-1', 'limit=abc', 'limit=99999', 'page=0', 'page=abc', 'page=-5', 'limit=1e5']) {
    invalid += 1;
    const target = `${V1}/surahs/1/ayahs?${query}`;
    const response = await request(target);
    gate.check(
      `API-PAGE-INVALID-${String(invalid).padStart(2, '0')}`,
      CATEGORY,
      `invalid pagination (${query}) is rejected or clamped, never a server error`,
      { method: 'GET', path: target },
      response.status === 200 || response.status === 400 || response.status === 422,
      '200 (clamped), 400 or 422',
      response.status,
      'HIGH',
      1,
    );
  }

  // 7. Metadata endpoints.
  const metaEndpoints = ['/health', '/version', '/stats', '/sources', '/editions', '/datasets', '/schemes', '/qiraat', '/riwayat', '/translations', '/sajdahs', '/juzs', '/hizbs', '/manzils', '/surahs', '/reciters'];
  for (const endpoint of metaEndpoints) {
    const response = await request(`${V1}${endpoint}`);
    gate.check(
      `API-META${endpoint.replace(/\//g, '-')}`,
      CATEGORY,
      `GET ${endpoint} responds 200 with a JSON body`,
      { method: 'GET', path: `${V1}${endpoint}` },
      response.status === 200 && typeof response.body === 'object',
      '200 + JSON',
      `${response.status} ${typeof response.body}`,
      'HIGH',
      2,
    );
  }

  // 8. Method handling on read-only endpoints.
  let method = 0;
  for (const verb of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const endpoint of ['/surahs', '/surahs/1', '/ayahs/by-key/1:1', '/juzs/1', '/pages/1', '/search?q=test', '/stats', '/version']) {
      method += 1;
      const response = await request(`${V1}${endpoint}`, { method: verb });
      gate.check(
        `API-METHOD-${String(method).padStart(3, '0')}`,
        CATEGORY,
        `${verb} ${endpoint} is rejected — the data API is read-only`,
        { method: verb, path: `${V1}${endpoint}` },
        response.status === 404 || response.status === 405 || response.status === 401,
        '404, 405 or 401',
        response.status,
        'HIGH',
        1,
      );
    }
  }

  // 9. Unknown routes and versioning.
  let unknown = 0;
  for (const target of ['/api/v1/does-not-exist', '/api/v2/surahs', '/api/surahs', '/surahs', '/', '/api/v1/', '/api/v1/surahs/1/unknown', '/api/v1/ayahs']) {
    unknown += 1;
    const response = await request(target);
    gate.check(
      `API-UNKNOWN-${String(unknown).padStart(2, '0')}`,
      CATEGORY,
      `GET ${target} returns a structured 404, not a stack trace`,
      { method: 'GET', path: target },
      response.status === 404 && typeof response.body === 'object' && response.body?.error != null,
      '404 with an error object',
      `${response.status} ${JSON.stringify(response.body).slice(0, 80)}`,
      'HIGH',
      2,
    );
  }

  // 10. Response envelope and observability headers on a real read.
  const sample = await request(`${V1}/surahs/1/ayahs?limit=3`);
  gate.check('API-ENV-DATA', CATEGORY, 'successful responses carry a data array', { path: `${V1}/surahs/1/ayahs?limit=3` }, Array.isArray(sample.body?.data), 'array', typeof sample.body?.data, 'MEDIUM', 1);
  gate.check('API-ENV-META', CATEGORY, 'successful list responses carry pagination meta', { path: `${V1}/surahs/1/ayahs?limit=3` }, typeof sample.body?.meta?.total === 'number', 'meta.total number', typeof sample.body?.meta?.total, 'MEDIUM', 1);
  gate.check('API-ENV-REQID', CATEGORY, 'every response carries an x-request-id header', { path: `${V1}/surahs/1/ayahs?limit=3` }, (sample.headers.get('x-request-id') ?? '').length > 0, 'non-empty x-request-id', sample.headers.get('x-request-id'), 'MEDIUM', 1);
  gate.check('API-ENV-CT', CATEGORY, 'responses declare application/json', { path: `${V1}/surahs/1/ayahs?limit=3` }, (sample.headers.get('content-type') ?? '').includes('application/json'), 'application/json', sample.headers.get('content-type'), 'LOW', 1);
}
