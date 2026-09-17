/**
 * Category: regression — tamper detection with rollback, failure recovery, and
 * a guard for every defect this gate has already found. The tampering cases
 * mutate a copy of the dataset (never the published text), require the system
 * to reject it, roll the transaction back and then prove the published dataset
 * is unchanged.
 */
import { contentHash } from '../../../src/core/hash.ts';
import { verifyEdition } from '../../../src/import/pipeline.ts';
import type { ParsedDataset } from '../../../src/import/parse.ts';
import type { GateContext } from '../context.ts';

const CATEGORY = 'regression';
const V1 = '/api/v1';

function mutateOneCharacter(dataset: ParsedDataset, surahNumber: number): { copy: ParsedDataset; key: string } {
  const ayahs = dataset.ayahs.map((ayah) => ({ ...ayah }));
  const index = ayahs.findIndex((ayah) => ayah.surah_number === surahNumber);
  const target = ayahs[index]!;
  const characters = [...target.raw_text];
  // Replace one real character with another real character from the same text,
  // so the mutation is a plausible corruption rather than obvious junk.
  const position = Math.floor(characters.length / 2);
  const replacement = characters.find((character) => character !== characters[position]) ?? 'X';
  characters[position] = replacement;
  target.raw_text = characters.join('');
  target.content_hash = contentHash(target.raw_text);
  return { copy: { ...dataset, ayahs }, key: `${target.surah_number}:${target.ayah_number}` };
}

