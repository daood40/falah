/**
 * Exports a dataset as JSONL plus a manifest (§9, §29). Every record carries
 * its own SHA-256, and the manifest carries the SHA-256 of the export file and
 * the dataset fingerprint — so an export can be proven identical to the
 * database it came from, and to the files that database came from.
 *
 * The export obeys the licence gate: with PUBLIC_DATA_ENABLED=false it writes
 * metadata only, and says so in the manifest.
 *
 *   node --experimental-strip-types src/scripts/export-dataset.ts [--out dir]
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { config } from '../config.ts';
import { closePool, query, queryOne } from '../db.ts';

const outIndex = process.argv.indexOf('--out');
const OUT_DIR = outIndex === -1 ? 'exports' : (process.argv[outIndex + 1] as string);
const DATASET = process.env['DATASET'] ?? config.activeDatasetVersion;

async function main(): Promise<void> {
  const includeText = config.publicDataEnabled;
  const rows = await query<Record<string, unknown>>(
    `select h.id, h.hadith_number, h.volume_number, h.page_number, h.source_locator,
            h.raw_text, h.takhrij, h.grading, h.content_hash, h.dataset_version,
            h.verification_status, h.book_id, h.chapter_id, h.narrator_id,
            b.name as book_name, c.name as chapter_name, n.name as narrator_name
     from corpus.hadiths h
     left join corpus.books b on b.id = h.book_id
     left join corpus.chapters c on c.id = h.chapter_id
     left join corpus.narrators n on n.id = h.narrator_id
     where h.dataset_version = $1
     order by h.volume_number, h.page_number, h.source_ordinal`,
    [DATASET],
  );

  const lines = rows.map((row) => {
    const record = { ...row };
    if (!includeText) {
      record['raw_text'] = null;
      record['takhrij'] = null;
    }
    return JSON.stringify(record);
  });
  const body = lines.join('\n') + '\n';

  mkdirSync(OUT_DIR, { recursive: true });
  const dataPath = `${OUT_DIR}/${DATASET}.jsonl`;
  writeFileSync(dataPath, body, 'utf8');

  const dataset = await queryOne<{ dataset_hash: string; record_count: number; status: string }>(
    'select dataset_hash, record_count, status from corpus.dataset_versions where version = $1',
    [DATASET],
  );

  const manifest = {
    dataset_version: DATASET,
    dataset_hash: dataset?.dataset_hash ?? null,
    record_count: rows.length,
    declared_record_count: dataset?.record_count ?? null,
    status: dataset?.status ?? null,
    text_included: includeText,
    text_withheld_reason: includeText ? null : 'PUBLIC_DATA_ENABLED=false — content licence not confirmed',
    file: `${DATASET}.jsonl`,
    file_sha256: createHash('sha256').update(body).digest('hex'),
    file_bytes: Buffer.byteLength(body),
    exported_at: new Date().toISOString(),
  };
  writeFileSync(`${OUT_DIR}/${DATASET}.manifest.json`, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('============ DATASET EXPORT ============');
  for (const [k, v] of Object.entries(manifest)) console.log(`${k.padEnd(22)} ${v}`);
  console.log('========================================');
}

main()
  .catch((err) => {
    console.error(`export failed: ${(err as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => void closePool());
