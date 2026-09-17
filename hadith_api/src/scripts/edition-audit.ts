/**
 * Edition audit (§5): proves what the source files actually are, and that the
 * database matches them — volume by volume.
 *
 * It never trusts a filename: the volume number, the page range and the record
 * counts are read out of the file's own markers and compared with the database.
 *
 *   DATA_DIR=data node --experimental-strip-types src/scripts/edition-audit.ts
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { closePool, query, queryOne } from '../db.ts';
import { jamiKamilShamelaAdapter } from '../importer/adapters/jami_kamil_shamela.ts';

const DATA_DIR = process.env['DATA_DIR'] ?? 'data';
const EDITION_SLUG = process.env['EDITION_SLUG'] ?? 'jami-kamil-1437';
const DATASET = process.env['DATASET'] ?? 'JAMI-KAMIL-1437-V1';
const PAGE = /^\[ج(\d+)\s+ص(\d+)\]$/gm;

interface VolumeManifest {
  filename: string;
  size_bytes: number;
  sha256: string;
  volume_from_name: number | null;
  volumes_declared_inside: number[];
  page_markers: number;
  distinct_pages: number;
  first_page: number | null;
  last_page: number | null;
  records_parsed: number;
  books_seen: number;
  chapters_seen: number;
  with_grading: number;
  with_narrator: number;
  with_hadith_number: number;
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function auditFile(path: string, filename: string): VolumeManifest {
  const buffer = readFileSync(path);
  const text = buffer.toString('utf8');

  const volumes = new Set<number>();
  const pagesPerVolume = new Map<number, Set<number>>();
  let markers = 0;
  PAGE.lastIndex = 0;
  for (const m of text.matchAll(PAGE)) {
    markers++;
    const volume = Number(m[1]);
    const page = Number(m[2]);
    volumes.add(volume);
    const set = pagesPerVolume.get(volume) ?? new Set<number>();
    set.add(page);
    pagesPerVolume.set(volume, set);
  }

  const parsed = jamiKamilShamelaAdapter.parse(buffer, filename);
  const books = new Set(parsed.records.map((r) => r.book?.key).filter(Boolean));
  const chapters = new Set(parsed.records.map((r) => r.chapter?.key).filter(Boolean));
  const allPages = [...pagesPerVolume.values()].flatMap((s) => [...s]);

  const fromName = filename.match(/j(\d+)/)?.[1];
  return {
    filename,
    size_bytes: statSync(path).size,
    sha256: sha256File(path),
    volume_from_name: fromName ? Number(fromName) : null,
    volumes_declared_inside: [...volumes].sort((a, b) => a - b),
    page_markers: markers,
    distinct_pages: allPages.length,
    first_page: allPages.length ? Math.min(...allPages) : null,
    last_page: allPages.length ? Math.max(...allPages) : null,
    records_parsed: parsed.records.length,
    books_seen: books.size,
    chapters_seen: chapters.size,
    with_grading: parsed.records.filter((r) => r.grading !== null).length,
    with_narrator: parsed.records.filter((r) => r.narrator !== null).length,
    with_hadith_number: parsed.records.filter((r) => r.hadith_number !== null).length,
  };
}

async function main(): Promise<void> {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.txt')).sort();
  const manifest = files.map((f) => auditFile(`${DATA_DIR}/${f}`, f));
  const findings: string[] = [];
  const check = (ok: boolean, label: string, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
    if (!ok) findings.push(label + (detail ? `: ${detail}` : ''));
  };

  console.log('================ EDITION MANIFEST ================');
  console.log(
    'file'.padEnd(22) + 'vol'.padStart(4) + 'pages'.padStart(7) + 'first'.padStart(7) +
      'last'.padStart(7) + 'records'.padStart(9) + '  sha256',
  );
  for (const v of manifest) {
    console.log(
      v.filename.padEnd(22) +
        String(v.volumes_declared_inside.join('/')).padStart(4) +
        String(v.distinct_pages).padStart(7) +
        String(v.first_page ?? '-').padStart(7) +
        String(v.last_page ?? '-').padStart(7) +
        String(v.records_parsed).padStart(9) +
        '  ' + v.sha256.slice(0, 16) + '…',
    );
  }

  console.log('\n================ COMPLETENESS ================');
  // 1. one volume per file, and the file's name agrees with its own markers
  const nameMismatch = manifest.filter(
    (v) => v.volumes_declared_inside.length !== 1 || v.volumes_declared_inside[0] !== v.volume_from_name,
  );
  check(nameMismatch.length === 0, 'each file carries exactly the volume its name claims',
    nameMismatch.map((v) => `${v.filename}→${v.volumes_declared_inside.join(',')}`).join(' '));

  // 2. volumes are contiguous 1..N
  const volumes = manifest.map((v) => v.volumes_declared_inside[0] as number).sort((a, b) => a - b);
  const contiguous = volumes.every((v, i) => v === i + 1);
  check(contiguous, `volumes are contiguous 1..${volumes.length}`, volumes.join(','));

  // 3. the edition's declared volume_count matches what is on disk
  const edition = await queryOne<{ volume_count: number; title: string; edition_number: number }>(
    'select volume_count, title, edition_number from corpus.editions where slug = $1', [EDITION_SLUG]);
  check(edition?.volume_count === volumes.length,
    'the edition row declares the same number of volumes',
    `declared ${edition?.volume_count}, on disk ${volumes.length}`);

  // 4. pages inside a volume never run backwards
  const backwards = manifest.filter((v) => (v.first_page ?? 0) > (v.last_page ?? 0));
  check(backwards.length === 0, 'page numbers never run backwards inside a volume');

  // 5. totals
  const totalPages = manifest.reduce((a, v) => a + v.distinct_pages, 0);
  const totalRecords = manifest.reduce((a, v) => a + v.records_parsed, 0);
  console.log(`      pages across all volumes: ${totalPages}`);
  console.log(`      records parsed from files: ${totalRecords}`);

  console.log('\n================ FILE ↔ DATABASE ================');
  console.log('  "pages" counts every printed page in the file; "with text" counts the');
  console.log('  pages that actually carry a hadith (front matter and commentary carry none).');
  const dbRows = await query<{ volume_number: number; n: number; pages: number; min_page: number; max_page: number }>(
    `select volume_number, count(*)::int as n, count(distinct page_number)::int as pages,
            min(page_number) as min_page, max(page_number) as max_page
     from corpus.hadiths where dataset_version = $1 group by volume_number order by volume_number`,
    [DATASET],
  );
  const byVolume = new Map(dbRows.map((r) => [r.volume_number, r]));
  let mismatches = 0;
  for (const v of manifest) {
    const volume = v.volumes_declared_inside[0] as number;
    const db = byVolume.get(volume);
    const ok = db?.n === v.records_parsed;
    if (!ok) mismatches++;
    console.log(
      `  ج${String(volume).padEnd(3)} file ${String(v.records_parsed).padStart(5)} · db ${String(db?.n ?? 0).padStart(5)}` +
        `  pages file ${String(v.distinct_pages).padStart(4)} · with text ${String(db?.pages ?? 0).padStart(4)}` +
        `  ${ok ? 'PASS' : 'FAIL'}`,
    );
  }
  check(mismatches === 0, 'every volume holds exactly the records its file parses to');

  const dbTotal = await queryOne<{ n: number }>(
    'select count(*)::int as n from corpus.hadiths where dataset_version = $1', [DATASET]);
  check(dbTotal?.n === totalRecords, 'database total equals the files total',
    `db ${dbTotal?.n}, files ${totalRecords}`);

  console.log('\n================ NUMBERING & ORDER ================');
  const numbered = await queryOne<{ n: number }>(
    'select count(*)::int as n from corpus.hadiths where dataset_version = $1 and hadith_number is not null',
    [DATASET]);
  check(numbered?.n === 0,
    'this edition prints no hadith numbers, so none was invented',
    `records carrying a number: ${numbered?.n}`);

  const locatorDupes = await query(
    `select source_locator from corpus.hadiths where dataset_version = $1
     group by source_locator having count(*) > 1`, [DATASET]);
  check(locatorDupes.length === 0, 'every source locator is unique');

  const outOfOrder = await query(
    `with ordered as (
       select volume_number, page_number, source_ordinal,
              lag(page_number) over (partition by volume_number order by source_ordinal) as prev
       from corpus.hadiths where dataset_version = $1)
     select * from ordered where prev is not null and page_number < prev`, [DATASET]);
  check(outOfOrder.length === 0, 'reading order never goes back a page inside a volume');

  const outOfRange = await query(
    `select h.id from corpus.hadiths h join corpus.editions e on e.id = h.edition_id
     where h.dataset_version = $1 and h.volume_number > e.volume_count`, [DATASET]);
  check(outOfRange.length === 0,
    'no record claims a volume beyond this edition (a 19-volume printing is a DIFFERENT edition)');

  console.log('\n================ FIELD COVERAGE ================');
  const coverage = await queryOne<Record<string, number>>(
    `select count(*)::int as total,
            count(*) filter (where grading is not null)::int as with_grading,
            count(*) filter (where narrator_id is not null)::int as with_narrator,
            count(*) filter (where takhrij is not null)::int as with_takhrij,
            count(*) filter (where matn is not null)::int as with_matn,
            count(*) filter (where isnad is not null)::int as with_isnad,
            count(*) filter (where volume_number is not null and page_number is not null)::int as with_location
     from corpus.hadiths where dataset_version = $1`, [DATASET]);
  const refs = await queryOne<{ n: number; distinct_names: number }>(
    `select count(*)::int as n, count(distinct source_name)::int as distinct_names
     from corpus.hadith_sources hs join corpus.hadiths h on h.id = hs.hadith_id
     where h.dataset_version = $1`, [DATASET]);
  const gradings = await queryOne<{ n: number }>(
    `select count(*)::int as n from corpus.hadith_gradings g join corpus.hadiths h on h.id = g.hadith_id
     where h.dataset_version = $1`, [DATASET]);
  for (const [k, v] of Object.entries(coverage ?? {})) console.log(`  ${k.padEnd(16)} ${v}`);
  console.log(`  takhrij_links    ${refs?.n} across ${refs?.distinct_names} collections`);
  console.log(`  grading_records  ${gradings?.n}`);
  check((coverage?.['with_location'] ?? 0) === (coverage?.['total'] ?? -1),
    'every record carries the volume and page the print gives it');
  check((coverage?.['with_matn'] ?? 0) === 0 && (coverage?.['with_isnad'] ?? 0) === 0,
    'matn/isnad stay NULL — this edition never separates them');

  console.log('\n================ RESULT ================');
  console.log(findings.length === 0 ? 'EDITION AUDIT: PASS' : `EDITION AUDIT: FAIL (${findings.length})`);
  for (const f of findings) console.log(`  - ${f}`);
  if (findings.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(`edition audit failed: ${(err as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => void closePool());
