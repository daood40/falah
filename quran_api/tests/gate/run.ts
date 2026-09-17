/**
 * Quality gate runner. Builds a real database, runs every category module
 * against it, and writes the evidence, the master report and the test-quality
 * audit. Exit code is non-zero when a gate rule is broken.
 */
import { createReadStream, createWriteStream, statSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { Gate } from './framework.ts';
import { buildContext, BUILD, DATASET_VERSION } from './context.ts';
import { MINIMUMS, writeMasterReport, writeQualityAudit } from './report.ts';

const MODULES = [
  'quran-data',
  'import-integrity',
  'api',
  'search',
  'security',
  'database-rls',
  'openapi',
  'cache-offline',
  'performance',
  'reliability',
  'backup-restore',
  'license-verification',
  'flutter',
  'web',
  'mobile',
  'docker-deploy',
  'regression',
];

const args = process.argv.slice(2);
const only = args.filter((arg) => !arg.startsWith('-'));
const skip = new Set(
  args
    .filter((arg) => arg.startsWith('--skip='))
    .flatMap((arg) => arg.slice('--skip='.length).split(',').map((value) => value.trim()))
    .filter(Boolean),
);
/** Names the evidence files of a partial (per-CI-job) run. */
const label = args.find((arg) => arg.startsWith('--label='))?.slice('--label='.length) ?? '';
const partial = only.length > 0 || skip.size > 0;

async function main(): Promise<void> {
  const reports = path.join(import.meta.dirname, '..', '..', 'reports');
  const gate = new Gate({
    build: BUILD,
    datasetVersion: DATASET_VERSION,
    evidencePath: path.join(reports, label ? `gate-evidence-${label}.jsonl` : 'gate-evidence.jsonl'),
    samplePath: path.join(reports, label ? `gate-evidence-${label}-sample.jsonl` : 'gate-evidence-sample.jsonl'),
  });

  const startedAt = new Date();
  const ctx = await buildContext(gate);
  const timings: { module: string; ms: number; records: number }[] = [];
  try {
    for (const name of MODULES) {
      if (only.length > 0 && !only.includes(name)) continue;
      if (skip.has(name)) continue;
      const before = gate.totals.total;
      const started = performance.now();
      const module = await import(`./modules/${name}.ts`);
      await module.run(ctx);
      timings.push({
        module: name,
        ms: Math.round(performance.now() - started),
        records: gate.totals.total - before,
      });
      const last = timings.at(-1)!;
      process.stdout.write(`${name}: ${last.records} cases in ${last.ms}ms\n`);
    }
  } finally {
    await ctx.close();
  }

  const finishedAt = new Date();
  if (!partial) {
    writeMasterReport(gate, { reports, startedAt, finishedAt, timings, partial: false });
    writeQualityAudit(gate, { reports, timings });
  }

  // The raw evidence file is large; the committed artefact is the gzip of it,
  // so every single case stays reproducible from the repository.
  const evidence = path.join(reports, label ? `gate-evidence-${label}.jsonl` : 'gate-evidence.jsonl');
  await pipeline(createReadStream(evidence), createGzip({ level: 9 }), createWriteStream(`${evidence}.gz`));
  process.stdout.write(
    `evidence: ${statSync(evidence).size} bytes raw, ${statSync(`${evidence}.gz`).size} bytes gzipped\n`,
  );

  const totals = gate.totals;
  const shortfalls = partial
    ? []
    : Object.entries(MINIMUMS).filter(([category, min]) => (gate.counts.get(category)?.total ?? 0) < min);
  process.stdout.write(
    `TOTAL=${totals.total} PASS=${totals.pass} FAIL=${totals.fail} BLOCKED=${totals.blocked} SKIPPED=${totals.skipped}\n`,
  );
  if (shortfalls.length > 0) {
    process.stdout.write(`SHORTFALL: ${shortfalls.map(([c, m]) => `${c}<${m}`).join(', ')}\n`);
  }
  if (totals.fail > 0 || shortfalls.length > 0 || (!partial && totals.total < 20_000)) {
    process.exitCode = 1;
  }
}

await main();
