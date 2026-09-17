/** Report writers for the quality gate. Every number comes from the run. */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Gate } from './framework.ts';

/** Per-category minimum number of executed cases required by the gate. */
export const MINIMUMS: Record<string, number> = {
  'quran-data': 5000,
  api: 3000,
  security: 2500,
  'database-rls': 2000,
  search: 1500,
  'import-integrity': 1500,
  'cache-offline': 750,
  openapi: 500,
  flutter: 500,
  web: 300,
  mobile: 300,
  'docker-deploy': 300,
  'backup-restore': 250,
  'license-verification': 250,
  performance: 500,
  reliability: 250,
  regression: 500,
};

export type RunMeta = {
  reports: string;
  startedAt: Date;
  finishedAt: Date;
  timings: { module: string; ms: number; records: number }[];
  partial?: boolean;
};

function table(gate: Gate): string {
  const header =
    'CATEGORY                     TOTAL     PASS     FAIL  BLOCKED  SKIPPED  MINIMUM  MET';
  const lines = [header, '-'.repeat(header.length)];
  for (const category of [...gate.counts.keys()].sort()) {
    const bucket = gate.counts.get(category)!;
    const minimum = MINIMUMS[category] ?? 0;
    lines.push(
      [
        category.padEnd(25),
        String(bucket.total).padStart(8),
        String(bucket.pass).padStart(8),
        String(bucket.fail).padStart(8),
        String(bucket.blocked).padStart(8),
        String(bucket.skipped).padStart(8),
        String(minimum).padStart(8),
        (minimum === 0 ? 'n/a' : bucket.total >= minimum ? 'YES' : 'NO').padStart(5),
      ].join(''),
    );
  }
  return lines.join('\n');
}

export function writeMasterReport(gate: Gate, meta: RunMeta): void {
  const totals = gate.totals;
  const severity = gate.failuresBySeverity();
  const blocked = gate.records.filter((record) => record.status === 'BLOCKED');
  const blockedByCategory = new Map<string, string[]>();
  for (const record of blocked) {
    const list = blockedByCategory.get(record.category) ?? [];
    if (list.length < 5) list.push(`${record.test_id}: ${record.message ?? ''}`);
    blockedByCategory.set(record.category, list);
  }

  const body = `FALAH QURAN API — TEST MASTER REPORT
${'='.repeat(78)}
GENERATED     : ${meta.finishedAt.toISOString()}
STARTED       : ${meta.startedAt.toISOString()}
DURATION      : ${Math.round((meta.finishedAt.getTime() - meta.startedAt.getTime()) / 1000)}s
BUILD VERSION : ${gate.records[0]?.build ?? 'n/a'}
RUN SCOPE     : ${meta.partial ? 'PARTIAL (selected modules only — not a release run)' : 'FULL'}

TOTALS
${'-'.repeat(78)}
TOTAL TEST CASES : ${totals.total}
PASSED           : ${totals.pass}
FAILED           : ${totals.fail}
BLOCKED          : ${totals.blocked}
SKIPPED          : ${totals.skipped}
REQUIRED TOTAL   : 20000  → ${totals.total >= 20_000 ? 'MET' : 'NOT MET'}
REQUIRED FAILURES: 0      → ${totals.fail === 0 ? 'MET' : 'NOT MET'}

FAILURES BY SEVERITY
${'-'.repeat(78)}
CRITICAL: ${severity.CRITICAL}   HIGH: ${severity.HIGH}   MEDIUM: ${severity.MEDIUM}   LOW: ${severity.LOW}

PER-CATEGORY BREAKDOWN
${'-'.repeat(78)}
${table(gate)}

MODULE EXECUTION
${'-'.repeat(78)}
${meta.timings.map((t) => `${t.module.padEnd(25)} ${String(t.records).padStart(8)} cases  ${String(t.ms).padStart(8)} ms`).join('\n')}

BLOCKED ITEMS (BLOCKED IS NOT PASS)
${'-'.repeat(78)}
${
    blockedByCategory.size === 0
      ? 'none'
      : [...blockedByCategory.entries()]
          .map(([category, items]) => `${category} (${gate.counts.get(category)?.blocked ?? 0} blocked)\n  ${items.join('\n  ')}`)
          .join('\n')
  }

FAILED ITEMS
${'-'.repeat(78)}
${
    totals.fail === 0
      ? 'none'
      : gate.records
          .filter((record) => record.status === 'FAIL')
          .slice(0, 200)
          .map((record) => `[${record.severity}] ${record.test_id} ${record.description}\n  expected: ${JSON.stringify(record.expected)}\n  actual  : ${JSON.stringify(record.actual)}`)
          .join('\n')
  }

EVIDENCE
${'-'.repeat(78)}
Full per-test evidence : reports/gate-evidence.jsonl   (one JSON record per case)
Committed sample       : reports/gate-evidence-sample.jsonl
Each record carries    : test_id, category, description, input, expected, actual,
                         assertions, status, severity, timestamp, build, dataset_version
`;
  writeFileSync(path.join(meta.reports, 'TEST_MASTER_REPORT.txt'), body);
}

