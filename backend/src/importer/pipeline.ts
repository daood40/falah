import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { PoolClient } from 'pg';
import { allowSourceWrite, query, queryOne, withTransaction } from '../db.ts';
import { contentHash, fileHash } from '../domain/hash.ts';
import { normalizeArabic } from '../domain/normalize.ts';
import { getAdapter } from './adapters/index.ts';
import { validateRecord, type RecordIssue } from './validate.ts';
import type { SourceRecord } from './types.ts';
import type { ImportReport } from './report.ts';

export interface ImportOptions {
  adapter: string;
  file: string;
  editionSlug: string;
  datasetVersion?: string;
  dryRun: boolean;
  actor?: string;
}

interface EditionRow {
  id: string;
  slug: string;
  title: string;
  source_id: string;
  volume_count: number | null;
  page_count: number | null;
  dataset_version: string | null;
  source_name: string;
}

/** RAW → PARSE → VALIDATE → IMPORT → VERIFY (§16). */
export async function runImport(opts: ImportOptions): Promise<ImportReport> {
  const startedAt = new Date().toISOString();
  const fileName = basename(opts.file);
  const buffer = readFileSync(opts.file);
  const hash = fileHash(buffer);

  const edition = await queryOne<EditionRow>(
    `select e.id, e.slug, e.title, e.source_id, e.volume_count, e.page_count, e.dataset_version,
            s.name as source_name
     from corpus.editions e join corpus.sources s on s.id = e.source_id
     where e.slug = $1`,
    [opts.editionSlug],
  );
  if (!edition) throw new Error(`unknown edition slug "${opts.editionSlug}"`);

  const datasetVersion = opts.datasetVersion ?? edition.dataset_version;
  if (!datasetVersion) throw new Error('no dataset_version given and the edition has none');
  const dv = await queryOne('select version from corpus.dataset_versions where version = $1', [
    datasetVersion,
  ]);
  if (!dv) throw new Error(`unknown dataset_version "${datasetVersion}"`);

  // ---- PARSE ----
  const parsed = getAdapter(opts.adapter).parse(buffer, fileName);

  // ---- VALIDATE ----
  const errors: RecordIssue[] = [];
  const warnings: RecordIssue[] = [];
  const valid: SourceRecord[] = [];
  let missingData = 0;

  const seenNumbers = new Set<string>();
  let duplicates = 0;

  for (const [i, rec] of parsed.records.entries()) {
    const res = validateRecord(rec, i, {
      volume_count: edition.volume_count,
      page_count: edition.page_count,
    });
    warnings.push(...res.warnings);
    if (res.warnings.some((w) => w.code === 'MISSING_NUMBER' || w.code === 'NOT_SEPARATED')) {
      missingData++;
    }
    if (res.errors.length > 0) {
      errors.push(...res.errors);
      continue;
    }
    if (rec.hadith_number !== null) {
      if (seenNumbers.has(rec.hadith_number)) {
        duplicates++;
        warnings.push({
          record: i + 1,
          field: 'hadith_number',
          code: 'DUPLICATE_IN_FILE',
          message: `hadith_number "${rec.hadith_number}" repeats in this file — kept out, nothing is deleted`,
        });
        continue;
      }
      seenNumbers.add(rec.hadith_number);
    }
    valid.push(rec);
  }

  const base: ImportReport = {
    source: edition.source_name,
    edition: edition.title,
    dataset_version: datasetVersion,
    adapter: opts.adapter,
    file_name: fileName,
    file_hash: hash,
    dry_run: opts.dryRun,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    total_records: parsed.records.length,
    imported: 0,
    skipped: parsed.records.length - valid.length,
    duplicates,
    invalid: errors.length,
    missing_data: missingData,
    verified_hashes: 0,
    hash_mismatches: 0,
    errors,
    warnings,
    parser_warnings: parsed.warnings,
    status: opts.dryRun ? 'dry_run' : 'completed',
    raw_import_id: null,
  };

  // ---- DRY RUN: report only, not one database write (§17) ----
  if (opts.dryRun) {
    base.finished_at = new Date().toISOString();
    return base;
  }

  // ---- IMPORT ----
  const importRow = await queryOne<{ id: string }>(
    `insert into corpus.raw_imports
       (source_id, edition_id, dataset_version, adapter, file_name, file_hash, dry_run, status, total_records)
     values ($1, $2, $3, $4, $5, $6, false, 'running', $7) returning id`,
    [edition.source_id, edition.id, datasetVersion, opts.adapter, fileName, hash, parsed.records.length],
  );
  const importId = importRow?.id as string;
  base.raw_import_id = importId;

  const insertedIds: { id: string; expected: string }[] = [];
  try {
    await withTransaction(async (c) => {
      await allowSourceWrite(c);
      const books = new Map<string, string>();
      const chapters = new Map<string, string>();
      const narrators = new Map<string, string>();

      for (const rec of valid) {
        const bookId = rec.book ? await upsertBook(c, edition.id, rec, books) : null;
        const chapterId =
          rec.chapter && bookId ? await upsertChapter(c, bookId, rec, chapters) : null;
        const narratorId = rec.narrator
          ? await upsertNarrator(c, edition.id, rec.narrator, narrators)
          : null;

        const existing = await c.query(
          `select id from corpus.hadiths
           where dataset_version = $1 and edition_id = $2 and hadith_number is not distinct from $3`,
          [datasetVersion, edition.id, rec.hadith_number],
        );
        if (existing.rowCount && rec.hadith_number !== null) {
          base.duplicates++;
          base.skipped++;
          warnings.push({
            record: 0,
            field: 'hadith_number',
            code: 'DUPLICATE_IN_DB',
            message: `hadith_number "${rec.hadith_number}" already exists in ${datasetVersion} — left untouched`,
          });
          continue;
        }

        const numeric = rec.hadith_number?.match(/^\d+/)?.[0];
        const inserted = await c.query<{ id: string }>(
          `insert into corpus.hadiths
             (edition_id, book_id, chapter_id, hadith_number, hadith_number_int, volume_number,
              page_number, raw_text, matn, isnad, narrator_id, takhrij, grading,
              original_reference, original_hadith_number, dataset_version, raw_import_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id`,
          [
            edition.id, bookId, chapterId, rec.hadith_number,
            numeric ? Number(numeric) : null,
            rec.volume_number, rec.page_number, rec.raw_text, rec.matn, rec.isnad,
            narratorId, rec.takhrij, rec.grading, rec.original_reference,
            rec.original_hadith_number, datasetVersion, importId,
          ],
        );
        const hadithId = (inserted.rows[0] as { id: string }).id;
        insertedIds.push({ id: hadithId, expected: contentHash(rec.raw_text) });

        for (const s of rec.sources) {
          await c.query(
            `insert into corpus.hadith_sources (hadith_id, source_name, reference, reference_number)
             values ($1,$2,$3,$4)`,
            [hadithId, s.source_name, s.reference, s.reference_number],
          );
        }
        for (const g of rec.gradings) {
          await c.query(
            `insert into corpus.hadith_gradings (hadith_id, grading, grader, source_reference, notes)
             values ($1,$2,$3,$4,$5)`,
            [hadithId, g.grading, g.grader, g.source_reference, g.notes],
          );
        }
        for (const n of rec.narrators) {
          const nid = await upsertNarrator(
            c, edition.id, { name: n.name, kunya: null, laqab: null, biography: null }, narrators,
          );
          await c.query(
            `insert into corpus.hadith_narrators (hadith_id, narrator_id, position, role)
             values ($1,$2,$3,$4) on conflict do nothing`,
            [hadithId, nid, n.position, n.role],
          );
        }
        for (const r of rec.references) {
          await c.query(
            `insert into corpus.hadith_references (hadith_id, reference_type, reference_text)
             values ($1,$2,$3)`,
            [hadithId, r.reference_type, r.reference_text],
          );
        }
        base.imported++;
      }
    });
  } catch (err) {
    await query(
      `update corpus.raw_imports set status = 'failed', import_completed_at = now(),
         validation_errors = $2, report = $3 where id = $1`,
      [importId, JSON.stringify(errors), JSON.stringify({ error: (err as Error).message })],
    );
    base.status = 'failed';
    base.errors.push({ record: 0, field: '*', code: 'IMPORT_FAILED', message: (err as Error).message });
    base.finished_at = new Date().toISOString();
    return base;
  }

  // ---- VERIFY: the database's own hash must equal the importer's ----
  for (const { id, expected } of insertedIds) {
    const row = await queryOne<{ content_hash: string }>(
      'select content_hash from corpus.hadiths where id = $1',
      [id],
    );
    const match = row?.content_hash === expected;
    if (match) base.verified_hashes++;
    else {
      base.hash_mismatches++;
      base.errors.push({
        record: 0, field: 'content_hash', code: 'HASH_MISMATCH',
        message: `stored hash for ${id} does not match the imported text`,
      });
    }
    await query(
      `insert into corpus.verification_records
         (hadith_id, verification_type, verified_by, source_reference, notes, content_hash, result)
       values ($1, 'hash_check', $2, $3, 'automated hash check at import; not a human verification',
               $4, $5)`,
      [id, opts.actor ?? 'importer', fileName, expected, match ? 'passed' : 'failed'],
    );
  }

  base.finished_at = new Date().toISOString();
  await query(
    `update corpus.raw_imports set status = $2, import_completed_at = now(),
       successful_records = $3, failed_records = $4, skipped_records = $5,
       duplicate_records = $6, validation_errors = $7, report = $8
     where id = $1`,
    [
      importId, base.hash_mismatches > 0 ? 'failed' : 'completed',
      base.imported, base.errors.length, base.skipped, base.duplicates,
      JSON.stringify(errors), JSON.stringify(base),
    ],
  );
  await query(
    `insert into corpus.audit_logs (actor, actor_role, action, entity_type, entity_id, details)
     values ($1, 'service', 'import.run', 'raw_import', $2, $3)`,
    [opts.actor ?? 'importer', importId, JSON.stringify({ imported: base.imported, file: fileName })],
  );
  if (base.hash_mismatches > 0) base.status = 'failed';
  return base;
}

