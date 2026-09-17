#!/usr/bin/env node
/**
 * Writes the expectations the on-device gate run checks against.
 *
 * The values come straight from the parsed SOURCE dataset — never from the API
 * the device is about to call — so the device run compares two independent
 * paths: source → (import → database → API → network) → device.
 *
 * Output: flutter_app/assets/gate/expected_surahs.json
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseDataset } from '../src/import/parse.ts';
import { normalizeForSearch } from '../src/core/arabic.ts';

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const datasetVersion = process.argv.find((arg) => arg.startsWith('--dataset-version='))?.slice('--dataset-version='.length) ?? 'ci';
const edition = process.argv.find((arg) => arg.startsWith('--edition='))?.slice('--edition='.length) ?? null;

const dataset = parseDataset([]);

const surahs = dataset.surahs.map((surah) => {
  const ayahs = dataset.ayahs
    .filter((ayah) => ayah.surah_number === surah.surah_number)
    .sort((a, b) => a.ayah_number - b.ayah_number);
  return {
    surah_number: surah.surah_number,
    name_ar: surah.name_ar,
    ayah_count: surah.ayah_count,
    text_sha256: sha256(ayahs.map((ayah) => ayah.raw_text).join('')),
  };
});

const juzs = dataset.juzs.map((juz) => ({
  juz_number: juz.number,
  ayah_count: dataset.ayahs.filter((ayah) => ayah.juz_number === juz.number).length,
}));

const probeKeys = ['1:1', '2:255', '3:26', '18:10', '36:1', '55:13', '67:1', '112:1', '113:1', '114:6'];
const ayahProbes = probeKeys.map((key) => {
  const [surah, ayah] = key.split(':').map(Number);
  const found = dataset.ayahs.find((item) => item.surah_number === surah && item.ayah_number === ayah)!;
  return { surah, ayah, text_sha256: sha256(found.raw_text) };
});

// Search probes: real words taken from the corpus, with the number of ayahs
// that actually contain them counted here, on the source.
const normalized = dataset.ayahs.map((ayah) => normalizeForSearch(ayah.raw_text));
const searchWords = ['الله', 'الرحمن', 'الناس', 'السماوات', 'الصلاة'];
const searchProbes = searchWords.map((word) => {
  const needle = normalizeForSearch(word);
  const matches = normalized.filter((text) => text.includes(needle)).length;
  return { q: word, min_results: Math.min(matches, 1) };
});

const out = path.join(import.meta.dirname, '..', '..', 'flutter_app', 'assets', 'gate');
mkdirSync(out, { recursive: true });
const payload = {
  generated_at: new Date().toISOString(),
  source: 'parseDataset() — the source dataset, not the API',
  dataset_version: datasetVersion,
  edition,
  totals: { surahs: surahs.length, ayahs: dataset.ayahs.length },
  surahs,
  juzs,
  ayah_probes: ayahProbes,
  search_probes: searchProbes,
};
writeFileSync(path.join(out, 'expected_surahs.json'), `${JSON.stringify(payload, null, 2)}\n`);
console.log(
  `device expectations written: ${surahs.length} surahs, ${juzs.length} juz, ${ayahProbes.length} ayah probes, ${searchProbes.length} search probes`,
);
