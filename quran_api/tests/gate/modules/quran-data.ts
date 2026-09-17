/**
 * Category: quran-data — every one of the 114 surahs and all 6,236 ayahs are
 * compared row by row between the parsed source and the imported database,
 * with the content hash recomputed from the stored text.
 */
import { contentHash } from '../../../src/core/hash.ts';
import { normalizeForSearch, searchSkeleton } from '../../../src/core/arabic.ts';
import type { GateContext } from '../context.ts';

const CATEGORY = 'quran-data';

export async function run(ctx: GateContext): Promise<void> {
  const { gate, pool, dataset } = ctx;

  const { rows: surahRows } = await pool.query(
    `select surah_number, name_ar, name_en, name_transliteration, revelation_place,
            revelation_order, ayah_count, bismillah, verified, dataset_version
       from quran.surahs order by surah_number`,
  );
  const surahByNumber = new Map(surahRows.map((row: any) => [row.surah_number as number, row]));

  for (const surah of dataset.surahs) {
    const row: any = surahByNumber.get(surah.surah_number);
    const failures: string[] = [];
    if (!row) failures.push('missing row');
    else {
      if (row.name_ar !== surah.name_ar) failures.push('name_ar');
      if (row.name_en !== surah.name_en) failures.push('name_en');
      if (row.name_transliteration !== surah.name_transliteration) failures.push('name_transliteration');
      if (row.revelation_place !== surah.revelation_place) failures.push('revelation_place');
      if (row.revelation_order !== surah.revelation_order) failures.push('revelation_order');
      if (row.ayah_count !== surah.ayah_count) failures.push('ayah_count');
      if (row.bismillah !== null) failures.push('bismillah must stay NULL (not in source)');
    }
    gate.check(
      `QD-SURAH-${String(surah.surah_number).padStart(3, '0')}`,
      CATEGORY,
      `surah ${surah.surah_number} metadata: source === database`,
      { surah: surah.surah_number, source: surah },
      failures.length === 0,
      'every metadata field identical to the parsed source',
      failures.length === 0 ? 'identical' : `mismatch: ${failures.join(',')}`,
      'CRITICAL',
      7,
    );
  }

  const { rows: ayahRows } = await pool.query(
    `select s.surah_number, a.ayah_number, a.global_ayah_number, a.raw_text, a.text_uthmani,
            a.text_simple, a.search_text, a.search_skeleton, a.content_hash, a.source_locked,
            a.juz_number, a.hizb_number, a.rub_number, a.page_number, a.manzil_number,
            a.ruku_number, a.sajdah, a.sajdah_type
       from quran.ayahs a join quran.surahs s on s.id = a.surah_id
      order by a.global_ayah_number`,
  );
  const ayahByKey = new Map(
    ayahRows.map((row: any) => [`${row.surah_number}:${row.ayah_number}`, row]),
  );

  for (const ayah of dataset.ayahs) {
    const key = `${ayah.surah_number}:${ayah.ayah_number}`;
    const row: any = ayahByKey.get(key);
    const failures: string[] = [];
    if (!row) failures.push('missing row');
    else {
      if (row.raw_text !== ayah.raw_text) failures.push('raw_text differs from source');
      if (row.text_uthmani !== ayah.text_uthmani) failures.push('text_uthmani');
      if (row.content_hash !== ayah.content_hash) failures.push('stored hash differs from source hash');
      if (row.content_hash !== contentHash(row.raw_text)) failures.push('hash does not match stored text');
      if (row.global_ayah_number !== ayah.global_ayah_number) failures.push('global_ayah_number');
      if (row.search_text !== normalizeForSearch(row.raw_text)) failures.push('search_text not derived');
      if (row.search_skeleton !== searchSkeleton(row.raw_text)) failures.push('search_skeleton not derived');
      if (row.source_locked !== true) failures.push('source_locked');
      if (typeof row.raw_text !== 'string' || row.raw_text.length === 0) failures.push('empty text');
    }
    gate.check(
      `QD-AYAH-${String(ayah.global_ayah_number).padStart(4, '0')}`,
      CATEGORY,
      `ayah ${key} multi-layer integrity: source → import → database → hash`,
      { key, global: ayah.global_ayah_number, source_hash: ayah.content_hash },
      failures.length === 0,
      'stored text byte-identical to source and hash recomputes',
      failures.length === 0 ? 'identical + hash verified' : `mismatch: ${failures.join(',')}`,
      'CRITICAL',
      9,
    );
  }

  // Dataset-wide totals, asserted against the fixed, well-known structure of
  // the Hafs mushaf — not against our own output.
  gate.equals('QD-TOTAL-SURAHS', CATEGORY, 'database holds exactly 114 surahs', 'count(surahs)', 114, surahRows.length, 'CRITICAL');
  gate.equals('QD-TOTAL-AYAHS', CATEGORY, 'database holds exactly 6236 ayahs', 'count(ayahs)', 6236, ayahRows.length, 'CRITICAL');
  gate.equals('QD-SOURCE-AYAHS', CATEGORY, 'parsed source holds exactly 6236 ayahs', 'parseDataset().ayahs', 6236, dataset.ayahs.length, 'CRITICAL');
  gate.equals(
    'QD-AYAH-SUM',
    CATEGORY,
    'sum of surah ayah_count equals 6236',
    'sum(surahs.ayah_count)',
    6236,
    surahRows.reduce((sum: number, row: any) => sum + row.ayah_count, 0),
    'CRITICAL',
  );
  const contiguous = ayahRows.every((row: any, index: number) => row.global_ayah_number === index + 1);
  gate.check('QD-GLOBAL-CONTIGUOUS', CATEGORY, 'global ayah numbering is 1..6236 with no gap', 'global_ayah_number sequence', contiguous, '1..6236', contiguous ? '1..6236' : 'gap detected', 'CRITICAL', 6236);
  const uniqueHashes = new Set(ayahRows.map((row: any) => row.content_hash)).size;
  gate.check('QD-HASH-CARDINALITY', CATEGORY, 'content hashes distinguish distinct ayah texts', 'distinct(content_hash)', uniqueHashes === new Set(dataset.ayahs.map((a) => a.content_hash)).size, 'same cardinality as source', uniqueHashes, 'HIGH', 1);
}
