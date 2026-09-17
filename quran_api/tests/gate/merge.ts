#!/usr/bin/env node
/**
 * Merges the evidence produced by every gate runner into one release result.
 *
 * The gate no longer runs in a single place: the core modules run next to a
 * PostgreSQL service, the web module where the PWA's dependencies are
 * installed, the Docker module on a host with a daemon, and the Flutter and
 * Android modules on a runner with those SDKs. Each writes JSONL evidence in
 * the same record shape; this script reads all of it, rebuilds the totals and
 * writes the master report and the test-quality audit.
 *
 * Usage: node tests/gate/merge.ts <evidence-dir> [more dirs...]
 */
import { createReadStream, createWriteStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { Gate, type TestRecord } from './framework.ts';
import { MINIMUMS, writeMasterReport, writeQualityAudit } from './report.ts';

const reports = path.join(import.meta.dirname, '..', '..', 'reports');
const dirs = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
if (dirs.length === 0) dirs.push(path.join(reports, 'evidence'));

function collect(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (full.endsWith('.jsonl') && !full.endsWith('-sample.jsonl')) out.push(full);
  }
  return out;
}

const files = dirs.flatMap((dir) => collect(dir)).sort();
if (files.length === 0) {
  console.error(`no evidence files found in: ${dirs.join(', ')}`);
  process.exit(1);
}

const gate = new Gate({
  build: 'merged',
  datasetVersion: 'merged',
  evidencePath: path.join(reports, 'gate-evidence.jsonl'),
  samplePath: path.join(reports, 'gate-evidence-sample.jsonl'),
});

const sources: { file: string; records: number; categories: string[] }[] = [];
for (const file of files) {
  const categories = new Set<string>();
  let count = 0;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.trim().length === 0) continue;
    const record = JSON.parse(line) as TestRecord;
    gate.ingest(record);
    categories.add(record.category);
    count += 1;
  }
  sources.push({ file: path.relative(reports, file), records: count, categories: [...categories].sort() });
}

const timings = sources.map((source) => ({
  module: path.basename(source.file, '.jsonl'),
  ms: 0,
  records: source.records,
}));

const now = new Date();
writeMasterReport(gate, { reports, startedAt: now, finishedAt: now, timings, partial: false });
writeQualityAudit(gate, { reports, timings });

writeFileSync(
  path.join(reports, 'gate-evidence-sources.json'),
  `${JSON.stringify({ merged_at: now.toISOString(), sources }, null, 2)}\n`,
);

await pipeline(
  createReadStream(path.join(reports, 'gate-evidence.jsonl')),
  createGzip({ level: 9 }),
  createWriteStream(path.join(reports, 'gate-evidence.jsonl.gz')),
);

const totals = gate.totals;
const shortfalls = Object.entries(MINIMUMS).filter(
  ([category, minimum]) => (gate.counts.get(category)?.total ?? 0) < minimum,
);

console.log(`merged ${files.length} evidence file(s)`);
for (const source of sources) {
  console.log(`  ${source.file}: ${source.records} cases [${source.categories.join(', ')}]`);
}
console.log(
  `TOTAL=${totals.total} PASS=${totals.pass} FAIL=${totals.fail} BLOCKED=${totals.blocked} SKIPPED=${totals.skipped}`,
);
if (shortfalls.length > 0) {
  console.log(`SHORTFALL: ${shortfalls.map(([category, minimum]) => `${category}<${minimum}`).join(', ')}`);
}
if (gate.quality.duplicateIds > 0) {
  console.log(`DUPLICATE TEST IDS: ${gate.quality.duplicateIds}`);
}

// A release merge must be clean: no failure, no blocked case, no skip, every
// category minimum met, and no duplicate id (which would mean double counting).
const strict = process.argv.includes('--release');
if (
  totals.fail > 0 ||
  shortfalls.length > 0 ||
  gate.quality.duplicateIds > 0 ||
  (strict && (totals.blocked > 0 || totals.skipped > 0)) ||
  totals.total < 20_000
) {
  process.exitCode = 1;
}
