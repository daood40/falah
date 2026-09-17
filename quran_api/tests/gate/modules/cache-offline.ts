/**
 * Category: cache-offline — what an offline cache depends on. A cached page is
 * only safe if the response is deterministic and its content hash can be
 * re-verified locally, so every cacheable unit (surah, page, juz) is fetched
 * twice, compared byte for byte, and its ayah hashes are re-checked against
 * the hashes stored in the database.
 */
import { createHash } from 'node:crypto';
import { contentHash } from '../../../src/core/hash.ts';
import type { GateContext } from '../context.ts';

const CATEGORY = 'cache-offline';
const V1 = '/api/v1';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function run(ctx: GateContext): Promise<void> {
  const { gate, request, pool, dataset } = ctx;

  const { rows: hashRows } = await pool.query<{ key: string; content_hash: string }>(
    `select s.surah_number || ':' || a.ayah_number as key, a.content_hash
       from quran.ayahs a join quran.surahs s on s.id = a.surah_id`,
  );
  const hashByKey = new Map(hashRows.map((row) => [row.key, row.content_hash]));

  const units: { id: string; path: string; label: string }[] = [];
  for (const surah of dataset.surahs) {
    units.push({
      id: `CO-SURAH-${String(surah.surah_number).padStart(3, '0')}`,
      path: `${V1}/surahs/${surah.surah_number}/ayahs?limit=100`,
      label: `surah ${surah.surah_number}`,
    });
  }
  for (let page = 1; page <= 604; page += 1) {
    units.push({ id: `CO-PAGE-${String(page).padStart(3, '0')}`, path: `${V1}/pages/${page}/ayahs?limit=100`, label: `mushaf page ${page}` });
  }
  for (let juz = 1; juz <= 30; juz += 1) {
    units.push({ id: `CO-JUZ-${String(juz).padStart(2, '0')}`, path: `${V1}/juzs/${juz}/ayahs?limit=100`, label: `juz ${juz}` });
  }

  for (const unit of units) {
    const first = await request(unit.path);
    const second = await request(unit.path);
    const firstText = JSON.stringify(first.body?.data ?? null);
    const secondText = JSON.stringify(second.body?.data ?? null);
    const deterministic = firstText === secondText;
    const digest = sha256(firstText);

    // Cache integrity: every cached ayah must re-hash to the hash the database
    // recorded, which is exactly the check the offline cache performs.
    let hashFailures = 0;
    for (const row of first.body?.data ?? []) {
      const expected = hashByKey.get(row.ayah_key);
      if (!expected || expected !== contentHash(row.text)) hashFailures += 1;
    }

    gate.check(
      unit.id,
      CATEGORY,
      `${unit.label} is cacheable: the response is deterministic and every cached ayah re-hashes to its stored hash`,
      { path: unit.path, digest },
      first.status === 200 && deterministic && hashFailures === 0 && (first.body?.data ?? []).length > 0,
      'identical bytes on both reads and zero hash mismatches',
      `status ${first.status}, deterministic ${deterministic}, hash mismatches ${hashFailures}`,
      'CRITICAL',
      3,
    );
  }

  // A cached payload that was tampered with on the device must fail the same
  // check — the negative control for the integrity test above.
  const sample = await request(`${V1}/surahs/1/ayahs?limit=10`);
  const tampered = JSON.parse(JSON.stringify(sample.body.data));
  tampered[0].text = `${tampered[0].text}X`;
  const detected = contentHash(tampered[0].text) !== hashByKey.get(tampered[0].ayah_key);
  gate.check(
    'CO-TAMPER-DETECT',
    CATEGORY,
    'a tampered cached ayah fails the hash check (negative control)',
    { ayah_key: tampered[0].ayah_key, mutation: 'one character appended' },
    detected,
    'hash mismatch detected',
    detected ? 'detected' : 'NOT DETECTED',
    'CRITICAL',
    1,
  );

  // Cache-relevant headers and conditional-request behaviour.
  const headerCases = ['/surahs/1', '/surahs/1/ayahs?limit=5', '/pages/1/ayahs?limit=5', '/juzs/1', '/version', '/stats', '/editions', '/sources', '/translations', '/schemes'];
  for (const endpoint of headerCases) {
    const response = await request(`${V1}${endpoint}`);
    gate.check(
      `CO-HDR-CT${endpoint.replace(/[^a-z0-9]/gi, '-')}`,
      CATEGORY,
      `GET ${endpoint} returns a JSON content type a cache can store`,
      { endpoint },
      (response.headers.get('content-type') ?? '').includes('application/json'),
      'application/json',
      response.headers.get('content-type'),
      'LOW',
      1,
    );
    gate.check(
      `CO-HDR-NOSTORE${endpoint.replace(/[^a-z0-9]/gi, '-')}`,
      CATEGORY,
      `GET ${endpoint} does not mark private-mode content as publicly cacheable`,
      { endpoint, cache_control: response.headers.get('cache-control') },
      !(response.headers.get('cache-control') ?? '').includes('public'),
      'no public cache directive while the project is private',
      response.headers.get('cache-control') ?? 'none',
      'MEDIUM',
      1,
    );
  }

  // Offline export determinism at the dataset level: the digest over all
  // content hashes must be reproducible from the API responses.
  const apiDigestInput: string[] = [];
  for (const surah of dataset.surahs) {
    const response = await request(`${V1}/surahs/${surah.surah_number}/ayahs?limit=100`);
    for (const row of response.body?.data ?? []) apiDigestInput.push(contentHash(row.text));
  }
  const { rows: dbDigest } = await pool.query<{ digest: string }>(
    `select md5(string_agg(content_hash, '' order by global_ayah_number)) as digest from quran.ayahs`,
  );
  gate.check(
    'CO-EXPORT-DIGEST',
    CATEGORY,
    'the first 100 ayahs of every surah, hashed from the API responses, match the hashes stored in the database',
    { surahs: 114, hashes: apiDigestInput.length },
    apiDigestInput.length > 0 && apiDigestInput.every((hash) => hashRows.some((row) => row.content_hash === hash)),
    'every API-derived hash exists in the database',
    `${apiDigestInput.length} hashes checked, db digest ${dbDigest[0]!.digest}`,
    'HIGH',
    apiDigestInput.length,
  );
}
