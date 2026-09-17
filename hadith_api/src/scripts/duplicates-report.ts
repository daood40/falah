/**
 * Duplicate detection (§11) — a REPORT, never an action.
 *
 * The same wording legitimately recurs in this book: a hadith is repeated under
 * another chapter, or two narrations differ by one word. Nothing here deletes
 * or merges anything; merging is a human decision that must cite the source.
 *
 *   node --experimental-strip-types src/scripts/duplicates-report.ts
 */
import { closePool, query } from '../db.ts';

const DATASET = process.env['DATASET'] ?? 'JAMI-KAMIL-1437-V1';

async function main(): Promise<void> {
  // 1. exact duplicates: identical text (identical SHA-256)
  const exact = await query<{ content_hash: string; copies: number; locators: string[] }>(
    `select content_hash, count(*)::int as copies,
            array_agg(source_locator order by volume_number, page_number) as locators
     from corpus.hadiths where dataset_version = $1
     group by content_hash having count(*) > 1
     order by count(*) desc`,
    [DATASET],
  );

  // 2. exact duplicates INSIDE one chapter — the only shape that usually means
  //    a parsing fault rather than the book repeating itself on purpose
  const sameChapter = await query<{ content_hash: string; chapter: string; copies: number }>(
    `select h.content_hash, c.name as chapter, count(*)::int as copies
     from corpus.hadiths h join corpus.chapters c on c.id = h.chapter_id
     where h.dataset_version = $1
     group by h.content_hash, c.name having count(*) > 1
     order by count(*) desc`,
    [DATASET],
  );

  // 3. potential duplicates: same normalized opening, different text
  const potential = await query<{ opening: string; variants: number }>(
    `with openings as (
       select id, corpus.normalize_ar(left(raw_text, 90)) as opening, content_hash
       from corpus.hadiths where dataset_version = $1)
     select opening, count(distinct content_hash)::int as variants
     from openings group by opening
     having count(distinct content_hash) > 1
     order by count(distinct content_hash) desc limit 200`,
    [DATASET],
  );

  const totals = await query<{ total: number }>(
    `select count(*)::int as total from corpus.hadiths where dataset_version = $1`, [DATASET]);
  const copiesTotal = exact.reduce((a, r) => a + r.copies, 0);

  console.log('============ DUPLICATE REPORT ============');
  console.log(`dataset                      ${DATASET}`);
  console.log(`records                      ${totals[0]?.total ?? 0}`);
  console.log(`exact-duplicate groups       ${exact.length}  (${copiesTotal} records involved)`);
  console.log(`  …of those, inside one chapter ${sameChapter.length}  ← the ones worth a human look`);
  console.log(`potential near-duplicates    ${potential.length} groups sharing an opening`);
  console.log('');
  console.log('largest exact groups (nothing was deleted):');
  for (const row of exact.slice(0, 10)) {
    console.log(`  ×${row.copies}  ${row.locators.slice(0, 4).join(' · ')}${row.copies > 4 ? ' …' : ''}`);
  }
  if (sameChapter.length > 0) {
    console.log('\nsame text repeated inside one chapter:');
    for (const row of sameChapter.slice(0, 10)) {
      console.log(`  ×${row.copies}  ${row.chapter}`);
    }
  }
  console.log('\nrule: the corpus preserves the source structure. A repetition in the');
  console.log('book stays a repetition here. Merging requires a human decision that');
  console.log('cites the printed edition, recorded as a new dataset_version.');
  console.log('==========================================');
}

main()
  .catch((err) => {
    console.error(`duplicates report failed: ${(err as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => void closePool());
