/**
 * Category: import-integrity — the structural layer. Every ayah's position
 * (juz / hizb / rub / page / manzil / ruku / sajdah) is compared with the
 * source, every division row is compared with the source, and the dataset
 * version record is checked for immutability.
 */
import type { GateContext } from '../context.ts';
import type { Division } from '../../../src/import/parse.ts';

const CATEGORY = 'import-integrity';

export async function run(ctx: GateContext): Promise<void> {
  const { gate, pool, dataset } = ctx;

  const { rows: ayahRows } = await pool.query(
    `select s.surah_number, a.ayah_number, a.global_ayah_number, a.juz_number, a.hizb_number,
            a.rub_number, a.page_number, a.manzil_number, a.ruku_number, a.sajdah, a.sajdah_type,
            a.dataset_version, a.source_id, a.verification_status
       from quran.ayahs a join quran.surahs s on s.id = a.surah_id
      order by a.global_ayah_number`,
  );
  const byKey = new Map(ayahRows.map((row: any) => [`${row.surah_number}:${row.ayah_number}`, row]));

  for (const ayah of dataset.ayahs) {
    const key = `${ayah.surah_number}:${ayah.ayah_number}`;
    const row: any = byKey.get(key);
    const failures: string[] = [];
    if (!row) failures.push('missing row');
    else {
      for (const field of ['juz_number', 'hizb_number', 'rub_number', 'page_number', 'manzil_number', 'ruku_number'] as const) {
        if (row[field] !== (ayah as any)[field]) failures.push(field);
      }
      if (row.sajdah !== ayah.sajdah) failures.push('sajdah');
      if (row.sajdah_type !== null) failures.push('sajdah_type must stay NULL (ruling not in source)');
      if (row.dataset_version !== ctx.datasetVersion) failures.push('dataset_version');
    }
    gate.check(
      `II-POS-${String(ayah.global_ayah_number).padStart(4, '0')}`,
      CATEGORY,
      `ayah ${key} mushaf position imported exactly as the source records it`,
      { key, source: { juz: ayah.juz_number, hizb: ayah.hizb_number, rub: ayah.rub_number, page: ayah.page_number, manzil: ayah.manzil_number, ruku: ayah.ruku_number, sajdah: ayah.sajdah } },
      failures.length === 0,
      'all positional fields identical to source',
      failures.length === 0 ? 'identical' : `mismatch: ${failures.join(',')}`,
      'HIGH',
      8,
    );
  }

  const divisions: { prefix: string; table: string; column: string; source: Division[] }[] = [
    { prefix: 'II-JUZ', table: 'quran.juzs', column: 'juz_number', source: dataset.juzs },
    { prefix: 'II-RUB', table: 'quran.hizbs', column: 'rub_number', source: dataset.rubs },
    { prefix: 'II-PAGE', table: 'quran.pages', column: 'page_number', source: dataset.pages },
    { prefix: 'II-MANZIL', table: 'quran.manzils', column: 'manzil_number', source: dataset.manzils },
    { prefix: 'II-RUKU', table: 'quran.rukus', column: 'ruku_number', source: dataset.rukus },
  ];

  for (const division of divisions) {
    const { rows } = await pool.query(
      `select ${division.column} as number, start_surah, start_ayah, end_surah, end_ayah,
              start_global_ayah, end_global_ayah from ${division.table} order by 1`,
    );
    const rowByNumber = new Map(rows.map((row: any) => [row.number as number, row]));
    for (const item of division.source) {
      const row: any = rowByNumber.get(item.number);
      const failures: string[] = [];
      if (!row) failures.push('missing row');
      else {
        for (const field of ['start_surah', 'start_ayah', 'end_surah', 'end_ayah', 'start_global_ayah', 'end_global_ayah'] as const) {
          if (row[field] !== item[field]) failures.push(field);
        }
        const span = row.end_global_ayah - row.start_global_ayah;
        if (span < 0) failures.push('end before start');
      }
      gate.check(
        `${division.prefix}-${String(item.number).padStart(3, '0')}`,
        CATEGORY,
        `${division.table} ${item.number} boundaries match the source and are well ordered`,
        item,
        failures.length === 0,
        'boundaries identical to source, end >= start',
        failures.length === 0 ? 'identical' : `mismatch: ${failures.join(',')}`,
        'HIGH',
        7,
      );
    }
    gate.equals(
      `${division.prefix}-COUNT`,
      CATEGORY,
      `${division.table} row count equals the source`,
      division.table,
      division.source.length,
      rows.length,
      'HIGH',
    );
  }

  // Page coverage: the 604 pages must together cover 1..6236 with no gap and
  // no overlap. Checked page by page against its predecessor.
  const { rows: pageRows } = await pool.query(
    'select page_number, start_global_ayah, end_global_ayah from quran.pages order by page_number',
  );
  let previousEnd = 0;
  for (const page of pageRows as any[]) {
    const contiguous = page.start_global_ayah === previousEnd + 1;
    gate.check(
      `II-PAGE-SEQ-${String(page.page_number).padStart(3, '0')}`,
      CATEGORY,
      `page ${page.page_number} starts exactly where page ${page.page_number - 1} ended`,
      { page: page.page_number, previous_end: previousEnd, start: page.start_global_ayah },
      contiguous,
      previousEnd + 1,
      page.start_global_ayah,
      'HIGH',
      1,
    );
    previousEnd = page.end_global_ayah;
  }
  gate.equals('II-PAGE-COVER', CATEGORY, 'the last page ends at ayah 6236', 'pages.end_global_ayah', 6236, previousEnd, 'CRITICAL');

  // Per-surah: the database's own count must equal the declared ayah_count.
  const { rows: surahCounts } = await pool.query(
    `select s.surah_number, s.ayah_count, count(a.id)::int as actual
       from quran.surahs s left join quran.ayahs a on a.surah_id = s.id
      group by s.surah_number, s.ayah_count order by s.surah_number`,
  );
  for (const row of surahCounts as any[]) {
    gate.equals(
      `II-SURAH-COUNT-${String(row.surah_number).padStart(3, '0')}`,
      CATEGORY,
      `surah ${row.surah_number} holds exactly its declared number of ayahs`,
      { surah: row.surah_number, declared: row.ayah_count },
      row.ayah_count,
      row.actual,
      'CRITICAL',
    );
  }

  // Sajdah positions: every ayah flagged in the database must be flagged in the
  // source, and vice versa. Recorded per sajdah so a single drift is visible.
  const sourceSajdahs = dataset.ayahs.filter((ayah) => ayah.sajdah);
  const { rows: dbSajdahs } = await pool.query(
    `select s.surah_number, a.ayah_number from quran.ayahs a join quran.surahs s on s.id = a.surah_id
      where a.sajdah order by a.global_ayah_number`,
  );
  const dbSajdahKeys = new Set((dbSajdahs as any[]).map((row) => `${row.surah_number}:${row.ayah_number}`));
  for (const ayah of sourceSajdahs) {
    const key = `${ayah.surah_number}:${ayah.ayah_number}`;
    gate.check(
      `II-SAJDAH-${key.replace(':', '-')}`,
      CATEGORY,
      `sajdah at ${key} is flagged in the database exactly as the declared scheme records it`,
      { key, scheme: 'tanzil-hafs-15' },
      dbSajdahKeys.has(key),
      'flagged',
      dbSajdahKeys.has(key) ? 'flagged' : 'missing',
      'HIGH',
      1,
    );
  }
  gate.equals('II-SAJDAH-COUNT', CATEGORY, 'sajdah count equals the declared scheme (15 positions)', 'count(sajdah)', sourceSajdahs.length, dbSajdahs.length, 'HIGH');

  // Dataset version record.
  const { rows: versions } = await pool.query(
    'select version, source_file_hash, record_count, status from quran.quran_dataset_versions',
  );
  gate.equals('II-DSV-COUNT', CATEGORY, 'exactly one dataset version was created by this import', 'count(quran_dataset_versions)', 1, versions.length, 'HIGH');
  const version: any = versions[0] ?? {};
  gate.equals('II-DSV-NAME', CATEGORY, 'dataset version carries the requested name', 'quran_dataset_versions.version', ctx.datasetVersion, version.version ?? null, 'HIGH');
  gate.equals('II-DSV-RECORDS', CATEGORY, 'dataset version record_count equals the imported ayahs', 'record_count', 6236, version.record_count ?? null, 'HIGH');
  gate.check(
    'II-DSV-HASH',
    CATEGORY,
    'dataset version stores a sha-256 source file hash',
    version.source_file_hash ?? null,
    typeof version.source_file_hash === 'string' && /^[0-9a-f]{64}$/.test(version.source_file_hash),
    '64 hex characters',
    version.source_file_hash ?? null,
    'HIGH',
    1,
  );

  // Immutability: re-importing the same version must not silently rewrite the
  // published dataset under a different hash.
  const before = await pool.query<{ digest: string }>(
    `select md5(string_agg(content_hash, '' order by global_ayah_number)) as digest from quran.ayahs`,
  );
  await pool
    .query(
      `insert into quran.quran_dataset_versions (source_id, edition_id, version, source_file_hash, record_count)
       select source_id, edition_id, version, 'deadbeef', 1 from quran.quran_dataset_versions limit 1`,
    )
    .then(
      () => gate.check('II-DSV-UNIQUE', CATEGORY, 'a duplicate (source, edition, version) row is rejected', 'duplicate insert', false, 'unique violation', 'insert accepted', 'HIGH', 1),
      (error: any) =>
        gate.check(
          'II-DSV-UNIQUE',
          CATEGORY,
          'a duplicate (source, edition, version) row is rejected',
          'duplicate insert',
          error.code === '23505',
          'unique violation 23505',
          error.code,
          'HIGH',
          1,
        ),
    );
  const after = await pool.query<{ digest: string }>(
    `select md5(string_agg(content_hash, '' order by global_ayah_number)) as digest from quran.ayahs`,
  );
  gate.equals('II-DSV-IMMUTABLE', CATEGORY, 'the published dataset digest is unchanged after the rejected write', 'md5(all content hashes)', before.rows[0]!.digest, after.rows[0]!.digest, 'CRITICAL');
}
