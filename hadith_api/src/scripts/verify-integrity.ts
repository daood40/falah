import { closePool, query } from '../db.ts';
import { CHECKS } from './integrity-checks.ts';

async function main(): Promise<void> {
  let failed = 0;
  let warned = 0;
  console.log('============ DATA INTEGRITY REPORT ============');
  for (const check of CHECKS) {
    const rows = await query(check.sql);
    if (rows.length === 0) {
      console.log(`PASS  ${check.name}`);
    } else if (check.level === 'warn') {
      warned++;
      console.log(`WARN  ${check.name} (${rows.length} rows to review)`);
    } else {
      failed++;
      console.log(`FAIL  ${check.name} (${rows.length} offending rows)`);
    }
  }

  const counts = await query<Record<string, number>>('select * from corpus.stats_view');
  const verification = await query('select * from corpus.verification_status_view order by dataset_version');
  console.log('-----------------------------------------------');
  console.log('counts:      ' + JSON.stringify(counts[0] ?? {}));
  console.log('verification:' + JSON.stringify(verification));
  console.log('===============================================');
  console.log(
    failed === 0
      ? `RESULT: PASS${warned ? ` (${warned} warning(s) — nothing was deleted)` : ''}`
      : `RESULT: FAIL (${failed} check(s))`,
  );
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(`integrity check failed: ${(err as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => void closePool());
