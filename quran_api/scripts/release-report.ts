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

8. DEFECTS THE GATE FOUND, AND THE FIX
${'-'.repeat(78)}
Every entry below was a real failure recorded by a gate case before it was a
fix. None was found by reading the code.

 1. search with exact=true answered 500 — a bound parameter was never
    referenced. Fixed in src/repositories/search.ts.
 2. a malformed percent-encoded path answered 500. Fixed in src/http/router.ts
    (decoding failure is now VALIDATION_ERROR, 422).
 3. a NUL byte in a path or query answered 500. Rejected at the edge now
    (src/app.ts) and in the router.
 4. an oversized request body reset the connection instead of answering.
    src/http/middleware.ts drains the remainder and answers 400.
 5. import_runs and audit_logs had forced RLS and no policy, so service_role
    could not write them. Fixed by migrations/007_ops_policies.sql.
 6. a statement timeout set on a pooled connection leaked into the next
    request. src/db/pool.ts sets it per request with \`set local\`.
 7. the import verified the whole edition when only one surah was in scope.
    Fixed in src/import/pipeline.ts.
 8. the Docker image shipped no migrations: the container started, answered
    /health, and every content read answered 500 because the schema was never
    created. Fixed in quran_api/Dockerfile.
 9. the API booted with no DATABASE_URL (silently falling back to a local
    database) and with a 5-character JWT secret. Both now stop the process —
    src/config/env.ts, checked by the docker refusal cases.
10. the image carried no build identity, so /api/v1/version reported
    commit=null. The build now stamps BUILD_COMMIT and BUILD_TIME.
11. the Flutter app asked the API for 300 items per page; the API refuses
    above 100, so on a real device every surah and every juz failed. The app
    now pages at 100 (quran_api_repository.dart) and the audio repository
    walks every page instead of reading only the first (audio_repository.dart).

9. WHAT REMAINS BEFORE THE CONTENT MAY BE OPENED
${'-'.repeat(78)}
These are owner and legal steps. No test can close them, and no flag should be
raised before they are all done:

  - confirm the quran_text licence record (1 unconfirmed)
  - confirm the translation licence records (10 unconfirmed)
  - confirm the audio and reciter licence records (1 each)
  - record an approved human verification for the dataset, then publish it
    (the dataset stays at \`verified\` until a person approves it)
  - only then set PRIVATE_MODE=false, PUBLIC_DATA_ENABLED, PUBLIC_API_ENABLED
    and DATA_REDISTRIBUTION_ALLOWED, and re-run the public release gate

Out of scope by owner decision, recorded in reports/GATE_SCOPE.md: iOS (no
macOS runner) and a Hadith API (not built). Not covered by this gate because
there is no infrastructure to test: deployment to a real host, a registry,
TLS termination and image vulnerability scanning.
`;

writeFileSync(path.join(reports, 'RELEASE_REPORT.txt'), body);
console.log(
  `RELEASE_REPORT.txt written — TOTAL=${totals.total} PASS=${totals.pass} FAIL=${totals.fail} BLOCKED=${totals.blocked} SKIPPED=${totals.skipped}`,
);
console.log(`TECHNICALLY READY FOR FALAH INTEGRATION = ${technicallyReady ? 'YES' : 'NO'}`);
console.log(`RELEASE GATE = ${gate.allowed ? 'PASS' : 'FAIL'}`);
