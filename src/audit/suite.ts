/**
 * Runs the project's own test suite as part of the audit and records ONE check
 * per test case, with the suite's own verdict. Nothing here re-implements the
 * tests: if vitest cannot run, that is reported, never assumed green.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import type { Auditor } from './core.ts';

const OUT = 'reports/vitest-run.json';

interface VitestReport {
  numTotalTests?: number;
  testResults?: {
    name: string;
    assertionResults: { fullName: string; title: string; status: string; failureMessages?: string[] }[];
  }[];
}

export async function runSuiteChecks(audit: Auditor): Promise<void> {
  try {
    execFileSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${OUT}`], {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: process.env['TEST_DATABASE_URL']
        ?? 'postgresql://falah:falah@127.0.0.1:5432/falah_corpus_test' },
    });
  } catch {
    // a failing suite still writes the report; only a missing report is fatal
  }

  let report: VitestReport;
  try {
    report = JSON.parse(readFileSync(OUT, 'utf8')) as VitestReport;
  } catch (err) {
    audit.blocked('suite.vitest', 'suite.unit',
      'the project test suite runs and passes',
      `vitest produced no report: ${(err as Error).message}`,
      'vitest.config.ts', 'npx vitest run');
    return;
  }

  for (const file of report.testResults ?? []) {
    const shortFile = file.name.replace(`${process.cwd()}/`, '');
    for (const t of file.assertionResults) {
      const id = `suite:${shortFile}:${t.fullName}`;
      if (t.status === 'passed') {
        audit.check(id, 'suite.unit', t.fullName, true, {
          where: shortFile, repro: `npx vitest run ${shortFile}` });
      } else if (t.status === 'pending' || t.status === 'skipped' || t.status === 'todo') {
        audit.skipped(id, 'suite.unit', t.fullName, `test ${t.status}`, shortFile,
          `npx vitest run ${shortFile}`);
      } else {
        audit.check(id, 'suite.unit', t.fullName, false, {
          severity: 'HIGH',
          detail: (t.failureMessages ?? []).join('\n').slice(0, 300),
          where: shortFile, repro: `npx vitest run ${shortFile}` });
      }
    }
  }
  rmSync(OUT, { force: true });
}