async function upsertBook(
  c: PoolClient, editionId: string, rec: SourceRecord, cache: Map<string, string>,
): Promise<string> {
  const book = rec.book as NonNullable<SourceRecord['book']>;
  const cached = cache.get(book.key);
  if (cached) return cached;
  const res = await c.query<{ id: string }>(
    `insert into corpus.books (edition_id, external_key, name, order_number)
     values ($1,$2,$3,$4)
     on conflict (edition_id, external_key) do update set name = excluded.name
     returning id`,
    [editionId, book.key, book.name, book.order_number],
  );
  const id = (res.rows[0] as { id: string }).id;
  cache.set(book.key, id);
  return id;
}

async function upsertChapter(
  c: PoolClient, bookId: string, rec: SourceRecord, cache: Map<string, string>,
): Promise<string> {
  const ch = rec.chapter as NonNullable<SourceRecord['chapter']>;
  const cacheKey = `${bookId}:${ch.key}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const parentId = ch.parent_key ? (cache.get(`${bookId}:${ch.parent_key}`) ?? null) : null;
  const res = await c.query<{ id: string }>(
    `insert into corpus.chapters (book_id, parent_id, external_key, name, chapter_number, order_number)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (book_id, external_key) do update set name = excluded.name
     returning id`,
    [bookId, parentId, ch.key, ch.name, ch.chapter_number, ch.order_number],
  );
  const id = (res.rows[0] as { id: string }).id;
  cache.set(cacheKey, id);
  return id;
}

async function upsertNarrator(
  c: PoolClient,
  editionId: string,
  narrator: NonNullable<SourceRecord['narrator']>,
  cache: Map<string, string>,
): Promise<string> {
  const normalized = normalizeArabic(narrator.name);
  const cached = cache.get(normalized);
  if (cached) return cached;
  const res = await c.query<{ id: string }>(
    `insert into corpus.narrators (edition_id, name, normalized_name, kunya, laqab, biography)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (edition_id, normalized_name) do update set name = corpus.narrators.name
     returning id`,
    [editionId, narrator.name, normalized, narrator.kunya, narrator.laqab, narrator.biography],
  );
  const id = (res.rows[0] as { id: string }).id;
  cache.set(normalized, id);
  return id;
}