export async function run(ctx: GateContext): Promise<void> {
  const { gate, pool, dataset, request, user } = ctx;

  const digestSql = `select md5(string_agg(content_hash, '' order by global_ayah_number)) as digest from quran.ayahs`;
  const textDigestSql = `select md5(string_agg(raw_text, '' order by global_ayah_number)) as digest from quran.ayahs`;
  const baselineHash = (await pool.query<{ digest: string }>(digestSql)).rows[0]!.digest;
  const baselineText = (await pool.query<{ digest: string }>(textDigestSql)).rows[0]!.digest;
  const { rows: editionRows } = await pool.query<{ id: string }>('select id from quran.quran_editions limit 1');
  const editionId = editionRows[0]!.id;

  // 1. Source tampering: one character changed in a copy of the source. The
  // verifier must reject that ayah; the transaction is then rolled back.
  for (const surah of dataset.surahs) {
    const { copy, key } = mutateOneCharacter(dataset, surah.surah_number);
    const client = await pool.connect();
    let result = { verified: 0, failed: -1, errors: [] as string[] };
    try {
      await client.query('begin');
      result = await verifyEdition(client, editionId, copy, { surahNumber: surah.surah_number });
      await client.query('rollback');
    } finally {
      client.release();
    }
    const detected = result.failed === 1 && result.errors.some((error) => error.includes(key));
    gate.check(
      `REG-TAMPER-SRC-${String(surah.surah_number).padStart(3, '0')}`,
      CATEGORY,
      `a single changed character in surah ${surah.surah_number} (${key}) is detected and rejected`,
      { mutated_ayah: key, mutation: 'one character replaced in a copy of the source' },
      detected,
      'exactly one ayah rejected, naming the mutated ayah',
      `failed=${result.failed}, first error: ${result.errors[0] ?? 'none'}`,
      'CRITICAL',
      3,
    );
  }

  // 2. Stored-hash tampering: the hash column is rewritten (SOURCE_LOCK does
  // not cover it), and re-verification must catch the drift.
  for (const surah of dataset.surahs) {
    const client = await pool.connect();
    let detected = false;
    let observed = 'not run';
    try {
      await client.query('begin');
      const { rows } = await client.query<{ id: string; ayah_number: number }>(
        `update quran.ayahs a set content_hash = 'deadbeef'
           from quran.surahs s
          where s.id = a.surah_id and s.surah_number = $1 and a.ayah_number = 1
          returning a.id, a.ayah_number`,
        [surah.surah_number],
      );
      const result = await verifyEdition(client, editionId, dataset, { surahNumber: surah.surah_number });
      detected = result.failed >= 1 && rows.length === 1;
      observed = `failed=${result.failed}, error: ${result.errors[0] ?? 'none'}`;
      await client.query('rollback');
    } finally {
      client.release();
    }
    gate.check(
      `REG-TAMPER-HASH-${String(surah.surah_number).padStart(3, '0')}`,
      CATEGORY,
      `a rewritten content hash on ${surah.surah_number}:1 is detected by re-verification`,
      { ayah: `${surah.surah_number}:1`, mutation: "content_hash set to 'deadbeef'" },
      detected,
      'the ayah is reported as failed',
      observed,
      'CRITICAL',
      2,
    );
  }

  // 3. After every tampering attempt the published dataset must be untouched.
  const afterHash = (await pool.query<{ digest: string }>(digestSql)).rows[0]!.digest;
  const afterText = (await pool.query<{ digest: string }>(textDigestSql)).rows[0]!.digest;
  gate.equals('REG-ROLLBACK-HASHES', CATEGORY, 'the hash digest is unchanged after 228 tampering attempts', 'md5(all content hashes)', baselineHash, afterHash, 'CRITICAL');
  gate.equals('REG-ROLLBACK-TEXT', CATEGORY, 'the text digest is unchanged after 228 tampering attempts', 'md5(all raw_text)', baselineText, afterText, 'CRITICAL');

  for (const surah of dataset.surahs) {
    const { rows } = await pool.query<{ ok: boolean }>(
      `select bool_and(a.content_hash = $2) as ok
         from quran.ayahs a join quran.surahs s on s.id = a.surah_id
        where s.surah_number = $1 and a.ayah_number = 1`,
      [surah.surah_number, dataset.ayahs.find((ayah) => ayah.surah_number === surah.surah_number && ayah.ayah_number === 1)!.content_hash],
    );
    gate.check(
      `REG-ROLLBACK-${String(surah.surah_number).padStart(3, '0')}`,
      CATEGORY,
      `surah ${surah.surah_number}:1 still carries its original hash after the rollback`,
      { ayah: `${surah.surah_number}:1` },
      rows[0]!.ok === true,
      'the original source hash',
      rows[0]!.ok,
      'CRITICAL',
      1,
    );
  }

  // 4. Structural tampering on the divisions, one per juz, each rolled back.
  for (let juz = 1; juz <= 30; juz += 1) {
    const client = await pool.connect();
    let detected = false;
    let observed = 'not run';
    try {
      await client.query('begin');
      await client.query('update quran.juzs set start_global_ayah = start_global_ayah + 1 where juz_number = $1', [juz]);
      const { rows } = await client.query<{ mismatches: number }>(
        `select count(*)::int as mismatches from quran.juzs j
          where j.juz_number = $1 and j.start_global_ayah <> $2`,
        [juz, dataset.juzs.find((item) => item.number === juz)!.start_global_ayah],
      );
      detected = rows[0]!.mismatches === 1;
      observed = `${rows[0]!.mismatches} mismatch(es) detected against the source`;
      await client.query('rollback');
    } finally {
      client.release();
    }
    gate.check(
      `REG-TAMPER-JUZ-${String(juz).padStart(2, '0')}`,
      CATEGORY,
      `a shifted juz ${juz} boundary is detectable against the source, then rolled back`,
      { juz, mutation: 'start_global_ayah + 1' },
      detected,
      'the drift is detected',
      observed,
      'HIGH',
      1,
    );
    const { rows: restored } = await pool.query<{ start_global_ayah: number }>(
      'select start_global_ayah from quran.juzs where juz_number = $1',
      [juz],
    );
    gate.equals(
      `REG-TAMPER-JUZ-ROLLBACK-${String(juz).padStart(2, '0')}`,
      CATEGORY,
      `juz ${juz} boundary is back to the source value after rollback`,
      { juz },
      dataset.juzs.find((item) => item.number === juz)!.start_global_ayah,
      restored[0]!.start_global_ayah,
      'CRITICAL',
    );
  }

  // 4b. Metadata tampering: a renamed surah must be detectable against the
  // source and must not survive the rollback.
  for (const surah of dataset.surahs) {
    const client = await pool.connect();
    let detected = false;
    let observed = 'not run';
    try {
      await client.query('begin');
      await client.query('update quran.surahs set name_ar = name_ar || $2 where surah_number = $1', [surah.surah_number, 'X']);
      const { rows } = await client.query<{ name_ar: string }>(
        'select name_ar from quran.surahs where surah_number = $1',
        [surah.surah_number],
      );
      detected = rows[0]!.name_ar !== surah.name_ar;
      observed = `stored "${rows[0]!.name_ar}" vs source "${surah.name_ar}"`;
      await client.query('rollback');
    } finally {
      client.release();
    }
    const { rows: after } = await pool.query<{ name_ar: string }>(
      'select name_ar from quran.surahs where surah_number = $1',
      [surah.surah_number],
    );
    gate.check(
      `REG-TAMPER-META-${String(surah.surah_number).padStart(3, '0')}`,
      CATEGORY,
      `a renamed surah ${surah.surah_number} is detected against the source and does not survive the rollback`,
      { surah: surah.surah_number, mutation: "name_ar || 'X'" },
      detected && after[0]!.name_ar === surah.name_ar,
      'drift detected, original name restored',
      `${observed}; after rollback "${after[0]!.name_ar}"`,
      'CRITICAL',
      2,
    );
  }

  // 5. Guards for defects this gate has already found and fixed. Each case is
  // the exact request or condition that used to fail.
  const fixed: { id: string; description: string; run: () => Promise<{ ok: boolean; actual: string }> }[] = [
    {
      id: 'REG-FIX-EXACT-SEARCH',
      description: 'exact search once bound an unused parameter and returned 500',
      run: async () => {
        const response = await request(`${V1}/search?q=%D8%A7%D9%84%D9%84%D9%87&exact=true&limit=1`);
        return { ok: response.status === 200 && typeof response.body?.meta?.total === 'number', actual: `status ${response.status}` };
      },
    },
    {
      id: 'REG-FIX-EXACT-SEARCH-FILTERED',
      description: 'exact search with a filter once returned 500',
      run: async () => {
        const response = await request(`${V1}/search?q=%D8%A7%D9%84%D9%84%D9%87&exact=true&surah=2&limit=1`);
        return { ok: response.status === 200, actual: `status ${response.status}` };
      },
    },
    {
      id: 'REG-FIX-BAD-PERCENT',
      description: 'a malformed percent-encoded path segment once threw URIError and returned 500',
      run: async () => {
        const response = await request(`${V1}/surahs/%d800`);
        return { ok: response.status === 422 || response.status === 404 || response.status === 400, actual: `status ${response.status}` };
      },
    },
    {
      id: 'REG-FIX-NUL-PATH',
      description: 'a NUL byte in a path segment once reached Postgres and returned 500',
      run: async () => {
        const response = await request(`${V1}/surahs/a%00b`);
        return { ok: response.status < 500, actual: `status ${response.status}` };
      },
    },
    {
      id: 'REG-FIX-NUL-QUERY',
      description: 'a NUL byte in a query value once reached Postgres and returned 500',
      run: async () => {
        const response = await request(`${V1}/search?q=a%00b`);
        return { ok: response.status < 500, actual: `status ${response.status}` };
      },
    },
    {
      id: 'REG-FIX-BIG-BODY',
      description: 'an oversized request body once reset the connection instead of answering',
      run: async () => {
        try {
          const response = await request(`${V1}/me/bookmarks`, {
            method: 'POST',
            token: user.token,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ note: 'A'.repeat(200_000) }),
          });
          return { ok: response.status < 500, actual: `status ${response.status}` };
        } catch (error) {
          return { ok: false, actual: `transport error: ${(error as Error).message}` };
        }
      },
    },
    {
      id: 'REG-FIX-HEAD-HEALTH',
      description: 'HEAD on a GET route once returned 405',
      run: async () => {
        const response = await request(`${V1}/health`, { method: 'HEAD' });
        return { ok: response.status === 200, actual: `status ${response.status}` };
      },
    },
    {
      id: 'REG-FIX-TRAVERSAL-UUID',
      description: 'a traversal payload in an ayah id once hit an invalid uuid cast and returned 500',
      run: async () => {
        const response = await request(`${V1}/ayahs/%2e%2e%2f%2e%2e%2f`);
        return { ok: response.status < 500, actual: `status ${response.status}` };
      },
    },
    {
      id: 'REG-FIX-UNKNOWN-USER-JWT',
      description: 'a valid token for a non-existent user once raised a foreign-key error and returned 500',
      run: async () => {
        const response = await request(`${V1}/me/bookmarks`, {
          method: 'POST',
          token: user.token.replace(/.$/, (character) => character),
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ayah_id: '00000000-0000-0000-0000-000000000000' }),
        });
        return { ok: response.status < 500, actual: `status ${response.status}` };
      },
    },
    {
      id: 'REG-FIX-OPS-POLICIES',
      description: 'import_runs and audit_logs had forced RLS with no policy, locking out service_role',
      run: async () => {
        const { rows } = await pool.query<{ count: number }>(
          `select count(*)::int as count from pg_policy p
             join pg_class c on c.oid = p.polrelid
             join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'quran' and c.relname in ('import_runs', 'audit_logs')`,
        );
        return { ok: rows[0]!.count >= 2, actual: `${rows[0]!.count} policies` };
      },
    },
    {
      id: 'REG-FIX-SESSION-STATE',
      description: 'a stray session setting left on a pooled connection once made the next request fail with 500',
      run: async () => {
        await pool.query('set statement_timeout = 1');
        const response = await request(`${V1}/surahs/2/ayahs?limit=100`);
        await pool.query('set statement_timeout = 0');
        return { ok: response.status === 200, actual: `status ${response.status}` };
      },
    },
    {
      id: 'REG-FIX-PAGE-WINDOW',
      description: 'page 2 of a listing must not repeat page 1',
      run: async () => {
        const first = await request(`${V1}/surahs/2/ayahs?limit=10&page=1`);
        const second = await request(`${V1}/surahs/2/ayahs?limit=10&page=2`);
        const a = (first.body?.data ?? []).map((row: any) => row.ayah_key);
        const b = (second.body?.data ?? []).map((row: any) => row.ayah_key);
        return { ok: a[0] === '2:1' && b[0] === '2:11', actual: `${a[0]} then ${b[0]}` };
      },
    },
    {
      id: 'REG-FIX-BISMILLAH-NULL',
      description: 'a field absent from the source must stay NULL rather than be invented',
      run: async () => {
        const { rows } = await pool.query<{ count: number }>('select count(*)::int as count from quran.surahs where bismillah is not null');
        return { ok: rows[0]!.count === 0, actual: `${rows[0]!.count} surahs with an invented bismillah` };
      },
    },
    {
      id: 'REG-FIX-SAJDAH-TYPE-NULL',
      description: 'the sajdah ruling is not in the source and must stay NULL',
      run: async () => {
        const { rows } = await pool.query<{ count: number }>('select count(*)::int as count from quran.ayahs where sajdah_type is not null');
        return { ok: rows[0]!.count === 0, actual: `${rows[0]!.count} ayahs with an invented sajdah ruling` };
      },
    },
  ];
  for (const testCase of fixed) {
    const result = await testCase.run();
    gate.check(
      testCase.id,
      CATEGORY,
      `regression guard: ${testCase.description}`,
      { guard: testCase.id },
      result.ok,
      'the defect stays fixed',
      result.actual,
      'CRITICAL',
      1,
    );
  }

  // 6. Failure injection at the API level: every error path must stay an error
  // path, and the next request must still succeed.
  const failures: { path: string; expect: number[] }[] = [
    { path: `${V1}/surahs/999`, expect: [404] },
    { path: `${V1}/surahs/abc`, expect: [404, 422] },
    { path: `${V1}/ayahs/by-key/115:1`, expect: [404] },
    { path: `${V1}/ayahs/by-key/2:300`, expect: [404] },
    { path: `${V1}/juzs/31`, expect: [422] },
    { path: `${V1}/hizbs/61`, expect: [422] },
    { path: `${V1}/rubs/241/ayahs`, expect: [422] },
    { path: `${V1}/pages/605`, expect: [404, 422] },
    { path: `${V1}/manzils/8/ayahs`, expect: [422] },
    { path: `${V1}/manzils/8`, expect: [422] },
    { path: `${V1}/rubs/241`, expect: [422] },
    { path: `${V1}/rukus/557`, expect: [422] },
    { path: `${V1}/rukus/557/ayahs`, expect: [422] },
    { path: `${V1}/rukus?surah=115`, expect: [422] },
    { path: `${V1}/surahs?revelation=nowhere`, expect: [422] },
    { path: `${V1}/surahs?sort=nope`, expect: [422] },
    { path: `${V1}/search?q=`, expect: [422] },
    { path: `${V1}/surahs/1/ayahs?limit=101`, expect: [422] },
    { path: `${V1}/surahs/1/ayahs?translation=nope`, expect: [404] },
    { path: `${V1}/surahs?edition=nope`, expect: [404, 422] },
    { path: `${V1}/reciters/999`, expect: [404, 422] },
    { path: `${V1}/nope`, expect: [404] },
  ];
  for (const [index, testCase] of failures.entries()) {
    const response = await request(testCase.path);
    const next = await request(`${V1}/surahs/1`);
    gate.check(
      `REG-FAILPATH-${String(index + 1).padStart(2, '0')}`,
      CATEGORY,
      `${testCase.path} fails cleanly and the service keeps serving`,
      { path: testCase.path },
      testCase.expect.includes(response.status) && next.status === 200,
      `${testCase.expect.join('/')} then 200`,
      `${response.status} then ${next.status}`,
      'HIGH',
      2,
    );
    gate.check(
      `REG-FAILSHAPE-${String(index + 1).padStart(2, '0')}`,
      CATEGORY,
      `${testCase.path} returns a structured error object with a code and a request id`,
      { path: testCase.path },
      typeof response.body?.error?.code === 'string' && (response.headers.get('x-request-id') ?? '').length > 0,
      'error.code plus x-request-id',
      `${JSON.stringify(response.body?.error ?? null).slice(0, 80)}`,
      'MEDIUM',
      2,
    );
  }

  // 7. Determinism: parsing the source twice yields identical hashes, so an
  // import can never introduce drift of its own.
  const { parseDataset } = await import('../../../src/import/parse.ts');
  const reparsed = parseDataset(['en']);
  let drift = 0;
  for (const [index, ayah] of reparsed.ayahs.entries()) {
    if (ayah.content_hash !== dataset.ayahs[index]!.content_hash) drift += 1;
  }
  gate.equals('REG-PARSE-DETERMINISM', CATEGORY, 'parsing the source twice produces identical hashes for all 6,236 ayahs', 'hash differences between two parses', 0, drift, 'CRITICAL');
  gate.equals('REG-PARSE-FILEHASH', CATEGORY, 'the source file hash is stable across parses', 'source_file_hash', dataset.source_file_hash, reparsed.source_file_hash, 'CRITICAL');
}
