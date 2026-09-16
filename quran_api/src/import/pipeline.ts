import type pg from 'pg';

/** Anything that can run SQL: a pooled client or a plain client. */
export type SqlClient = Pick<pg.PoolClient, 'query'>;
import { contentHash } from '../core/hash.ts';
import { parseDataset, type ParsedDataset } from './parse.ts';
import { hasErrors, validateDataset, type ValidationIssue } from './validate.ts';
import { QIRAAT, QURAN_EDITION, RIWAYAT, SOURCES, TRANSLATIONS } from './registry.ts';
import { seedLicenseCenter } from './license-center.ts';

export const PIPELINE_VERSION = '1.0.0';

export type ImportMode = 'dry-run' | 'validate-only' | 'import';

export type ImportReport = {
  pipeline_version: string;
  mode: ImportMode;
  dataset_version: string;
  source_file_hash: string;
  started_at: string;
  finished_at: string;
  totals: Record<string, number>;
  counters: {
    imported: number;
    failed: number;
    skipped: number;
    duplicates: number;
    invalid: number;
    missing: number;
    verified: number;
  };
  issues: ValidationIssue[];
  errors: string[];
  /** False until a named person records an approved verification (migration 0004). */
  human_verified: boolean;
  dataset_status: string;
  status: 'success' | 'failed';
};

export type ImportOptions = {
  mode: ImportMode;
  version: string;
  languages: string[];
  publish: boolean;
};

