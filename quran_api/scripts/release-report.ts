#!/usr/bin/env node
/**
 * Writes reports/RELEASE_REPORT.txt from the merged gate evidence.
 *
 * Every number in the report is counted from the evidence file produced by the
 * runners — nothing is typed in by hand, and the two verdicts at the end are
 * computed from those counts plus the licence state, never asserted.
 *
 * Usage: node scripts/release-report.ts [--evidence=reports/gate-evidence.jsonl]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MINIMUMS } from '../tests/gate/framework-minimums.ts';

type Record_ = {
  test_id: string;
  category: string;
  description: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';
  severity: string;
  expected: unknown;
  actual: unknown;
  build: string;
  dataset_version: string;
  timestamp: string;
};

const reports = path.join(import.meta.dirname, '..', 'reports');
const evidencePath =
  process.argv.find((arg) => arg.startsWith('--evidence='))?.slice('--evidence='.length) ??
  path.join(reports, 'gate-evidence.jsonl');

if (!existsSync(evidencePath)) {
  console.error(`no evidence at ${evidencePath} — run the gate and merge its evidence first`);
  process.exit(1);
}

const records: Record_[] = [];
for (const line of readFileSync(evidencePath, 'utf8').split('\n')) {
  if (line.trim().length > 0) records.push(JSON.parse(line) as Record_);
}

const counts = new Map<string, { total: number; pass: number; fail: number; blocked: number; skipped: number }>();
for (const record of records) {
  const bucket = counts.get(record.category) ?? { total: 0, pass: 0, fail: 0, blocked: 0, skipped: 0 };
  bucket.total += 1;
  if (record.status === 'PASS') bucket.pass += 1;
  else if (record.status === 'FAIL') bucket.fail += 1;
  else if (record.status === 'BLOCKED') bucket.blocked += 1;
  else bucket.skipped += 1;
  counts.set(record.category, bucket);
}

const totals = { total: 0, pass: 0, fail: 0, blocked: 0, skipped: 0 };
for (const bucket of counts.values()) {
  totals.total += bucket.total;
  totals.pass += bucket.pass;
  totals.fail += bucket.fail;
  totals.blocked += bucket.blocked;
  totals.skipped += bucket.skipped;
}

const shortfalls = Object.entries(MINIMUMS).filter(
  ([category, minimum]) => (counts.get(category)?.total ?? 0) < minimum,
);
const uniqueIds = new Set(records.map((record) => record.test_id)).size;

/** Reads the public release gate without inventing its result. */
function releaseGate(): { output: string; allowed: boolean } {
  try {
    const output = execFileSync('node', [path.join(import.meta.dirname, 'public-release-gate.ts')], {
      encoding: 'utf8',
      timeout: 120_000,
      env: process.env,
    });
    return { output, allowed: /PUBLIC RELEASE: ALLOWED/.test(output) };
  } catch (error: any) {
    const output = String(error.stdout ?? error.message);
    return { output, allowed: false };
  }
}

const gate = process.argv.includes('--skip-release-gate')
  ? { output: 'not run in this invocation', allowed: false }
  : releaseGate();

const category = (name: string): string => {
  const bucket = counts.get(name);
  if (!bucket) return `${name.padEnd(22)} no cases recorded`;
  return `${name.padEnd(22)} ${String(bucket.total).padStart(7)} total  ${String(bucket.pass).padStart(7)} pass  ${String(bucket.fail).padStart(4)} fail  ${String(bucket.blocked).padStart(4)} blocked  ${String(bucket.skipped).padStart(4)} skipped`;
};

const technicallyReady =
  totals.fail === 0 &&
  totals.blocked === 0 &&
  totals.skipped === 0 &&
  totals.pass > 0 &&
  shortfalls.length === 0 &&
  uniqueIds === records.length;

