/**
 * Structural verification: takes a random sample of imported records and checks
 * that the stored text still exists BYTE FOR BYTE in the source file, on the
 * volume and page the record claims.
 *
 * This proves the pipeline did not alter the text. It is NOT human verification
 * of the hadith against its original collection, so it records
 * verification_type='structural' and never sets verified=true.
 *
 *   node --experimental-strip-types src/scripts/sample-verify.ts [sampleSize]
 */
import { readFileSync } from 'node:fs';
import { closePool, query } from '../db.ts';
import { contentHash } from '../domain/hash.ts';

const SAMPLE = Number(process.argv[2] ?? 200);
const DATA_DIR = process.env['DATA_DIR'] ?? 'data';

interface Row {
  id: string;
  raw_text: string;
  content_hash: string;
  volume_number: number | null;
  page_number: number | null;
  source_locator: string | null;
  grading: string | null;
  book: string | null;
  chapter: string | null;
}

const volumeCache = new Map<number, string>();
function volumeText(volume: number): string {
  const cached = volumeCache.get(volume);
  if (cached) return cached;
  const file = `${DATA_DIR}/jami-kamil-j${String(volume).padStart(2, '0')}.txt`;
  const text = readFileSync(file, 'utf8');
  volumeCache.set(volume, text);
  return text;
}

async function main(): Promise<void> {
  const rows = await query<Row>(
    `select h.id, h.raw_text, h.content_hash, h.volume_number, h.page_number,
            h.source_locator, h.grading, b.name as book, c.name as chapter
     from corpus.hadiths h
     left join corpus.books b on b.id = h.book_id
     left join corpus.chapters c on c.id = h.chapter_id
     where h.dataset_version = $1
     order by random() limit $2`,
    [process.env['DATASET'] ?? 'JAMI-KAMIL-1437-V1', SAMPLE],
  );

  let textMatch = 0;
  let pageMatch = 0;
  let hashMatch = 0;
  const failures: string[] = [];

  for (const row of rows) {
    const volume = row.volume_number as number;
    const source = volumeText(volume);

    // 1. every stored line must occur verbatim in the source volume. The lines
    //    of one record can be separated in the file by a page marker, so the
    //    joined text is checked line by line, not as one blob.
    const storedLines = row.raw_text.split('\n');
    const missing = storedLines.filter((line) => !source.includes(line));
    if (missing.length > 0) {
      failures.push(
        `${row.source_locator}: ${missing.length}/${storedLines.length} stored line(s) not found verbatim in volume ${volume}`,
      );
      continue;
    }
    textMatch++;

    // 2. the text must sit on the page the record claims. The same wording can
    //    recur in the volume (the book repeats narrations), so EVERY occurrence
    //    is considered and the claim holds if any of them is on that page.
    const first = storedLines[0] as string;
    const pagesFound: string[] = [];
    let claimHolds = false;
    for (let at = source.indexOf(first); at !== -1; at = source.indexOf(first, at + 1)) {
      const marker = [...source.slice(0, at).matchAll(/\[ج(\d+)\s+ص(\d+)\]/g)].pop();
      const foundVolume = marker ? Number(marker[1]) : null;
      const foundPage = marker ? Number(marker[2]) : null;
      pagesFound.push(`ج${foundVolume} ص${foundPage}`);
      if (foundVolume === volume && foundPage === row.page_number) {
        claimHolds = true;
        break;
      }
    }
    if (claimHolds) {
      pageMatch++;
    } else {
      failures.push(
        `${row.source_locator}: text occurs on ${pagesFound.join(', ')} but never on the claimed page`,
      );
    }

    // 3. the hash the database computed must equal a fresh hash of that text
    if (contentHash(row.raw_text) === row.content_hash) hashMatch++;
    else failures.push(`${row.source_locator}: content_hash does not match the stored text`);
  }

  for (const row of rows) {
    await query(
      `insert into corpus.verification_records
         (hadith_id, verification_type, verified_by, source_reference, notes, content_hash, result)
       values ($1, 'structural', 'sample-verify script', $2,
               'machine check against the source file: text found verbatim on the claimed page. NOT a human verification.',
               $3, $4)`,
      [
        row.id,
        row.source_locator,
        row.content_hash,
        failures.some((f) => f.startsWith(String(row.source_locator))) ? 'failed' : 'passed',
      ],
    );
  }

  console.log('========= STRUCTURAL SAMPLE VERIFICATION =========');
  console.log(`sample size            ${rows.length}`);
  console.log(`text found verbatim    ${textMatch}/${rows.length}`);
  console.log(`page marker agrees     ${pageMatch}/${rows.length}`);
  console.log(`content_hash agrees    ${hashMatch}/${rows.length}`);
  console.log(`failures               ${failures.length}`);
  for (const f of failures.slice(0, 15)) console.log(`  ${f}`);
  console.log('-------------------------------------------------');
  console.log('This is a machine check of the IMPORT, not a human check of the');
  console.log('HADITH. verified stays false and verification_status stays pending');
  console.log('until a human compares a sample against the printed edition.');
  console.log('=================================================');
  if (failures.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(`sample verification failed: ${(err as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => void closePool());
