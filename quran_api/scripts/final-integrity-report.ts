#!/usr/bin/env node
/**
 * Produces reports/QURAN_FINAL_INTEGRITY.txt — a human-readable re-verification
 * of the published dataset against the source packages.
 *
 * It never repairs anything: a difference is printed as a DISCREPANCY and the
 * script exits non-zero. Quran text is never modified here or anywhere else.
 */
import { writeFileSync } from 'node:fs';
import pg from 'pg';
import { contentHash } from '../src/core/hash.ts';
import { normalizeForSearch, searchSkeleton } from '../src/core/arabic.ts';
import { parseDataset } from '../src/import/parse.ts';
import { QURAN_JSON_VERSION, QURAN_META_VERSION } from '../src/import/registry.ts';

const out = process.argv.find((a) => a.startsWith('--out='))?.slice('--out='.length)
  ?? 'reports/QURAN_FINAL_INTEGRITY.txt';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const lines: string[] = [];
const discrepancies: string[] = [];
const say = (text = ''): number => lines.push(text);
const check = (label: string, expected: unknown, actual: unknown): void => {
  const pass = String(expected) === String(actual);
  say(`  ${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(44)} expected=${expected} actual=${actual}`);
  if (!pass) discrepancies.push(`${label}: expected ${expected}, found ${actual}`);
};
const scalar = async (sql: string, params: unknown[] = []): Promise<string> => {
  const { rows } = await client.query<{ value: string }>(sql, params);
  return String(rows[0]?.value ?? '');
};

const dataset = parseDataset([]);
const now = new Date().toISOString();

say('================================================================');
say('FALAH QURAN API — FINAL DATA INTEGRITY VERIFICATION');
say('================================================================');
say(`generated_at : ${now}`);
say(`sources      : quran-json@${QURAN_JSON_VERSION} (text + translations)`);
say(`               quran-meta@${QURAN_META_VERSION} (Hafs mushaf structure)`);
say(`database     : ${(process.env.DATABASE_URL ?? '').replace(/\/\/[^@]*@/, '//***@')}`);
say('rule         : nothing is repaired automatically; differences are listed');
say('               as DISCREPANCY. Quran text is never edited by this tool.');
say();

// ---------- Edition / dataset version ----------
const { rows: editions } = await client.query<{
  id: string; slug: string; name: string; riwayah: string; qiraah: string;
  script_type: string; version: string; source_id: string;
}>(`select id, slug, name, riwayah, qiraah, script_type, version, source_id
    from quran.quran_editions where edition_type = 'quran' order by created_at`);
say('[1] EDITION & DATASET VERSION');
for (const edition of editions) {
  say(`  edition      : ${edition.slug} (${edition.name})`);
  say(`  riwayah      : ${edition.riwayah}   qiraah: ${edition.qiraah}   script: ${edition.script_type}`);
  say(`  source_id    : ${edition.source_id}   version: ${edition.version}`);
}
const { rows: versions } = await client.query<{
  version: string; status: string; record_count: number; source_file_hash: string; import_date: string;
}>(`select version, status, record_count, source_file_hash, import_date
    from quran.quran_dataset_versions order by import_date desc`);
for (const version of versions) {
  say(`  dataset      : ${version.version}  status=${version.status}  records=${version.record_count}`);
  say(`  source hash  : ${version.source_file_hash}`);
  say(`  imported at  : ${new Date(version.import_date).toISOString()}`);
}
check('source file hash matches the package on disk', dataset.source_file_hash,
  versions[0]?.source_file_hash ?? 'missing');
say();

