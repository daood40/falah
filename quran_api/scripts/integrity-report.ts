#!/usr/bin/env node
/**
 * Integrity report: recomputes every hash from the stored text and re-checks
 * structure, mappings and Arabic content against the source dataset.
 * Exits non-zero when any check fails.
 */
import { writeFileSync } from 'node:fs';
import pg from 'pg';
import { contentHash } from '../src/core/hash.ts';
import { parseDataset } from '../src/import/parse.ts';

const out = process.argv.find((a) => a.startsWith('--out='))?.slice('--out='.length) ?? null;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

type Check = { check: string; expected: number | string; actual: number | string; pass: boolean };
const checks: Check[] = [];
const record = (check: string, expected: number | string, actual: number | string): void => {
  checks.push({ check, expected, actual, pass: expected === actual });
};

const one = async (sql: string, params: unknown[] = []): Promise<number> => {
  const { rows } = await client.query<{ value: string }>(sql, params);
  return Number(rows[0]?.value ?? 0);
};

const dataset = parseDataset([]);

record('surahs', dataset.surahs.length, await one('select count(*)::text as value from quran.surahs'));
record('ayahs', dataset.ayahs.length, await one('select count(*)::text as value from quran.ayahs'));
record('juzs', dataset.juzs.length, await one('select count(*)::text as value from quran.juzs'));
record('rubs', dataset.rubs.length, await one('select count(*)::text as value from quran.hizbs'));
record('hizbs', 60, await one('select count(distinct hizb_number)::text as value from quran.hizbs'));
record('pages', dataset.pages.length, await one('select count(*)::text as value from quran.pages'));
record('manzils', dataset.manzils.length, await one('select count(*)::text as value from quran.manzils'));
record(
  'sajdahs',
  dataset.ayahs.filter((a) => a.sajdah).length,
  await one('select count(*)::text as value from quran.ayahs where sajdah'),
);
record('duplicate_ayahs', 0, await one(
  `select count(*)::text as value from (
     select surah_id, ayah_number from quran.ayahs group by 1,2 having count(*) > 1) d`,
));
record('surah_ayah_count_mismatch', 0, await one(
  `select count(*)::text as value from (
     select s.id from quran.surahs s join quran.ayahs a on a.surah_id = s.id
     group by s.id, s.ayah_count having count(a.id) <> s.ayah_count) m`,
));
record('global_number_gaps', 0, await one(
  `select count(*)::text as value from (
     select global_ayah_number, row_number() over (partition by edition_id order by global_ayah_number) rn
     from quran.ayahs) t where global_ayah_number <> rn`,
));
record('unverified_ayahs', 0, await one(
  'select count(*)::text as value from quran.ayahs where not verified',
));
record('orphan_translations', 0, await one(
  `select count(*)::text as value from quran.ayah_translations at
   left join quran.ayahs a on a.id = at.ayah_id where a.id is null`,
));
record('audio_without_mapping', 0, await one(
  `select count(*)::text as value from quran.audio_files
   where surah_id is null and ayah_id is null and juz_id is null`,
));
record('audio_verified_without_checksum_or_size', 0, await one(
  `select count(*)::text as value from quran.audio_files
   where verified and checksum is null and file_size is null`,
));
record('ayahs_without_arabic_letters', 0, await one(
  `select count(*)::text as value from quran.ayahs where raw_text !~ '[\\u0621-\\u064A]'`,
));
record('juz_mapping_mismatch', 0, await one(
  `select count(*)::text as value from quran.ayahs a join quran.juzs j
   on j.edition_id = a.edition_id and a.global_ayah_number between j.start_global_ayah and j.end_global_ayah
   where a.juz_number <> j.juz_number`,
));
record('page_mapping_mismatch', 0, await one(
  `select count(*)::text as value from quran.ayahs a join quran.pages p
   on p.edition_id = a.edition_id and a.global_ayah_number between p.start_global_ayah and p.end_global_ayah
   where a.page_number <> p.page_number`,
));

// Hash + source comparison, recomputed in JS from the stored text.
const { rows } = await client.query<{
  surah_number: number;
  ayah_number: number;
  raw_text: string;
  content_hash: string;
}>(`select s.surah_number, a.ayah_number, a.raw_text, a.content_hash
    from quran.ayahs a join quran.surahs s on s.id = a.surah_id`);
const sourceHashes = new Map(
  dataset.ayahs.map((a) => [`${a.surah_number}:${a.ayah_number}`, a.content_hash]),
);
let hashMismatch = 0;
let sourceMismatch = 0;
for (const row of rows) {
  if (contentHash(row.raw_text) !== row.content_hash) hashMismatch += 1;
  if (sourceHashes.get(`${row.surah_number}:${row.ayah_number}`) !== row.content_hash) {
    sourceMismatch += 1;
  }
}
record('hash_mismatch_vs_stored_text', 0, hashMismatch);
record('hash_mismatch_vs_source_dataset', 0, sourceMismatch);

const translations = await client.query<{ slug: string; count: string }>(
  `select t.slug, count(*)::text as count from quran.ayah_translations at
   join quran.translations t on t.id = at.translation_id group by t.slug order by t.slug`,
);
for (const row of translations.rows) {
  record(`translation_coverage:${row.slug}`, dataset.ayahs.length, Number(row.count));
}

await client.end();

const failed = checks.filter((c) => !c.pass);
const report = {
  generated_at: new Date().toISOString(),
  status: failed.length === 0 ? 'PASS' : 'FAIL',
  total_checks: checks.length,
  failed_checks: failed.length,
  checks,
};
const json = JSON.stringify(report, null, 2);
if (out) writeFileSync(out, `${json}\n`);
console.log(json);
process.exitCode = failed.length === 0 ? 0 : 1;
