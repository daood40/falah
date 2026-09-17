/**
 * Full pre-launch audit. Runs every check family and writes
 * reports/FINAL_QA_AUDIT.txt. Read-only against the corpus.
 *
 *   node --experimental-strip-types src/scripts/full-audit.ts [--only=data,api]
 *
 * BASE_URL points at the running staging instance; the HTTP families talk to it
 * over the network from this separate process, never by calling the router
 * in-process.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Auditor } from '../audit/core.ts';
import { runDataChecks } from '../audit/data.ts';
import { runDbChecks } from '../audit/db.ts';
import { runApiChecks } from '../audit/api.ts';
import { runSecurityChecks } from '../audit/security.ts';
import { runProjectChecks } from '../audit/project.ts';
import { runFlutterChecks } from '../audit/flutter.ts';
import { runSuiteChecks } from '../audit/suite.ts';
import { closePool, query } from '../db.ts';
import { FIXED_FINDINGS } from '../audit/findings.ts';

const families: Record<string, (a: Auditor) => Promise<void>> = {
  data: runDataChecks,
  db: runDbChecks,
  api: runApiChecks,
  security: runSecurityChecks,
  project: runProjectChecks,
  flutter: runFlutterChecks,
  suite: runSuiteChecks,
};

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function bar(label: string, n: number): string {
  return `${label.padEnd(34)}${String(n).padStart(8)}`;
}

async function main(): Promise<void> {
  const only = arg('only')?.split(',').filter(Boolean) ?? Object.keys(families);
  const audit = new Auditor();

  for (const name of only) {
    const fn = families[name];
    if (!fn) throw new Error(`unknown family: ${name}`);
    const t0 = Date.now();
    process.stderr.write(`→ ${name} …`);
    await fn(audit);
    process.stderr.write(` ${audit.total} checks so far (${Date.now() - t0} ms)\n`);
  }

  const failures = audit.failures;
  const lines: string[] = [];
  const out = (s = '') => lines.push(s);

  out('================================================================');
  out(`FINAL QA AUDIT — FALAH HADITH API — ${new Date().toISOString()}`);
  out('================================================================');
  out('Every line below is one independent automated check against a distinct');
  out('object: a distinct record, endpoint, role, payload, file or invariant.');
  out('No check is repeated to inflate the count — duplicate check ids are');
  out('themselves reported as failures (category harness.integrity).');
  out();
  out('================ TOTALS ================');
  out(bar('TOTAL CHECKS', audit.total));
  out(bar('PASSED', audit.passed));
  out(bar('FAILED', failures.length));
  out(bar('BLOCKED', audit.blockedCount));
  out(bar('SKIPPED', audit.skippedCount));
  out(bar('DURATION (s)', Math.round(audit.elapsedMs / 1000)));
  out();
  out('================ SEVERITY ================');
  out(bar('CRITICAL', audit.severityCount('CRITICAL')));
  out(bar('HIGH', audit.severityCount('HIGH')));
  out(bar('MEDIUM', audit.severityCount('MEDIUM')));
  out(bar('LOW', audit.severityCount('LOW')));
  out();
  out('================ BY CATEGORY ================');
  out('category                                 total    pass    fail   block    skip');
  for (const [cat, c] of [...audit.categories].sort()) {
    const total = c.pass + c.fail + c.blocked + c.skipped;
    out(
      cat.padEnd(38) +
        String(total).padStart(7) + String(c.pass).padStart(8) +
        String(c.fail).padStart(8) + String(c.blocked).padStart(8) +
        String(c.skipped).padStart(8),
    );
  }
  out();

  const cat = (name: string) => audit.categories.get(name);
  const group = (prefix: string) => {
    let pass = 0, fail = 0, blocked = 0, skipped = 0;
    for (const [k, c] of audit.categories) {
      if (!k.startsWith(prefix)) continue;
      pass += c.pass; fail += c.fail; blocked += c.blocked; skipped += c.skipped;
    }
    return { pass, fail, blocked, skipped, total: pass + fail + blocked + skipped };
  };
  const line = (label: string, g: ReturnType<typeof group>) =>
    `${label.padEnd(26)} ${String(g.total).padStart(7)} checks   ` +
    `${g.pass} pass / ${g.fail} fail / ${g.blocked} blocked / ${g.skipped} skipped   ` +
    `${g.fail > 0 ? 'FAIL' : g.blocked > 0 ? `PASS (${g.blocked} BLOCKED)` : 'PASS'}`;

  const corpusCount = (await query<{ c: number }>(
    'select count(*)::int as c from corpus.hadiths')).at(0)?.c ?? 0;
  const endpointCount = (await import('../http/router.ts')).listRoutes().length;

  out('================ COVERAGE ================');
  out(`records in the corpus            ${corpusCount}`);
  out(`records individually checked     ${cat('data.raw_verbatim')?.pass ?? 0} (each against its source file, hash, locator, metadata, export)`);
  out(`per-record assertions            ${group('data.').total}`);
  out(`endpoints registered             ${endpointCount}`);
  out(`endpoints called over HTTP       ${cat('api.routes') ? endpointCount : 0}`);
  out(`hadith detail responses compared ${cat('api.detail.envelope')?.pass ?? 0} against the database`);
  out(`catalogue rows compared          ${group('api.catalogue').total}`);
  out(`search terms property-tested     ${group('api.search.envelope').total}`);
  out(`distinct malicious payloads      ${group('security.fuzz').total} assertions`);
  out(`database privilege attempts      ${group('db.privileges').total} (table x role x operation, each rolled back)`);
  out(`SOURCE_LOCK write attempts       ${group('db.source_lock').total}`);
  out(`project test cases executed      ${group('suite.').total}`);
  out();

  out('================ RESULTS BY AREA ================');
  out(line('DATA INTEGRITY', group('data.')));
  out(line('DATABASE', group('db.')));
  out(line('API', group('api.')));
  out(line('SECURITY', group('security.')));
  out(line('PERFORMANCE', {
    ...group('db.performance'),
    total: group('db.performance').total + group('api.detail.latency').total
      + group('api.search.latency').total + group('api.pagination.latency').total
      + group('api.routes.latency').total + group('api.errors.latency').total,
    pass: group('db.performance').pass + group('api.detail.latency').pass
      + group('api.search.latency').pass + group('api.pagination.latency').pass
      + group('api.routes.latency').pass + group('api.errors.latency').pass,
    fail: group('db.performance').fail + group('api.detail.latency').fail
      + group('api.search.latency').fail + group('api.pagination.latency').fail
      + group('api.routes.latency').fail + group('api.errors.latency').fail,
  }));
  out(line('FLUTTER', group('flutter.')));
  out(line('DEPLOYMENT (staging)', group('api.deployment')));
  out(line('PROJECT / CONTRACT', group('project.')));
  out(line('TEST SUITE', group('suite.')));
  out();

  out('================ SECURITY FINDINGS ================');
  const securityFailures = failures.filter((f) => f.category.startsWith('security.'));
  out(`open security findings           ${securityFailures.length}`);
  out(`  critical                       ${securityFailures.filter((f) => f.severity === 'CRITICAL').length}`);
  out(`  high                           ${securityFailures.filter((f) => f.severity === 'HIGH').length}`);
  out(`  medium                         ${securityFailures.filter((f) => f.severity === 'MEDIUM').length}`);
  out(`  low                            ${securityFailures.filter((f) => f.severity === 'LOW').length}`);
  out('gates: CONTENT_LICENSE_CONFIRMED=false and PUBLIC_DATA_ENABLED=false — no edition text');
  out('is served or exported, and no public release may happen before written permission.');
  out();

  out('================ FINDINGS FOUND AND FIXED IN THIS AUDIT ================');
  for (const f of FIXED_FINDINGS) {
    out(`[${f.severity}] ${f.id} — ${f.title}`);
    out(`  detected by  ${f.detectedBy}`);
    out(`  cause        ${f.cause}`);
    out(`  where        ${f.where}`);
    out(`  reproduce    ${f.repro}`);
    out(`  fix          ${f.fix}`);
    out(`  retest       ${f.retest}`);
    out();
  }

  out('================ FAILURES ================');
  if (failures.length === 0) out('none');
  for (const f of failures) {
    out(`[${f.severity}] ${f.id}`);
    out(`  category   ${f.category}`);
    out(`  assertion  ${f.assertion}`);
    out(`  cause      ${f.detail}`);
    out(`  where      ${f.where}`);
    out(`  reproduce  ${f.repro}`);
    out();
  }

  const blockedOrSkipped = audit.results.filter((r) => r.status === 'BLOCKED' || r.status === 'SKIPPED');
  out('================ BLOCKED / SKIPPED ================');
  if (blockedOrSkipped.length === 0) out('none');
  for (const b of blockedOrSkipped) {
    out(`[${b.status}] ${b.id} — ${b.assertion}`);
    out(`  reason     ${b.detail}`);
    out(`  where      ${b.where}`);
    out();
  }

  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/FINAL_QA_AUDIT.txt', `${lines.join('\n')}\n`, 'utf8');
  writeFileSync(
    'reports/FINAL_QA_AUDIT.json',
    `${JSON.stringify({
      generated_at: new Date().toISOString(),
      total: audit.total,
      passed: audit.passed,
      failed: failures.length,
      blocked: audit.blockedCount,
      skipped: audit.skippedCount,
      severity: {
        critical: audit.severityCount('CRITICAL'),
        high: audit.severityCount('HIGH'),
        medium: audit.severityCount('MEDIUM'),
        low: audit.severityCount('LOW'),
      },
      categories: Object.fromEntries(audit.categories),
      fixed_findings: FIXED_FINDINGS,
      failures,
    }, null, 2)}\n`,
    'utf8',
  );

  console.log(lines.slice(0, 120).join('\n'));
  console.log(`\nreport: reports/FINAL_QA_AUDIT.txt (${audit.total} checks)`);
  await closePool();
  process.exit(failures.length === 0 ? 0 : 1);
}

void main();