// ---------- Counts ----------
say('[2] STRUCTURAL COUNTS (expected = parsed from the source packages)');
check('surahs', dataset.surahs.length, await scalar('select count(*)::text as value from quran.surahs'));
check('ayahs', dataset.ayahs.length, await scalar('select count(*)::text as value from quran.ayahs'));
check('juzs', dataset.juzs.length, await scalar('select count(*)::text as value from quran.juzs'));
check('hizbs (distinct)', 60, await scalar('select count(distinct hizb_number)::text as value from quran.hizbs'));
check('rub al-hizb', dataset.rubs.length, await scalar('select count(*)::text as value from quran.hizbs'));
check('pages', dataset.pages.length, await scalar('select count(*)::text as value from quran.pages'));
check('manzils', dataset.manzils.length, await scalar('select count(*)::text as value from quran.manzils'));
check('sajdah ayahs', dataset.ayahs.filter((a) => a.sajdah).length,
  await scalar('select count(*)::text as value from quran.ayahs where sajdah'));
say();

// ---------- Numbering ----------
say('[3] NUMBERING');
check('surah numbers 1..114 contiguous', 0, await scalar(
  `select count(*)::text as value from (
     select surah_number, row_number() over (order by surah_number) rn
     from quran.surahs) t where surah_number <> rn`));
check('global ayah numbering without gaps', 0, await scalar(
  `select count(*)::text as value from (
     select global_ayah_number, row_number() over (partition by edition_id order by global_ayah_number) rn
     from quran.ayahs) t where global_ayah_number <> rn`));
check('ayah numbers restart at 1 in every surah', 0, await scalar(
  `select count(*)::text as value from (
     select a.surah_id, min(a.ayah_number) lo, max(a.ayah_number) hi, count(*) n
     from quran.ayahs a group by a.surah_id) t where lo <> 1 or hi <> n`));
check('declared ayah_count = stored ayahs', 0, await scalar(
  `select count(*)::text as value from (
     select s.id from quran.surahs s join quran.ayahs a on a.surah_id = s.id
     group by s.id, s.ayah_count having count(a.id) <> s.ayah_count) t`));
check('duplicate (surah, ayah) pairs', 0, await scalar(
  `select count(*)::text as value from (
     select surah_id, ayah_number from quran.ayahs group by 1,2 having count(*) > 1) t`));
say();

// ---------- Division mappings ----------
say('[4] JUZ / HIZB / PAGE / MANZIL MAPPINGS');
check('ayah.juz matches juz boundaries', 0, await scalar(
  `select count(*)::text as value from quran.ayahs a join quran.juzs j
   on j.edition_id = a.edition_id and a.global_ayah_number between j.start_global_ayah and j.end_global_ayah
   where a.juz_number <> j.juz_number`));
check('ayah.rub matches hizb-quarter boundaries', 0, await scalar(
  `select count(*)::text as value from quran.ayahs a join quran.hizbs h
   on h.edition_id = a.edition_id and a.global_ayah_number between h.start_global_ayah and h.end_global_ayah
   where a.rub_number <> h.rub_number or a.hizb_number <> h.hizb_number`));
check('ayah.page matches page boundaries', 0, await scalar(
  `select count(*)::text as value from quran.ayahs a join quran.pages p
   on p.edition_id = a.edition_id and a.global_ayah_number between p.start_global_ayah and p.end_global_ayah
   where a.page_number <> p.page_number`));
check('ayah.manzil matches manzil boundaries', 0, await scalar(
  `select count(*)::text as value from quran.ayahs a join quran.manzils m
   on m.edition_id = a.edition_id and a.global_ayah_number between m.start_global_ayah and m.end_global_ayah
   where a.manzil_number <> m.manzil_number`));
check('sajdah positions match the source list', 0, await scalar(
  `select count(*)::text as value from quran.ayahs
   where sajdah <> (global_ayah_number = any($1::int[]))`,
  [dataset.ayahs.filter((a) => a.sajdah).map((a) => a.global_ayah_number)]));
say();

// ---------- Text, hashes, representations ----------
say('[5] TEXT, SHA-256 AND DERIVED REPRESENTATIONS');
const { rows } = await client.query<{
  surah_number: number; ayah_number: number; raw_text: string; text_uthmani: string | null;
  text_simple: string | null; search_text: string | null; search_skeleton: string | null;
  content_hash: string; source_locked: boolean; verified: boolean; verification_status: string;
  dataset_version: string | null; source_id: string;
}>(`select s.surah_number, a.ayah_number, a.raw_text, a.text_uthmani, a.text_simple,
           a.search_text, a.search_skeleton, a.content_hash, a.source_locked, a.verified,
           a.verification_status, a.dataset_version, a.source_id
    from quran.ayahs a join quran.surahs s on s.id = a.surah_id
    order by a.global_ayah_number`);