/** SOURCE → RAW → PARSE → VALIDATE → HASH → IMPORT → VERIFY → PUBLISH */
export async function runImport(
  client: SqlClient,
  options: ImportOptions,
): Promise<ImportReport> {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  const counters = {
    imported: 0,
    failed: 0,
    skipped: 0,
    duplicates: 0,
    invalid: 0,
    missing: 0,
    verified: 0,
  };

  const dataset: ParsedDataset = parseDataset(options.languages);
  const issues = validateDataset(dataset);
  counters.invalid = issues.filter((i) => i.severity === 'error').length;

  const totals = {
    surahs: dataset.surahs.length,
    ayahs: dataset.ayahs.length,
    juzs: dataset.juzs.length,
    hizbs: new Set(dataset.rubs.map((r) => r.hizb_number)).size,
    rubs: dataset.rubs.length,
    pages: dataset.pages.length,
    manzils: dataset.manzils.length,
    sajdahs: dataset.ayahs.filter((a) => a.sajdah).length,
    translations: dataset.translations.length,
    ayah_translations: dataset.translations.reduce((sum, t) => sum + t.entries.length, 0),
    reciters: 0,
    recitations: 0,
    audio_files: 0,
  };

  let humanVerified = false;
  let datasetStatus = options.mode === 'import' ? 'pending' : 'not-written';

  const finish = (status: 'success' | 'failed'): ImportReport => ({
    pipeline_version: PIPELINE_VERSION,
    mode: options.mode,
    dataset_version: options.version,
    source_file_hash: dataset.source_file_hash,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    totals,
    counters,
    issues,
    errors,
    human_verified: humanVerified,
    dataset_status: datasetStatus,
    status,
  });

  if (hasErrors(issues)) {
    errors.push('validation failed — nothing was written');
    return finish('failed');
  }
  if (options.mode !== 'import') {
    counters.skipped = totals.ayahs + totals.ayah_translations;
    return finish('success');
  }

  // ---------- SOURCES ----------
  for (const source of SOURCES) {
    await client.query(
      `insert into quran.sources (id, name, organization, url, api_url, description, language,
         license, license_url, attribution_required, attribution_text, version, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       on conflict (id) do update set name = excluded.name, version = excluded.version,
         license = excluded.license, license_url = excluded.license_url,
         attribution_text = excluded.attribution_text, status = excluded.status,
         updated_at = now()`,
      [
        source.id, source.name, source.organization, source.url, source.api_url,
        source.description, source.language, source.license, source.license_url,
        source.attribution_required, source.attribution_text, source.version, source.status,
      ],
    );
  }

  // ---------- LICENSE CENTER ----------
  // Recorded before anything else so the licence state of every dataset is
  // visible even if a later step fails.
  await seedLicenseCenter(client);

  // ---------- QIRAAT / RIWAYAT ----------
  for (const qiraah of QIRAAT) {
    await client.query(
      `insert into quran.qiraat (slug, name_ar, name_en, source_id, license, license_url, verified)
       values ($1,$2,$3,$4,$5,$6,true)
       on conflict (slug) do update set name_ar = excluded.name_ar, updated_at = now()`,
      [qiraah.slug, qiraah.name_ar, qiraah.name_en, qiraah.source_id, 'MIT',
       'https://github.com/quran-center/quran-meta/blob/master/LICENSE'],
    );
  }
  for (const riwayah of RIWAYAT) {
    await client.query(
      `insert into quran.riwayat (qiraah_id, slug, name_ar, name_en, source_id, license, license_url, verified)
       values ((select id from quran.qiraat where slug = $1), $2,$3,$4,$5,$6,$7,true)
       on conflict (slug) do update set name_ar = excluded.name_ar, updated_at = now()`,
      [riwayah.qiraah_slug, riwayah.slug, riwayah.name_ar, riwayah.name_en, riwayah.source_id,
       'MIT', 'https://github.com/quran-center/quran-meta/blob/master/LICENSE'],
    );
  }

  // ---------- EDITION ----------
  const editionSource = SOURCES.find((s) => s.id === QURAN_EDITION.source_id)!;
  const editionResult = await client.query<{ id: string }>(
    `insert into quran.quran_editions (source_id, slug, name, edition_type, riwayah, qiraah,
       script_type, font_name, version, publisher, country, language, license, license_url)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     on conflict (slug) do update set version = excluded.version, name = excluded.name,
       license = excluded.license, updated_at = now()
     returning id`,
    [
      QURAN_EDITION.source_id, QURAN_EDITION.slug, QURAN_EDITION.name, QURAN_EDITION.edition_type,
      QURAN_EDITION.riwayah, QURAN_EDITION.qiraah, QURAN_EDITION.script_type,
      QURAN_EDITION.font_name, options.version, QURAN_EDITION.publisher, QURAN_EDITION.country,
      QURAN_EDITION.language, editionSource.license, editionSource.license_url,
    ],
  );
  const editionId = editionResult.rows[0]!.id;

  // ---------- DATASET VERSION ----------
  const datasetResult = await client.query<{ id: string }>(
    `insert into quran.quran_dataset_versions (source_id, edition_id, version, source_file_hash,
       record_count, status, notes)
     values ($1,$2,$3,$4,$5,'imported',$6)
     on conflict (source_id, edition_id, version) do update set
       source_file_hash = excluded.source_file_hash, record_count = excluded.record_count,
       status = 'imported', import_date = now()
     returning id`,
    [
      QURAN_EDITION.source_id, editionId, options.version, dataset.source_file_hash,
      dataset.ayahs.length,
      `quran-json ${dataset.quran_json_version} + quran-meta ${dataset.quran_meta_version}`,
    ],
  );
  const datasetVersionId = datasetResult.rows[0]!.id;

  // ---------- SURAHS ----------
  const surahIds = new Map<number, string>();
  for (const surah of dataset.surahs) {
    const { rows } = await client.query<{ id: string }>(
      `insert into quran.surahs (edition_id, surah_number, name_ar, name_en, name_transliteration,
         revelation_place, revelation_order, ayah_count, bismillah, source_id, verified, dataset_version)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11)
       on conflict (edition_id, surah_number) do update set
         name_ar = excluded.name_ar, name_en = excluded.name_en,
         name_transliteration = excluded.name_transliteration,
         revelation_place = excluded.revelation_place, revelation_order = excluded.revelation_order,
         ayah_count = excluded.ayah_count, dataset_version = excluded.dataset_version,
         updated_at = now()
       returning id`,
      [
        editionId, surah.surah_number, surah.name_ar, surah.name_en, surah.name_transliteration,
        surah.revelation_place, surah.revelation_order, surah.ayah_count, surah.bismillah,
        QURAN_EDITION.source_id, options.version,
      ],
    );
    surahIds.set(surah.surah_number, rows[0]!.id);
  }

  // ---------- AYAHS (batched) ----------
  const ayahIds = new Map<string, string>();
  const BATCH = 500;
  for (let start = 0; start < dataset.ayahs.length; start += BATCH) {
    const batch = dataset.ayahs.slice(start, start + BATCH);
    const values: unknown[] = [];
    const tuples = batch.map((ayah) => {
      const base = values.length;
      values.push(
        editionId, surahIds.get(ayah.surah_number), ayah.ayah_number, ayah.global_ayah_number,
        ayah.juz_number, ayah.hizb_number, ayah.rub_number, ayah.page_number, ayah.manzil_number,
        ayah.ruku_number, ayah.sajdah, ayah.sajdah_type, ayah.raw_text, ayah.text_uthmani,
        ayah.text_simple, ayah.search_text, ayah.search_skeleton, ayah.content_hash,
        options.version, QURAN_EDITION.source_id,
      );
      const p = (offset: number): string => `$${base + offset}`;
      return `(${p(1)}::uuid, ${p(2)}::uuid, ${p(3)}::int, ${p(4)}::int, ${p(5)}::int, ${p(6)}::int,
        ${p(7)}::int, ${p(8)}::int, ${p(9)}::int, ${p(10)}::int, ${p(11)}::boolean, ${p(12)},
        ${p(13)}, ${p(14)}, ${p(15)}, ${p(16)}, ${p(17)}, ${p(18)}, ${p(19)}, ${p(20)})`;
    });
    const { rows } = await client.query<{ id: string; surah_number: number; ayah_number: number }>(
      `insert into quran.ayahs (edition_id, surah_id, ayah_number, global_ayah_number, juz_number,
         hizb_number, rub_number, page_number, manzil_number, ruku_number, sajdah, sajdah_type,
         raw_text, text_uthmani, text_simple, search_text, search_skeleton, content_hash,
         dataset_version, source_id)
       values ${tuples.join(',')}
       on conflict (edition_id, surah_id, ayah_number) do update set
         juz_number = excluded.juz_number, hizb_number = excluded.hizb_number,
         rub_number = excluded.rub_number, page_number = excluded.page_number,
         manzil_number = excluded.manzil_number, ruku_number = excluded.ruku_number,
         sajdah = excluded.sajdah, search_text = excluded.search_text,
         search_skeleton = excluded.search_skeleton,
         dataset_version = excluded.dataset_version
       returning id, global_ayah_number`,
      values,
    );
    for (const row of rows as unknown as { id: string; global_ayah_number: number }[]) {
      ayahIds.set(String(row.global_ayah_number), row.id);
    }
    counters.imported += batch.length;
  }

  // ---------- DIVISIONS ----------
  for (const juz of dataset.juzs) {
    await client.query(
      `insert into quran.juzs (edition_id, juz_number, start_surah, start_ayah, end_surah, end_ayah,
         start_global_ayah, end_global_ayah, source_id, verified)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
       on conflict (edition_id, juz_number) do update set
         start_surah = excluded.start_surah, start_ayah = excluded.start_ayah,
         end_surah = excluded.end_surah, end_ayah = excluded.end_ayah,
         start_global_ayah = excluded.start_global_ayah, end_global_ayah = excluded.end_global_ayah`,
      [editionId, juz.number, juz.start_surah, juz.start_ayah, juz.end_surah, juz.end_ayah,
       juz.start_global_ayah, juz.end_global_ayah, 'quran-meta'],
    );
  }
  for (const rub of dataset.rubs) {
    await client.query(
      `insert into quran.hizbs (edition_id, hizb_number, quarter, rub_number, juz_number,
         start_surah, start_ayah, end_surah, end_ayah, start_global_ayah, end_global_ayah,
         source_id, verified)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)
       on conflict (edition_id, rub_number) do update set
         hizb_number = excluded.hizb_number, quarter = excluded.quarter,
         juz_number = excluded.juz_number, start_global_ayah = excluded.start_global_ayah,
         end_global_ayah = excluded.end_global_ayah`,
      [editionId, rub.hizb_number, rub.quarter, rub.rub_number, rub.juz_number, rub.start_surah,
       rub.start_ayah, rub.end_surah, rub.end_ayah, rub.start_global_ayah, rub.end_global_ayah,
       'quran-meta'],
    );
  }
  for (const page of dataset.pages) {
    await client.query(
      `insert into quran.pages (edition_id, page_number, start_surah, start_ayah, end_surah,
         end_ayah, start_global_ayah, end_global_ayah, source_id, verified)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
       on conflict (edition_id, page_number) do update set
         start_global_ayah = excluded.start_global_ayah, end_global_ayah = excluded.end_global_ayah`,
      [editionId, page.number, page.start_surah, page.start_ayah, page.end_surah, page.end_ayah,
       page.start_global_ayah, page.end_global_ayah, 'quran-meta'],
    );
  }
  for (const manzil of dataset.manzils) {
    await client.query(
      `insert into quran.manzils (edition_id, manzil_number, start_surah, start_ayah, end_surah,
         end_ayah, start_global_ayah, end_global_ayah, source_id, verified)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
       on conflict (edition_id, manzil_number) do update set
         start_global_ayah = excluded.start_global_ayah, end_global_ayah = excluded.end_global_ayah`,
      [editionId, manzil.number, manzil.start_surah, manzil.start_ayah, manzil.end_surah,
       manzil.end_ayah, manzil.start_global_ayah, manzil.end_global_ayah, 'quran-meta'],
    );
  }

  // ---------- TRANSLATIONS ----------
  const globalByKey = new Map<string, number>();
  dataset.ayahs.forEach((ayah) => {
    globalByKey.set(`${ayah.surah_number}:${ayah.ayah_number}`, ayah.global_ayah_number);
  });

  for (const translation of dataset.translations) {
    const definition = TRANSLATIONS.find((t) => t.slug === translation.slug)!;
    const { rows } = await client.query<{ id: string }>(
      `insert into quran.translations (slug, language, translator, title, edition_id, source_id,
         license, license_url, version, verified)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
       on conflict (slug) do update set title = excluded.title, version = excluded.version,
         updated_at = now()
       returning id`,
      [
        definition.slug, definition.language, definition.translator, definition.title, editionId,
        'quran-json', editionSource.license, editionSource.license_url, options.version,
      ],
    );
    const translationId = rows[0]!.id;

    for (let start = 0; start < translation.entries.length; start += BATCH) {
      const batch = translation.entries.slice(start, start + BATCH);
      const values: unknown[] = [];
      const tuples: string[] = [];
      for (const entry of batch) {
        const globalNumber = globalByKey.get(`${entry.surah_number}:${entry.ayah_number}`);
        const ayahId = globalNumber === undefined ? undefined : ayahIds.get(String(globalNumber));
        if (!ayahId) {
          counters.missing += 1;
          continue;
        }
        const base = values.length;
        values.push(ayahId, translationId, entry.text, entry.content_hash, options.version);
        tuples.push(
          `($${base + 1}::uuid, $${base + 2}::uuid, $${base + 3}, $${base + 4}, $${base + 5})`,
        );
      }
      if (tuples.length === 0) continue;
      await client.query(
        `insert into quran.ayah_translations (ayah_id, translation_id, text, content_hash, dataset_version)
         values ${tuples.join(',')}
         on conflict (ayah_id, translation_id) do update set
           text = excluded.text, content_hash = excluded.content_hash,
           dataset_version = excluded.dataset_version, updated_at = now()`,
        values,
      );
      counters.imported += tuples.length;
    }
  }

  // ---------- VERIFY ----------
  const verification = await verifyEdition(client, editionId, dataset);
  counters.verified = verification.verified;
  counters.failed = verification.failed;
  errors.push(...verification.errors);

  // ---------- PUBLISH ----------
  // Publishing additionally requires an approved human verification for this
  // dataset version (migration 0004 enforces it in the database too). Without
  // one the run still succeeds, but the version stays at `verified`.
  const { rows: humanRows } = await client.query<{ count: string }>(
    `select count(*)::text as count from quran.human_verifications
     where dataset_version_id = $1 and result = 'approved'`,
    [datasetVersionId],
  );
  const humanApproved = Number(humanRows[0]?.count ?? 0) > 0;
  if (options.publish && !humanApproved) {
    errors.push(
      'HUMAN_VERIFICATION_REQUIRED: dataset stays at `verified` — record an approved human verification before publishing',
    );
  }
  const status =
    verification.failed === 0
      ? options.publish && humanApproved
        ? 'published'
        : 'verified'
      : 'failed';
  humanVerified = humanApproved;
  datasetStatus = status;
  await client.query(
    `update quran.quran_dataset_versions set status = $2, record_count = $3 where id = $1`,
    [datasetVersionId, status, dataset.ayahs.length],
  );
  await client.query(
    `insert into quran.audit_logs (actor, actor_role, action, entity, entity_id, details)
     values ('import-pipeline', 'service_role', 'dataset.import', 'quran_dataset_versions', $1, $2)`,
    [datasetVersionId, JSON.stringify({ totals, counters, version: options.version })],
  );

  return finish(verification.failed === 0 ? 'success' : 'failed');
}

