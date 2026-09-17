/**
 * Calls every route the router actually serves against a running API and
 * prints one line per endpoint. Evidence for §9 of the final task: the list is
 * taken from the router, so an endpoint cannot be silently skipped.
 *
 *   node --experimental-strip-types src/scripts/smoke-endpoints.ts [baseUrl]
 */
import { listRoutes } from '../http/router.ts';
import '../http/app.ts';
import { closePool, query, queryOne } from '../db.ts';
import { config } from '../config.ts';

const base = process.argv[2] ?? `http://127.0.0.1:${config.port}`;
const adminKey = config.adminApiKey;

interface CreatedRow {
  data?: { id?: string; verification?: { id?: string } };
}

interface Result {
  method: string;
  path: string;
  url: string;
  auth: boolean;
  status: number;
  expected: number[];
  ok: boolean;
  note: string;
}

async function firstId(sql: string): Promise<string | null> {
  const row = await queryOne<{ id: string }>(sql);
  return row?.id ?? null;
}

async function main(): Promise<void> {
  const ids = {
    hadith: await firstId('select id from corpus.hadiths limit 1'),
    book: await firstId('select id from corpus.books limit 1'),
    chapter: await firstId('select id from corpus.chapters limit 1'),
    narrator: await firstId('select id from corpus.narrators limit 1'),
    edition: await firstId('select id from corpus.editions limit 1'),
    import: await firstId('select id from corpus.raw_imports limit 1'),
  };
  // the dataset of the hadith we sample — a sample must not cross datasets
  const dataset = (await queryOne<{ dataset_version: string }>(
    'select dataset_version from corpus.hadiths limit 1'))?.dataset_version ?? '';
  const collectionName = (await queryOne<{ source_name: string }>(
    'select source_name from corpus.hadith_sources limit 1'))?.source_name ?? null;
  const volume = (await queryOne<{ volume_number: number }>(
    'select volume_number from corpus.hadiths where volume_number is not null limit 1'))?.volume_number ?? null;
  const sourceId = (await queryOne<{ id: string }>('select id from corpus.sources limit 1'))?.id ?? null;
  const number = (await queryOne<{ hadith_number: string }>(
    'select hadith_number from corpus.hadiths where hadith_number is not null limit 1'))?.hadith_number;

  const results: Result[] = [];
  // Rows the probe itself creates are removed afterwards: a smoke run must not
  // leave machine-made verification rows sitting in a real corpus.
  const created: CreatedRow[] = [];

  for (const route of listRoutes()) {
    const isAdmin = route.path.includes('/admin/');
    let path = route.path;
    let note = '';

    if (path.includes('/collections/:name/')) {
      if (collectionName) path = path.replace(':name', encodeURIComponent(collectionName));
    } else if (path.includes('/volumes/:volume/')) {
      if (volume !== null) path = path.replace(':volume', String(volume));
    } else if (path.includes('/sources/:id')) {
      path = path.replace(':id', sourceId ?? '');
    } else if (path.includes('/hadiths/by-number/')) {
      // An edition that prints no hadith numbers (e.g. الجامع الكامل) has
      // nothing to look up here — 404 is the correct answer, not a failure.
      path = path.replace(':number', number ?? '1');
      if (!number) note = 'this dataset carries no hadith numbers — 404 is correct';
    }
    else if (path.startsWith('/api/v1/books')) path = path.replace(':id', ids.book ?? '');
    else if (path.startsWith('/api/v1/chapters')) path = path.replace(':id', ids.chapter ?? '');
    else if (path.startsWith('/api/v1/narrators')) path = path.replace(':id', ids.narrator ?? '');
    else if (path.startsWith('/api/v1/editions')) path = path.replace(':id', ids.edition ?? '');
    else if (path.includes('/admin/imports/')) path = path.replace(':id', ids.import ?? '');
    else path = path.replace(':id', ids.hadith ?? '');

    if (path.includes(':') || path.endsWith('/')) {
      results.push({ method: route.method, path: route.path, url: path, auth: isAdmin,
        status: 0, expected: [], ok: false, note: 'no seeded id available' });
      continue;
    }
    if (route.path === '/api/v1/search') path += '?q=' + encodeURIComponent('اختبار'); // 2+ chars: the API rejects shorter terms

    const init: RequestInit = { method: route.method, headers: {} };
    if (isAdmin && adminKey) (init.headers as Record<string, string>)['authorization'] = `Bearer ${adminKey}`;

    if (route.method === 'POST') {
      (init.headers as Record<string, string>)['content-type'] = 'application/json';
      if (route.path.endsWith('/verify')) {
        init.body = JSON.stringify({
          verification_type: 'hash_check',
          verified_by: 'smoke-endpoints',
          result: 'passed',
          notes: 'automated endpoint smoke check',
        });
        note = 'hash_check only — does not mark the hadith verified';
      } else {
        init.body = JSON.stringify({
          dataset_version: dataset,
          sample_hadith_ids: ids.hadith ? [ids.hadith] : [],
          verifier: 'smoke-endpoints',
          exact_matches: 0,
          status: 'pending',
          notes: 'automated endpoint smoke check — not a human verification',
        });
        note = 'status=pending — never a pass';
      }
    }

    const expected =
      route.method === 'POST' ? [201] : note.includes('404 is correct') ? [404] : [200];
    const res = await fetch(`${base}${path}`, init);
    if (route.method === 'POST' && res.ok) created.push(await res.clone().json() as CreatedRow);
    results.push({
      method: route.method, path: route.path, url: path, auth: isAdmin,
      status: res.status, expected, ok: expected.includes(res.status), note,
    });

    if (isAdmin && route.method === 'GET') {
      const noAuth = await fetch(`${base}${path}`);
      results.push({
        method: route.method, path: route.path, url: path + '  (no credential)', auth: false,
        status: noAuth.status, expected: [401], ok: noAuth.status === 401, note: 'must be refused',
      });
    }
  }

  let cleaned = 0;
  for (const row of created) {
    const sampleId = row.data?.id;
    const verificationId = row.data?.verification?.id;
    if (sampleId) {
      const del = await query<{ id: string }>(
        'delete from corpus.verification_samples where id = $1 returning id', [sampleId]);
      cleaned += del.length;
    }
    if (verificationId) {
      const del = await query<{ id: string }>(
        'delete from corpus.verification_records where id = $1 returning id', [verificationId]);
      cleaned += del.length;
    }
  }

  const width = Math.max(...results.map((r) => r.url.length));
  console.log('============ ENDPOINT SMOKE RUN ============');
  console.log(`base: ${base}`);
  for (const r of results) {
    console.log(
      `${r.ok ? 'PASS' : 'FAIL'}  ${r.method.padEnd(4)} ${r.url.padEnd(width)}  ` +
        `${r.status} (expected ${r.expected.join('/') || '—'})${r.note ? '  · ' + r.note : ''}`,
    );
  }
  const failed = results.filter((r) => !r.ok).length;
  if (results.some((r) => r.status === 429)) {
    console.log(
      'NOTE: some calls were rate-limited (429). A full sweep costs ~48 requests;\n' +
        '      run the server with RATE_LIMIT_MAX=1000 when smoke-testing repeatedly.',
    );
  }
  console.log('-------------------------------------------');
  console.log(
    `endpoints served: ${listRoutes().length} · checks: ${results.length} · failed: ${failed}` +
      ` · probe rows cleaned up: ${cleaned}`,
  );
  console.log(failed === 0 ? 'RESULT: PASS' : 'RESULT: FAIL');
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(`smoke run failed: ${(err as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => void closePool());