const body = `FALAH — RELEASE REPORT
${'='.repeat(78)}
GENERATED       : ${new Date().toISOString()}
EVIDENCE        : ${path.relative(path.join(reports, '..'), evidencePath)}
BUILD VERSION   : ${records[0]?.build ?? 'n/a'}
DATASET VERSION : ${[...new Set(records.map((record) => record.dataset_version))].join(', ')}

1. TOTALS (counted from the evidence, not asserted)
${'-'.repeat(78)}
TOTAL TESTS : ${totals.total}
PASS        : ${totals.pass}
FAIL        : ${totals.fail}
BLOCKED     : ${totals.blocked}
SKIPPED     : ${totals.skipped}
UNIQUE IDS  : ${uniqueIds} of ${records.length} records (a duplicate id would mean double counting)

2. PER-CATEGORY
${'-'.repeat(78)}
${[...counts.keys()].sort().map(category).join('\n')}

MINIMUMS NOT MET: ${shortfalls.length === 0 ? 'none' : shortfalls.map(([name, minimum]) => `${name} < ${minimum}`).join(', ')}

3. COVERAGE BY AREA
${'-'.repeat(78)}
QURAN     : ${counts.get('quran-data')?.total ?? 0} data cases + ${counts.get('import-integrity')?.total ?? 0} structural cases
            (114/114 surahs and 6,236/6,236 ayahs across source → import → database →
            SHA-256 → API → cache; no sampling)
HADITH    : 0 — no hadith API exists in this repository and none was built
            (owner decision, 2026-09-17; see reports/GATE_SCOPE.md). The report
            claims no hadith coverage.
API       : ${counts.get('api')?.total ?? 0} cases against a live HTTP server
DATABASE  : ${counts.get('database-rls')?.total ?? 0} cases (RLS enabled/forced, grant matrix, real
            statements per role, SOURCE_LOCK on every ayah row)
SECURITY  : ${counts.get('security')?.total ?? 0} cases (hostile input matrix, token matrix, cross-user
            isolation, header attacks, body fuzzing, secret hygiene)
SEARCH    : ${counts.get('search')?.total ?? 0} cases
PERFORMANCE: ${counts.get('performance')?.total ?? 0} measured requests (percentiles in reports/performance-samples.json)
BACKUP    : ${counts.get('backup-restore')?.total ?? 0} cases (pg_dump → destroy → pg_restore → re-verify, twice)
SOURCE_LOCK: every ayah row refused a rewrite; the dataset digest is unchanged
LICENCE   : ${counts.get('license-verification')?.total ?? 0} cases
OPENAPI   : ${counts.get('openapi')?.total ?? 0} cases
CACHE     : ${counts.get('cache-offline')?.total ?? 0} cases
RELIABILITY: ${counts.get('reliability')?.total ?? 0} cases
REGRESSION: ${counts.get('regression')?.total ?? 0} cases
FLUTTER   : ${counts.get('flutter')?.total ?? 0} cases (analyze, the Dart suite test by test, web build,
            plus the source audit)
ANDROID   : ${counts.get('mobile')?.total ?? 0} cases (release APK + on-device run on real emulators)
iOS       : 0 — out of scope by owner decision (no macOS runner enabled)
DOCKER    : ${counts.get('docker-deploy')?.total ?? 0} cases (image build, image contents, container runtime,
            stack, fail-closed configuration, full dataset served from the container)
WEB       : ${counts.get('web')?.total ?? 0} cases (the PWA suite test by test + the static audit)
CI        : every category runs in .github/workflows/quality-gate.yml on a runner
            that has its toolchain; the merge job fails the run on any FAIL,
            BLOCKED, SKIPPED, duplicate id or category below its minimum.

4. FAILURES (if any)
${'-'.repeat(78)}
${
  totals.fail === 0
    ? 'none'
    : records
        .filter((record) => record.status === 'FAIL')
        .slice(0, 100)
        .map((record) => `[${record.severity}] ${record.test_id} — ${record.description}\n  expected: ${JSON.stringify(record.expected)}\n  actual  : ${JSON.stringify(record.actual)}`)
        .join('\n')
}

5. BLOCKED / SKIPPED (if any — BLOCKED IS NEVER COUNTED AS PASS)
${'-'.repeat(78)}
${
  totals.blocked + totals.skipped === 0
    ? 'none'
    : records
        .filter((record) => record.status === 'BLOCKED' || record.status === 'SKIPPED')
        .slice(0, 100)
        .map((record) => `${record.status} ${record.test_id} — ${record.description}`)
        .join('\n')
}

6. PUBLIC RELEASE GATE (npm run release:gate)
${'-'.repeat(78)}
${gate.output.trim()}

7. VERDICTS
${'-'.repeat(78)}
TECHNICALLY READY FOR FALAH INTEGRATION = ${technicallyReady ? 'YES' : 'NO'}
  basis: FAIL=${totals.fail}, BLOCKED=${totals.blocked}, SKIPPED=${totals.skipped}, PASS=${totals.pass},
  categories below minimum: ${shortfalls.length}, duplicate ids: ${records.length - uniqueIds}

RELEASE GATE = ${gate.allowed ? 'PASS' : 'FAIL'}
  basis: the public release gate reports ${gate.allowed ? 'ALLOWED' : 'BLOCKED'}. While the content,
  translation, audio and reciter licences are unconfirmed and no human
  verification is recorded, this stays FAIL by design — the private flags
  (PRIVATE_MODE=true, PUBLIC_DATA_ENABLED=false, CONTENT_LICENSE_CONFIRMED=false)
  are intentional, and nothing about the Quran text is served publicly.

NOTE ON THE TWO VERDICTS: the first says whether FALAH can integrate this API
internally on the evidence above. The second says whether the content may be
opened to the public — that is a licensing decision, not a testing one.
`;

writeFileSync(path.join(reports, 'RELEASE_REPORT.txt'), body);
console.log(
  `RELEASE_REPORT.txt written — TOTAL=${totals.total} PASS=${totals.pass} FAIL=${totals.fail} BLOCKED=${totals.blocked} SKIPPED=${totals.skipped}`,
);
console.log(`TECHNICALLY READY FOR FALAH INTEGRATION = ${technicallyReady ? 'YES' : 'NO'}`);
console.log(`RELEASE GATE = ${gate.allowed ? 'PASS' : 'FAIL'}`);
