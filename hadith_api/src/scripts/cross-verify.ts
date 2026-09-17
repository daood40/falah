/**
 * Cross-checks every imported record against an INDEPENDENT published corpus
 * (a separate SQLite database shipped by the `hadith` npm package: 16
 * collections, ~50k hadiths, MIT-licensed packaging).
 *
 * The question it answers is not "did we import the file correctly" — that is
 * sample-verify.ts — but "does this text actually exist in the collection the
 * author's takhrij attributes it to".
 *
 * It never edits a hadith. Every result is written to corpus.cross_checks, and
 * a disagreement is surfaced for a human, never auto-corrected.
 *
 *   REFERENCE_DB=/path/to/hadith.db \
 *   node --experimental-strip-types src/scripts/cross-verify.ts [--limit N]
 */
import { DatabaseSync } from 'node:sqlite';
import { closePool, query, queryOne, withTransaction } from '../db.ts';
import { matchTokens, uniqueShingles } from '../domain/matching.ts';

const REFERENCE_DB =
  process.env['REFERENCE_DB'] ?? '/tmp/ref/node_modules/hadith/data/hadith.db';
const SHINGLE = 5;
/** A shingle shared by this many reference rows is boilerplate, not evidence. */
const MAX_POSTINGS = 400;
const CORROBORATED_AT = 0.5;
const PARTIAL_AT = 0.15;
/** Below this many shared windows a match is noise, whatever the ratio. */
const MIN_MATCHED_SHINGLES = 3;

const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg === -1 ? null : Number(process.argv[limitArg + 1]);

interface RefRow {
  urn: string;
  collection_id: number;
  display_number: string | null;
  matn: string;
}

function loadReference(): {
  rows: RefRow[];
  collections: Map<number, string>;
  complete: Set<number>;
} {
  const db = new DatabaseSync(REFERENCE_DB, { readOnly: true });
  const collections = new Map<number, string>();
  const complete = new Set<number>();
  for (const row of db.prepare('select id, title, status from collection').all() as {
    id: number;
    title: string;
    status: string;
  }[]) {
    collections.set(row.id, String(row.title).trim());
    // The reference marks مسند أحمد and مشكاة المصابيح as incomplete; judging a
    // takhrij against a corpus that admits it is missing records would
    // manufacture disagreements.
    if (row.status === 'complete') complete.add(row.id);
  }
  const rows = (
    db
      .prepare(
        `select c0 as urn, c1 as collection_id, c4 as display_number,
                coalesce(c7, '') as matn
         from hadith_content where c7 is not null and length(c7) > 20`,
      )
      .all() as Record<string, unknown>[]
  ).map((r) => ({
    urn: String(r['urn']),
    collection_id: Number(r['collection_id']),
    display_number: r['display_number'] === null ? null : String(r['display_number']),
    matn: String(r['matn']),
  }));
  db.close();
  return { rows, collections, complete };
}


/**
 * The names this edition prints in its takhrij, mapped to the reference
 * corpus's own collections. Anything not listed here simply has no counterpart
 * in the reference (الحاكم، الطبراني، البيهقي، ابن حبان…), which is a limit of
 * the reference, not a finding about the record.
 */
const ALIASES: Record<string, string[]> = {
  'صحيح البخاري': ['البخاري'],
  'صحيح مسلم': ['مسلم'],
  'سنن النسائي': ['النسائي', 'النسائي في الكبرى'],
  'سنن أبي داود': ['أبو داود', 'أبي داود'],
  'جامع الترمذي': ['الترمذي'],
  'سنن ابن ماجه': ['ابن ماجه'],
  'موطأ مالك': ['مالك'],
  'مسند أحمد': ['أحمد'],
};

function buildAliasMap(collections: Map<number, string>, complete: Set<number>): Map<string, number> {
  const map = new Map<string, number>();
  for (const [id, title] of collections) {
    if (!complete.has(id)) continue; // incomplete reference → cannot judge a takhrij
    const printed = ALIASES[title.trim()];
    if (printed) for (const name of printed) map.set(name, id);
  }
  return map;
}

