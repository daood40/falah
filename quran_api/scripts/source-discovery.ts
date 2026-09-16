#!/usr/bin/env node
/**
 * Source discovery — collects metadata about candidate data sources from the
 * public npm registry (the only source network this environment can reach) and
 * records what we can actually verify.
 *
 * It downloads NOTHING but registry metadata, bypasses nothing, and never
 * concludes that a source may be redistributed. Every entry gets one of:
 *   FOUND · ACCESSIBLE · LICENSE UNKNOWN · LICENSE PENDING ·
 *   LICENSE CONFIRMED · RESTRICTED · NOT ACCESSIBLE
 */
import { writeFileSync } from 'node:fs';

const out =
  process.argv.find((a) => a.startsWith('--out='))?.slice('--out='.length) ??
  'reports/SOURCE_DISCOVERY.txt';

/** npm packages that ship Quran-related datasets. */
const CANDIDATES = [
  'quran-json', 'quran-meta', '@kmaslesa/holy-quran', 'quran', 'quranjs',
  '@quranjs/api', 'quran-db', 'tanzil', 'alquran-tools', 'quran-tafsir',
  'quran-audio', 'quranic-universal-library', '@quran/data',
];

/** Well-known websites/APIs. We record them without contacting them here. */
const WEBSITES = [
  ['King Fahd Complex (qurancomplex.gov.sa)', 'Quran text, mushaf images, translations'],
  ['Tanzil.net', 'Quran text editions + translations'],
  ["The Noble Qur'an Encyclopedia (quranenc.com)", 'Quran text + translations'],
  ['Quran.com / Quran Foundation API', 'text, translations, audio, word-by-word'],
  ['everyayah.com', 'per-ayah recitation audio'],
  ['cdn.islamic.network', 'recitation audio CDN'],
  ['api.alquran.cloud', 'text/translation/audio API'],
  ['QUL — Quranic Universal Library', 'datasets: tajweed, word-by-word, tafsir'],
];

type Entry = {
  name: string;
  status: string;
  version?: string;
  license?: string;
  repository?: string;
  description?: string;
  note?: string;
};

const entries: Entry[] = [];

for (const name of CANDIDATES) {
  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 404) {
      entries.push({ name, status: 'NOT FOUND', note: 'no such package on the registry' });
      continue;
    }
    if (!response.ok) {
      entries.push({ name, status: 'NOT ACCESSIBLE', note: `registry returned ${response.status}` });
      continue;
    }
    const doc = (await response.json()) as {
      'dist-tags'?: { latest?: string };
      versions?: Record<string, { license?: string; description?: string; repository?: unknown }>;
    };
    const latest = doc['dist-tags']?.latest ?? '';
    const meta = doc.versions?.[latest] ?? {};
    const repository =
      typeof meta.repository === 'string'
        ? meta.repository
        : (meta.repository as { url?: string } | undefined)?.url;
    // A declared SPDX string is metadata, not permission for the content inside.
    const status = meta.license ? 'FOUND · LICENSE UNKNOWN (declared only)' : 'FOUND · LICENSE UNKNOWN';
    entries.push({
      name,
      status,
      version: latest,
      license: meta.license ?? 'not declared',
      repository,
      description: (meta.description ?? '').slice(0, 110),
    });
  } catch (error) {
    entries.push({
      name,
      status: 'NOT ACCESSIBLE',
      note: error instanceof Error ? error.message : 'request failed',
    });
  }
}

const lines: string[] = [];
const say = (text = ''): number => lines.push(text);

say('================================================================');
say('FALAH QURAN API — SOURCE DISCOVERY (PRIVATE)');
say('================================================================');
say(`generated_at : ${new Date().toISOString()}`);
say('method       : public npm registry metadata only. No dataset was');
say('               downloaded, no site was scraped, no access control was');
say('               touched. A declared licence string is NOT evidence that the');
say('               Quran text or a translation inside a package may be');
say('               redistributed.');
say();

say('[1] IN USE TODAY');
say('  quran-json@3.1.2   RESTRICTED       text + 10 translations; conflicting');
say('                                      licence statements, no upstream grant');
say('  quran-meta@6.0.17  LICENSE CONFIRMED MIT (read from disk); structure only');
say();

say('[2] NPM CANDIDATES (metadata only)');
for (const entry of entries) {
  say(`  ${entry.name}`);
  say(`    status      : ${entry.status}`);
  if (entry.version) say(`    version     : ${entry.version}`);
  if (entry.license) say(`    declared    : ${entry.license}`);
  if (entry.repository) say(`    repository  : ${entry.repository}`);
  if (entry.description) say(`    description : ${entry.description}`);
  if (entry.note) say(`    note        : ${entry.note}`);
}
say();

say('[3] WEBSITES / APIs — NOT CONTACTED FROM THIS ENVIRONMENT');
say('    (this sandbox rejects outbound connections to them; and reachability');
say('     would not be permission anyway)');
for (const [name, what] of WEBSITES) {
  say(`  ${name}`);
  say(`    provides    : ${what}`);
  say('    status      : NOT ACCESSIBLE here · LICENSE UNKNOWN');
  say('    owner action: request written permission, then place the dataset in');
  say('                  owner_dropzone/ and record the evidence in the License Center');
}
say();

say('[4] RULE');
say('  FOUND / ACCESSIBLE / declared-licence are technical facts.');
say('  Only a documented grant moves a source to LICENSE CONFIRMED, and only');
say('  the owner can obtain that grant.');
say('================================================================');

const text = `${lines.join('\n')}\n`;
writeFileSync(out, text);
console.log(text);
