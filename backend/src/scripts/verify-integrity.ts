import { closePool, query } from '../db.ts';

interface Check {
  name: string;
  sql: string;
  /** A check passes when the query returns zero offending rows. */
}

const CHECKS: Check[] = [
  { name: 'every hadith has non-empty raw_text',
    sql: `select id from corpus.hadiths where raw_text is null or btrim(raw_text) = ''` },
  { name: 'content_hash equals sha256(raw_text)',
    sql: `select id from corpus.hadiths where content_hash <> corpus.sha256_hex(raw_text)` },
  { name: 'imported text is source_locked',
    sql: `select id from corpus.hadiths where source_locked = false` },
  { name: 'verified=true only with verification_status=verified',
    sql: `select id from corpus.hadiths where verified and verification_status <> 'verified'` },
  { name: 'verified hadiths have a verification record',
    sql: `select h.id from corpus.hadiths h where h.verified and not exists (
            select 1 from corpus.verification_records v
            where v.hadith_id = h.id and v.result = 'passed'
              and v.verification_type in ('manual_sample','external_source'))` },
  { name: 'verification records match the current text hash',
    sql: `select v.id from corpus.verification_records v
          join corpus.hadiths h on h.id = v.hadith_id
          where v.result = 'passed' and v.content_hash <> h.content_hash` },
  { name: 'every hadith belongs to a known dataset_version',
    sql: `select h.id from corpus.hadiths h where not exists (
            select 1 from corpus.dataset_versions d where d.version = h.dataset_version)` },
  { name: 'book belongs to the hadith edition',
    sql: `select h.id from corpus.hadiths h join corpus.books b on b.id = h.book_id
          where b.edition_id <> h.edition_id` },
  { name: 'chapter belongs to the hadith book',
    sql: `select h.id from corpus.hadiths h join corpus.chapters c on c.id = h.chapter_id
          where c.book_id is distinct from h.book_id` },
  { name: 'edition belongs to a registered source',
    sql: `select e.id from corpus.editions e where not exists (
            select 1 from corpus.sources s where s.id = e.source_id)` },
  { name: 'no placeholder/sample text in the corpus',
    sql: `select id from corpus.hadiths
          where raw_text ilike '%sample hadith%' or raw_text ilike '%lorem ipsum%'
             or raw_text like '%حديث تجريبي%'` },
  { name: 'hadith numbers are unique per (dataset, edition)',
    sql: `select dataset_version from corpus.hadiths where hadith_number is not null
          group by dataset_version, edition_id, hadith_number having count(*) > 1` },
];

async function main(): Promise<void> {
  let failed = 0;
  console.log('============ DATA INTEGRITY REPORT ============');
  for (const check of CHECKS) {
    const rows = await query(check.sql);
    const pass = rows.length === 0;
    if (!pass) failed++;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${check.name}${pass ? '' : ` (${rows.length} offending rows)`}`);
  }
  const counts = await query<Record<string, number>>('select * from corpus.stats_view');
  console.log('-----------------------------------------------');
  console.log(JSON.stringify(counts[0] ?? {}, null, 2));
  console.log('===============================================');
  console.log(failed === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${failed} checks)`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(`integrity check failed: ${(err as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => void closePool());