async function main(): Promise<void> {
  const started = Date.now();
  console.log(`reading the reference corpus: ${REFERENCE_DB}`);
  const { rows: refRows, collections, complete } = loadReference();
  console.log(`  ${refRows.length} reference records in ${collections.size} collections`);

  // ---- index the reference corpus by word-shingle ----
  const index = new Map<number, number[]>();
  const refShingleCount: number[] = new Array(refRows.length).fill(0);
  for (let i = 0; i < refRows.length; i++) {
    const list = uniqueShingles(matchTokens((refRows[i] as RefRow).matn), SHINGLE);
    refShingleCount[i] = list.length;
    for (const key of list) {
      const postings = index.get(key);
      if (postings) {
        if (postings.length < MAX_POSTINGS + 1) postings.push(i);
      } else index.set(key, [i]);
    }
  }
  console.log(`  indexed ${index.size} distinct shingles (${Date.now() - started} ms)`);
  const referenceAliases = buildAliasMap(collections, complete);
  console.log(`  ${referenceAliases.size} printed names map onto reference collections`);

  const corpus = await queryOne<{ id: string }>(
    `insert into corpus.reference_corpora (slug, name, description, url, license, version, record_count)
     values ('npm-hadith-1.3.0',
             'hadith (npm) — 16 collections incl. صحيح البخاري وصحيح مسلم',
             'Independently published corpus used only to corroborate imported records. No text from it is stored here.',
             'https://github.com/faressoft/hadith', 'MIT (packaging)', '1.3.0', $1)
     on conflict (slug) do update set record_count = excluded.record_count, retrieved_at = now()
     returning id`,
    [refRows.length],
  );
  const corpusId = (corpus as { id: string }).id;

  const hadiths = await query<{
    id: string;
    raw_text: string;
    takhrij_collections: string[];
  }>(
    `select h.id, h.raw_text,
            coalesce(array_agg(distinct hs.source_name) filter (where hs.source_name is not null), '{}') as takhrij_collections
     from corpus.hadiths h
     left join corpus.hadith_sources hs on hs.hadith_id = h.id
     group by h.id, h.raw_text
     order by h.id
     ${LIMIT ? `limit ${LIMIT}` : ''}`,
  );
  console.log(`checking ${hadiths.length} imported records…`);

  const tally = {
    corroborated: 0, partial: 0, not_found: 0,
    agree: 0, weak: 0, disagree: 0, noTakhrij: 0, outOfScope: 0,
  };
  const perCollection = new Map<string, number>();
  const pending: unknown[][] = [];

  for (const hadith of hadiths) {
    const tokens = matchTokens(hadith.raw_text);
    const list = uniqueShingles(tokens, SHINGLE);
    const scores = new Map<number, number>();

    for (const key of list) {
      const postings = index.get(key);
      if (!postings || postings.length > MAX_POSTINGS) continue;
      for (const refIndex of postings) scores.set(refIndex, (scores.get(refIndex) ?? 0) + 1);
    }

    /**
     * Containment: matched windows over the SHORTER of the two texts, so a
     * match counts when either text sits inside the other. This edition opens
     * with the companion («عن فلان قال») that a reference matn does not carry,
     * and a reference row sometimes carries commentary this edition omits —
     * dividing by either side alone would punish one of those every time.
     * (Measured: min() 71.6% corroborated vs 51.3% when dividing by the
     * reference alone, on the same first 1,000 records.)
     */
    let bestIndex = -1;
    let bestSimilarity = 0;
    const bestPerCollection = new Map<number, number>();
    for (const [refIndex, matched] of scores) {
      const refCount = refShingleCount[refIndex] as number;
      if (matched < MIN_MATCHED_SHINGLES || refCount < MIN_MATCHED_SHINGLES) continue;
      const similarityHere = Math.min(1, matched / Math.max(1, Math.min(list.length, refCount)));
      const collectionId = (refRows[refIndex] as RefRow).collection_id;
      if (similarityHere > (bestPerCollection.get(collectionId) ?? 0)) {
        bestPerCollection.set(collectionId, similarityHere);
      }
      if (similarityHere > bestSimilarity) {
        bestSimilarity = similarityHere;
        bestIndex = refIndex;
      }
    }

    const similarity = bestSimilarity;
    const verdict =
      similarity >= CORROBORATED_AT ? 'corroborated' : similarity >= PARTIAL_AT ? 'partial' : 'not_found';
    tally[verdict]++;

    const best = bestIndex === -1 ? null : (refRows[bestIndex] as RefRow);
    const collection = best ? (collections.get(best.collection_id) ?? null) : null;
    if (collection && verdict !== 'not_found') {
      perCollection.set(collection, (perCollection.get(collection) ?? 0) + 1);
    }

    /**
     * Agreement is judged against EVERY collection the author cited, not only
     * the single best match: the same hadith legitimately appears in several
     * collections, so "matched مشكاة المصابيح" is no evidence against a
     * takhrij that says البخاري.
     */
    const citedPresent = hadith.takhrij_collections.filter((name) => referenceAliases.has(name));
    let agrees: boolean | null = null;
    const citedScores: Record<string, number> = {};
    for (const name of citedPresent) {
      const collectionId = referenceAliases.get(name) as number;
      const score = bestPerCollection.get(collectionId) ?? 0;
      citedScores[name] = Number(score.toFixed(4));
    }
    const bestCited = Object.values(citedScores).reduce((a, b) => Math.max(a, b), 0);
    let support: 'strong' | 'weak' | 'none' | 'out_of_scope' | 'no_takhrij';
    if (hadith.takhrij_collections.length === 0) {
      support = 'no_takhrij';
      tally.noTakhrij++;
    } else if (citedPresent.length === 0) {
      // every collection the author cited is outside this reference corpus
      support = 'out_of_scope';
      tally.outOfScope++;
    } else if (bestCited >= CORROBORATED_AT) {
      support = 'strong';
      agrees = true;
      tally.agree++;
    } else if (bestCited >= PARTIAL_AT) {
      support = 'weak';
      agrees = true;
      tally.weak++;
    } else {
      support = 'none';
      agrees = false;
      tally.disagree++;
    }

    pending.push([
      hadith.id,
      corpusId,
      collection,
      best?.urn ?? null,
      best?.display_number ?? null,
      'shingle_overlap',
      similarity.toFixed(4),
      verdict,
      agrees,
      hadith.takhrij_collections,
      JSON.stringify({
        record_shingles: list.length,
        shingle_size: SHINGLE,
        reference_shingles: bestIndex === -1 ? null : refShingleCount[bestIndex],
        cited_collection_scores: citedScores,
        takhrij_support: support,
        best_cited_score: Number(bestCited.toFixed(4)),
        cited_outside_reference: hadith.takhrij_collections.filter(
          (name) => !referenceAliases.has(name),
        ),
      }),
    ]);
  }

  console.log(`writing ${pending.length} verdicts…`);
  await withTransaction(async (client) => {
    await client.query('delete from corpus.cross_checks where reference_corpus_id = $1', [corpusId]);
    const CHUNK = 500;
    for (let i = 0; i < pending.length; i += CHUNK) {
      const slice = pending.slice(i, i + CHUNK);
      const values: unknown[] = [];
      const tuples = slice.map((row, r) => {
        const base = r * 11;
        values.push(...row);
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11})`;
      });
      await client.query(
        `insert into corpus.cross_checks
           (hadith_id, reference_corpus_id, reference_collection, reference_key, reference_number,
            method, similarity, verdict, takhrij_agrees, takhrij_collections, details)
         values ${tuples.join(',')}`,
        values,
      );
    }
  });

  const total = hadiths.length;
  const pct = (n: number) => `${((100 * n) / total).toFixed(2)}%`;
  console.log('============ CROSS-CHECK REPORT ============');
  console.log(`reference          npm hadith@1.3.0 — ${refRows.length} records, ${collections.size} collections`);
  console.log(`records checked    ${total}`);
  console.log(`corroborated       ${tally.corroborated} (${pct(tally.corroborated)})  similarity ≥ ${CORROBORATED_AT}`);
  console.log(`partial            ${tally.partial} (${pct(tally.partial)})  ${PARTIAL_AT} ≤ similarity < ${CORROBORATED_AT}`);
  console.log(`not found          ${tally.not_found} (${pct(tally.not_found)})`);
  const inScope = tally.agree + tally.weak + tally.disagree;
  console.log('--- takhrij agreement (only where the cited collection exists in the reference) ---');
  console.log(`in scope           ${inScope}`);
  const pctOf = (n: number) => (inScope ? ` (${((100 * n) / inScope).toFixed(2)}%)` : '');
  console.log(`  strong support   ${tally.agree}${pctOf(tally.agree)}   cited collection scores ≥ ${CORROBORATED_AT}`);
  console.log(`  weak support     ${tally.weak}${pctOf(tally.weak)}   ≥ ${PARTIAL_AT}`);
  console.log(`  no support       ${tally.disagree}${pctOf(tally.disagree)}  ← raised for human review, nothing changed`);
  console.log(`out of scope       ${tally.outOfScope}  (cites only collections absent or incomplete in the reference:`);
  console.log(`                    الحاكم، الطبراني، البيهقي، ابن حبان، البزار… and مسند أحمد, which the reference itself marks incomplete)`);
  console.log(`no takhrij stored  ${tally.noTakhrij}`);
  console.log('best-matching collection:');
  for (const [name, count] of [...perCollection].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${name.padEnd(22)} ${count}`);
  }
  console.log(`elapsed            ${((Date.now() - started) / 1000).toFixed(1)} s`);
  console.log('============================================');
}

main()
  .catch((err) => {
    console.error(`cross-verify failed: ${(err as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => void closePool());