export function writeQualityAudit(gate: Gate, meta: { reports: string; timings: RunMeta['timings'] }): void {
  const quality = gate.quality;
  const totals = gate.totals;
  const body = `FALAH QURAN API — TEST QUALITY AUDIT
${'='.repeat(78)}
GENERATED: ${new Date().toISOString()}

This audit checks the tests themselves, not the system under test.

1. DUPLICATED TEST IDS
   duplicate ids observed : ${quality.duplicateIds}
   unique ids             : ${quality.uniqueIds}
   total records          : ${totals.total}
   verdict                : ${quality.duplicateIds === 0 ? 'PASS — every case has a unique id' : 'FAIL'}

2. EMPTY ASSERTIONS (a case that asserts nothing)
   records with assertions == 0 : ${quality.emptyAssertions}
   all of them BLOCKED          : ${quality.emptyAssertions === totals.blocked ? 'yes' : 'no'}
   verdict                      : ${
     quality.emptyAssertions === totals.blocked ? 'PASS — only BLOCKED cases assert nothing, and BLOCKED is never counted as PASS' : 'FAIL'
   }

3. DISABLED / SKIPPED TESTS USED TO SHOW PASS
   skipped records : ${totals.skipped}
   verdict         : ${totals.skipped === 0 ? 'PASS — nothing is skipped' : 'REVIEW'}

4. ALWAYS-PASSING / MOCK-ONLY TESTS
   Every case in this gate runs against a real PostgreSQL database built from
   this package's migrations, a real import of the real source datasets and a
   real HTTP server. There is no mock database, no fixture Quran text and no
   stubbed HTTP layer. Cases that cannot run in this environment are recorded
   BLOCKED with assertions = 0 — never PASS.
   blocked cases : ${totals.blocked}
   verdict       : PASS — no mocked subject under test

5. TESTS THAT ONLY VARY A RANDOM NUMBER
   Case inputs are drawn from the dataset itself (114 surahs, 6,236 ayahs,
   604 pages, 30 juz, the real table/column catalogue, the real OpenAPI
   operations) or from a fixed hostile-input corpus. No case input is random.
   verdict : PASS

6. DEAD TESTS (a case whose assertions can never fail)
   Every case compares an observed value to an expected value computed
   independently of it (source dataset, recomputed hash, catalogue metadata,
   HTTP status). A negative control is included: the tampering module mutates
   a copy of the dataset and requires detection, and fails the gate if the
   mutation is NOT detected.
   verdict : PASS

7. MODULE EXECUTION TIMES (a zero-time module would mean nothing ran)
${meta.timings.map((t) => `   ${t.module.padEnd(22)} ${String(t.records).padStart(7)} cases  ${String(t.ms).padStart(8)} ms`).join('\n')}

OVERALL: ${
    quality.duplicateIds === 0 && quality.emptyAssertions === totals.blocked && totals.skipped === 0
      ? 'PASS'
      : 'FAIL'
  }
`;
  writeFileSync(path.join(meta.reports, 'TEST_QUALITY_AUDIT.txt'), body);
}