const sourceByKey = new Map(dataset.ayahs.map((a) => [`${a.surah_number}:${a.ayah_number}`, a]));
let hashSelf = 0;
let hashSource = 0;
let textSource = 0;
let uthmaniMismatch = 0;
let searchMismatch = 0;
let skeletonMismatch = 0;
let notLocked = 0;
let notVerified = 0;
let simpleNotNull = 0;
for (const row of rows) {
  const key = `${row.surah_number}:${row.ayah_number}`;
  const source = sourceByKey.get(key);
  if (contentHash(row.raw_text) !== row.content_hash) {
    hashSelf += 1;
    if (discrepancies.length < 40) discrepancies.push(`hash(stored text) != stored hash at ${key}`);
  }
  if (source) {
    if (row.content_hash !== source.content_hash) {
      hashSource += 1;
      if (discrepancies.length < 40) discrepancies.push(`stored hash != source hash at ${key}`);
    }
    if (row.raw_text !== source.raw_text) {
      textSource += 1;
      if (discrepancies.length < 40) discrepancies.push(`stored text != source text at ${key}`);
    }
  }
  if (row.text_uthmani !== row.raw_text) uthmaniMismatch += 1;
  if (row.text_simple !== null) simpleNotNull += 1;
  if (row.search_text !== normalizeForSearch(row.raw_text)) searchMismatch += 1;
  if (row.search_skeleton !== searchSkeleton(row.raw_text)) skeletonMismatch += 1;
  if (!row.source_locked) notLocked += 1;
  if (!row.verified || row.verification_status !== 'verified') notVerified += 1;
}
check('ayah rows compared', dataset.ayahs.length, rows.length);
check('sha256(stored text) = stored hash', 0, hashSelf);
check('stored hash = source hash', 0, hashSource);
check('stored text = source text (byte for byte)', 0, textSource);
check('text_uthmani = raw_text', 0, uthmaniMismatch);
check('text_simple stays NULL (absent in source)', 0, simpleNotNull);
check('search_text = documented normalisation', 0, searchMismatch);
check('search_skeleton = documented normalisation', 0, skeletonMismatch);
check('source_locked on every ayah', 0, notLocked);
check('verification_status = verified', 0, notVerified);
check('ayahs without Arabic letters', 0, await scalar(
  `select count(*)::text as value from quran.ayahs where raw_text !~ '[\\u0621-\\u064A]'`));
check('ayahs with a NULL/empty text', 0, await scalar(
  `select count(*)::text as value from quran.ayahs where raw_text is null or btrim(raw_text) = ''`));
check('source metadata present on every ayah', 0, await scalar(
  `select count(*)::text as value from quran.ayahs a
   left join quran.sources s on s.id = a.source_id where s.id is null`));
check('dataset_version present on every ayah', 0, await scalar(
  `select count(*)::text as value from quran.ayahs where dataset_version is null`));
say();

// ---------- Source lock ----------
say('[6] SOURCE LOCK (raw_text immutability)');
let lockHeld = false;
try {
  await client.query('begin');
  await client.query(`update quran.ayahs set raw_text = raw_text || 'x' where ayah_number = 1`);
  await client.query('rollback');
} catch (error) {
  lockHeld = /SOURCE_LOCK/.test((error as Error).message);
  await client.query('rollback');
}
check('UPDATE of raw_text is rejected by the trigger', true, lockHeld);
say();

