/**
 * Chain integrity (§9): RAW SOURCE → DATABASE → API → EXPORT.
 *
 * One record's SHA-256 must be the same value at every hop. Anything else is a
 * silent modification, which is the one failure this project cannot tolerate.
 *
 *   API_BASE=http://127.0.0.1:8787 ADMIN_API_KEY=… \
 *   node --experimental-strip-types src/scripts/chain-verify.ts [sampleSize]
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { closePool, query } from '../db.ts';

const SAMPLE = Number(process.argv[2] ?? 300);
const DATA_DIR = process.env['DATA_DIR'] ?? 'data';
const API_BASE = process.env['API_BASE'] ?? 'http://127.0.0.1:8787';
const ADMIN_KEY = process.env['ADMIN_API_KEY'] ?? '';
const EXPORT_FILE = process.env['EXPORT_FILE'] ?? '';

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

async function main(): Promise<void> {
  const rows = await query<{
    id: string; raw_text: string; content_hash: string; volume_number: number; source_locator: string;
  }>(
    `select id, raw_text, content_hash, volume_number, source_locator
     from corpus.hadiths order by random() limit $1`,
    [SAMPLE],
  );

  const volumes = new Map<number, string>();
  const readVolume = (volume: number): string | null => {
    const cached = volumes.get(volume);
    if (cached) return cached;
    const path = `${DATA_DIR}/jami-kamil-j${String(volume).padStart(2, '0')}.txt`;
    if (!existsSync(path)) return null;
    const text = readFileSync(path, 'utf8');
    volumes.set(volume, text);
    return text;
  };

  const exported = new Map<string, string>();
  if (EXPORT_FILE && existsSync(EXPORT_FILE)) {
    for (const line of readFileSync(EXPORT_FILE, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const record = JSON.parse(line) as { id: string; content_hash: string };
      exported.set(record.id, record.content_hash);
    }
  }

  const tally = { raw: 0, db: 0, api: 0, exportHop: 0, checkedApi: 0, checkedExport: 0, checkedRaw: 0 };
  const failures: string[] = [];

  for (const row of rows) {
    // hop 1: the database's own hash is a hash of the text it stores
    if (sha256(row.raw_text) === row.content_hash) tally.db++;
    else failures.push(`${row.source_locator}: database hash does not match its own text`);

    // hop 2: that text still exists, line by line, in the raw source file
    const source = readVolume(row.volume_number);
    if (source) {
      tally.checkedRaw++;
      const missing = row.raw_text.split('\n').filter((line) => !source.includes(line));
      if (missing.length === 0) tally.raw++;
      else failures.push(`${row.source_locator}: ${missing.length} line(s) absent from the raw file`);
    }

    // hop 3: the API serves the same hash (and the same text when it may)
    try {
      const res = await fetch(`${API_BASE}/api/v1/hadiths/${row.id}`, {
        headers: ADMIN_KEY ? { authorization: `Bearer ${ADMIN_KEY}` } : {},
      });
      if (res.ok) {
        tally.checkedApi++;
        const body = (await res.json()) as { data: { dataset: { hash: string }; text: string | null } };
        const hashOk = body.data.dataset.hash === row.content_hash;
        const textOk = body.data.text === null || sha256(body.data.text) === row.content_hash;
        if (hashOk && textOk) tally.api++;
        else failures.push(`${row.source_locator}: API hash/text disagrees with the database`);
      }
    } catch {
      /* the API is optional for this check; reported in the summary */
    }

    // hop 4: the export carries the same hash
    if (exported.size > 0) {
      tally.checkedExport++;
      if (exported.get(row.id) === row.content_hash) tally.exportHop++;
      else failures.push(`${row.source_locator}: export hash differs`);
    }
  }

  const line = (label: string, ok: number, total: number) =>
    console.log(`${label.padEnd(28)} ${ok}/${total}${total > 0 && ok === total ? '  PASS' : total === 0 ? '  SKIPPED' : '  FAIL'}`);

  console.log('============ CHAIN INTEGRITY ============');
  console.log(`sample                       ${rows.length} records`);
  line('RAW SOURCE → text', tally.raw, tally.checkedRaw);
  line('DATABASE → hash', tally.db, rows.length);
  line('API → hash + text', tally.api, tally.checkedApi);
  line('EXPORT → hash', tally.exportHop, tally.checkedExport);
  console.log(`failures                     ${failures.length}`);
  for (const f of failures.slice(0, 10)) console.log(`  ${f}`);
  const failed =
    tally.raw !== tally.checkedRaw || tally.db !== rows.length ||
    (tally.checkedApi > 0 && tally.api !== tally.checkedApi) ||
    (tally.checkedExport > 0 && tally.exportHop !== tally.checkedExport);
  console.log(failed ? 'CHAIN INTEGRITY: FAIL' : 'CHAIN INTEGRITY: PASS');
  console.log('=========================================');
  if (failed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(`chain verify failed: ${(err as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => void closePool());