/** Recomputes every stored hash from the source dataset and flips `verified`. */
export async function verifyEdition(
  client: SqlClient,
  editionId: string,
  dataset: ParsedDataset = parseDataset([]),
): Promise<{ verified: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  const expected = new Map<string, string>();
  dataset.ayahs.forEach((ayah) => {
    expected.set(`${ayah.surah_number}:${ayah.ayah_number}`, contentHash(ayah.raw_text));
  });

  const { rows } = await client.query<{
    id: string;
    surah_number: number;
    ayah_number: number;
    raw_text: string;
    content_hash: string;
  }>(
    `select a.id, s.surah_number, a.ayah_number, a.raw_text, a.content_hash
     from quran.ayahs a join quran.surahs s on s.id = a.surah_id
     where a.edition_id = $1 order by a.global_ayah_number`,
    [editionId],
  );

  const okIds: string[] = [];
  const failedIds: string[] = [];
  for (const row of rows) {
    const key = `${row.surah_number}:${row.ayah_number}`;
    const stored = contentHash(row.raw_text);
    if (stored !== row.content_hash) {
      failedIds.push(row.id);
      errors.push(`hash mismatch for ${key}: stored hash does not match stored text`);
      continue;
    }
    const sourceHash = expected.get(key);
    if (sourceHash !== undefined && sourceHash !== row.content_hash) {
      failedIds.push(row.id);
      errors.push(`hash mismatch for ${key}: stored text differs from source dataset`);
      continue;
    }
    okIds.push(row.id);
  }

  if (okIds.length > 0) {
    await client.query(
      `update quran.ayahs set verified = true, verification_status = 'verified'
       where id = any($1::uuid[])`,
      [okIds],
    );
  }
  if (failedIds.length > 0) {
    await client.query(
      `update quran.ayahs set verified = false, verification_status = 'failed'
       where id = any($1::uuid[])`,
      [failedIds],
    );
  }
  // Translations are verified the same way: recompute the hash in JS from the
  // stored text, never trusting the stored hash column.
  const { rows: translationRows } = await client.query<{ id: string; text: string; content_hash: string }>(
    `select at.id, at.text, at.content_hash from quran.ayah_translations at
     join quran.ayahs a on a.id = at.ayah_id where a.edition_id = $1`,
    [editionId],
  );
  const okTranslations: string[] = [];
  let failedTranslations = 0;
  for (const row of translationRows) {
    if (contentHash(row.text) === row.content_hash) okTranslations.push(row.id);
    else {
      failedTranslations += 1;
      if (errors.length < 20) errors.push(`translation hash mismatch (${row.id})`);
    }
  }
  for (let start = 0; start < okTranslations.length; start += 2000) {
    await client.query(
      'update quran.ayah_translations set verified = true where id = any($1::uuid[])',
      [okTranslations.slice(start, start + 2000)],
    );
  }

  return {
    verified: okIds.length + okTranslations.length,
    failed: failedIds.length + failedTranslations,
    errors: errors.slice(0, 20),
  };
}