// ---------- Translations ----------
say('[7] TRANSLATIONS');
const { rows: translations } = await client.query<{
  slug: string; language: string; translator: string | null; title: string;
  license: string | null; version: string | null; verified: boolean;
  total: string; distinct_ayahs: string; empty: string; hash_rows: string;
}>(`select t.slug, t.language, t.translator, t.title, t.license, t.version, t.verified,
           count(at.id)::text as total,
           count(distinct at.ayah_id)::text as distinct_ayahs,
           count(*) filter (where btrim(at.text) = '')::text as empty,
           count(*) filter (where at.content_hash is null)::text as hash_rows
    from quran.translations t
    left join quran.ayah_translations at on at.translation_id = t.id
    group by t.id order by t.language`);
for (const translation of translations) {
  say(`  ${translation.slug.padEnd(16)} lang=${translation.language.padEnd(3)} rows=${translation.total.padEnd(6)} ` +
      `distinct=${translation.distinct_ayahs.padEnd(6)} empty=${translation.empty} missing_hash=${translation.hash_rows}`);
  say(`    translator : ${translation.translator ?? 'NULL'}`);
  say(`    title      : ${translation.title}`);
  say(`    licence    : ${translation.license ?? 'NULL'}   version: ${translation.version ?? 'NULL'}`);
  if (Number(translation.total) !== dataset.ayahs.length) {
    discrepancies.push(`${translation.slug}: ${translation.total} rows, expected ${dataset.ayahs.length}`);
  }
  if (Number(translation.distinct_ayahs) !== Number(translation.total)) {
    discrepancies.push(`${translation.slug}: duplicate ayah references`);
  }
  if (Number(translation.empty) > 0) {
    discrepancies.push(`${translation.slug}: ${translation.empty} empty translation rows`);
  }
}
check('translations with full coverage', translations.length,
  translations.filter((t) => Number(t.total) === dataset.ayahs.length).length);
const badTranslationHashes = await client.query<{ id: string; text: string; content_hash: string }>(
  'select id, text, content_hash from quran.ayah_translations',
);
const translationHashMismatch = badTranslationHashes.rows.filter(
  (row) => contentHash(row.text) !== row.content_hash,
).length;
check('sha256(translation text) = stored hash', 0, translationHashMismatch);
check('orphan translation rows', 0, await scalar(
  `select count(*)::text as value from quran.ayah_translations at
   left join quran.ayahs a on a.id = at.ayah_id where a.id is null`));
say();

// ---------- Qiraat / riwayat / reciters / audio ----------
say('[8] QIRAAT · RIWAYAT · RECITERS · AUDIO');
say(`  qiraat        : ${await scalar('select count(*)::text as value from quran.qiraat')}`);
say(`  riwayat       : ${await scalar('select count(*)::text as value from quran.riwayat')}`);
say(`  reciters      : ${await scalar('select count(*)::text as value from quran.reciters')}`);
say(`  recitations   : ${await scalar('select count(*)::text as value from quran.recitations')}`);
say(`  audio files   : ${await scalar('select count(*)::text as value from quran.audio_files')}`);
check('every riwayah belongs to a qiraah', 0, await scalar(
  `select count(*)::text as value from quran.riwayat r
   left join quran.qiraat q on q.id = r.qiraah_id where q.id is null`));
check('audio rows without a surah/ayah/juz mapping', 0, await scalar(
  `select count(*)::text as value from quran.audio_files
   where surah_id is null and ayah_id is null and juz_id is null`));
check('verified audio without checksum or size', 0, await scalar(
  `select count(*)::text as value from quran.audio_files
   where verified and checksum is null and file_size is null`));
say('  note: 0 reciters / 0 audio files is the correct state — no licensed');
say('        audio dataset has been supplied, and no placeholder rows exist.');
say();

// ---------- Verdict ----------
say('================================================================');
if (discrepancies.length === 0) {
  say('RESULT: PASS — no discrepancy found. Nothing was modified.');
} else {
  say(`RESULT: FAIL — ${discrepancies.length} discrepancy(ies) found (NOT repaired):`);
  discrepancies.slice(0, 40).forEach((issue) => say(`  - ${issue}`));
}
say('================================================================');

await client.end();
const text = `${lines.join('\n')}\n`;
writeFileSync(out, text);
console.log(text);
process.exitCode = discrepancies.length === 0 ? 0 : 1;
