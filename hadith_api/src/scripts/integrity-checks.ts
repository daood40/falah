/**
 * The data-integrity rule set (§35). One query per rule, returning the
 * OFFENDING rows: zero rows means the rule holds. Both `npm run verify` and
 * tests/integrity-rules.test.ts read this list, so a rule cannot drift
 * between the report and the test suite.
 */
export interface Check {
  /** The rule, worded as what must hold. */
  name: string;
  /** A query returning the OFFENDING rows; zero rows = the rule holds. */
  sql: string;
  /** warn: reported with a count, does not fail the run. */
  level?: 'fail' | 'warn';
}

/** §35 + §7 of the final task — twelve rules, each one a real query. */
export const CHECKS: Check[] = [
  // 1. every hadith is reachable to a registered source through its edition
  { name: '1. every hadith resolves to a registered source',
    sql: `select h.id from corpus.hadiths h
          left join corpus.editions e on e.id = h.edition_id
          left join corpus.sources s on s.id = e.source_id
          where e.id is null or s.id is null` },

  // 2. dataset version
  { name: '2. every hadith belongs to a declared dataset_version',
    sql: `select h.id from corpus.hadiths h where not exists (
            select 1 from corpus.dataset_versions d where d.version = h.dataset_version)` },

  // 3. hash
  { name: '3. every hadith has a content_hash equal to sha256(raw_text)',
    sql: `select id from corpus.hadiths
          where content_hash is null or content_hash <> corpus.sha256_hex(raw_text)` },

  // 4. no empty text
  { name: '4. no hadith carries an empty raw_text',
    sql: `select id from corpus.hadiths where raw_text is null or btrim(raw_text) = ''` },

  // 5/6. duplicates
  { name: '5. hadith_number is unique per (dataset_version, edition)',
    sql: `select dataset_version from corpus.hadiths where hadith_number is not null
          group by dataset_version, edition_id, hadith_number having count(*) > 1` },
  { name: '6. identical text inside one chapter is reported, never auto-deleted',
    level: 'warn',
    sql: `select content_hash from corpus.hadiths where chapter_id is not null
          group by dataset_version, chapter_id, content_hash having count(*) > 1` },

  // 7. no invented metadata: everything came from a recorded import run
  { name: '7. every hadith is traceable to a recorded import run',
    sql: `select h.id from corpus.hadiths h where h.raw_import_id is null
            or not exists (select 1 from corpus.raw_imports r where r.id = h.raw_import_id)` },

  // 8. source lock
  { name: '8. imported text is source_locked',
    sql: `select id from corpus.hadiths where source_locked = false` },

  // 9. verification
  { name: '9. verified=true only with a passed human verification record',
    sql: `select h.id from corpus.hadiths h where h.verified and (
            h.verification_status <> 'verified'
            or not exists (
              select 1 from corpus.verification_records v
              where v.hadith_id = h.id and v.result = 'passed'
                and v.verification_type in ('manual_sample','external_source')))` },
  { name: '9b. a passed verification still matches the stored text',
    sql: `select v.id from corpus.verification_records v
          join corpus.hadiths h on h.id = v.hadith_id
          where v.result = 'passed' and v.content_hash <> h.content_hash` },

  // 10. gradings
  { name: '10. every grading record belongs to a hadith with a recorded source',
    sql: `select g.id from corpus.hadith_gradings g
          left join corpus.hadiths h on h.id = g.hadith_id
          where h.id is null or h.raw_import_id is null` },
  { name: '10b. gradings carrying neither grader nor source_reference',
    level: 'warn',
    sql: `select id from corpus.hadith_gradings
          where coalesce(btrim(grader), '') = '' and coalesce(btrim(source_reference), '') = ''` },

  // 11. narrators
  { name: '11. every narrator is attached to an edition of a registered source',
    sql: `select n.id from corpus.narrators n
          left join corpus.editions e on e.id = n.edition_id
          where n.edition_id is null or e.id is null` },
  { name: '11b. a hadith narrator belongs to the same edition as the hadith',
    sql: `select h.id from corpus.hadiths h
          join corpus.narrators n on n.id = h.narrator_id
          where n.edition_id is distinct from h.edition_id` },

  // 12. volume / page provenance
  { name: '12. volume never exceeds the edition volume_count',
    sql: `select h.id from corpus.hadiths h join corpus.editions e on e.id = h.edition_id
          where h.volume_number is not null and e.volume_count is not null
            and h.volume_number > e.volume_count` },
  { name: '12b. page and volume are positive when present',
    sql: `select id from corpus.hadiths
          where (page_number is not null and page_number <= 0)
             or (volume_number is not null and volume_number <= 0)` },

  // structural links
  { name: '13. book belongs to the hadith edition',
    sql: `select h.id from corpus.hadiths h join corpus.books b on b.id = h.book_id
          where b.edition_id <> h.edition_id` },
  { name: '14. chapter belongs to the hadith book',
    sql: `select h.id from corpus.hadiths h join corpus.chapters c on c.id = h.chapter_id
          where c.book_id is distinct from h.book_id` },
  { name: '15. edition belongs to a registered source',
    sql: `select e.id from corpus.editions e where not exists (
            select 1 from corpus.sources s where s.id = e.source_id)` },
  { name: '16. no placeholder/sample religious text in the corpus',
    sql: `select id from corpus.hadiths
          where raw_text ilike '%sample hadith%' or raw_text ilike '%lorem ipsum%'
             or raw_text like '%حديث تجريبي%'` },

  { name: '17. every verification sample cites hadiths of its own dataset',
    sql: `select s.id from corpus.verification_samples s
          where exists (
            select 1 from unnest(s.sample_hadith_ids) as sid
            where not exists (
              select 1 from corpus.hadiths h
              where h.id = sid and h.dataset_version = s.dataset_version))` },
];
