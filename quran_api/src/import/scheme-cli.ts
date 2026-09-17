#!/usr/bin/env node
/**
 * Records the owner's decision on a data scheme (sajdah, page numbering, …).
 *
 *   npm run scheme:list
 *   npm run scheme:decide -- --kind=sajdah --code=tanzil-hafs-15 \
 *     --decided-by="اسم المالك" --notes="..."
 *
 * The database refuses CONFIRMED without a named person. Choosing a scheme that
 * differs from what is stored does NOT rewrite data: it requires a new dataset
 * version built from a source that uses that scheme.
 */
import { loadEnv } from '../config/env.ts';
import { closePool, getPool } from '../db/pool.ts';

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
};

const env = loadEnv();
const db = getPool(env.databaseUrl);
const client = await db.connect();

try {
  if (argv.includes('--list') || argv.length === 0) {
    const { rows } = await client.query(
      `select scheme_kind, scheme_code, scheme_version, decision_status, decided_by,
              observed_summary, alternatives
       from quran.data_schemes order by scheme_kind`,
    );
    for (const row of rows) {
      console.log(
        `${String(row.decision_status).padEnd(10)} ${String(row.scheme_kind).padEnd(8)} ` +
          `${row.scheme_code}@${row.scheme_version} by=${row.decided_by ?? '-'}`,
      );
      console.log(`  observed     : ${JSON.stringify(row.observed_summary).slice(0, 160)}`);
      for (const alternative of row.alternatives as Record<string, unknown>[]) {
        console.log(`  alternative  : ${JSON.stringify(alternative).slice(0, 160)}`);
      }
    }
  } else {
    const kind = arg('kind');
    const code = arg('code');
    const decidedBy = arg('decided-by');
    if (!kind || !code || !decidedBy) {
      console.error(
        'usage: npm run scheme:decide -- --kind=<sajdah|page|...> --code=<scheme code> --decided-by=<name> [--notes=]',
      );
      process.exit(2);
    }
    const { rows } = await client.query<{ scheme_code: string; id: string }>(
      'select id, scheme_code from quran.data_schemes where scheme_kind = $1',
      [kind],
    );
    if (rows.length === 0) {
      console.error(`no scheme recorded for kind "${kind}" — run an import first`);
      process.exitCode = 1;
    } else if (!rows.some((row) => row.scheme_code === code)) {
      console.error(
        `the stored data follows "${rows[0]!.scheme_code}", not "${code}". ` +
          'Switching scheme means importing a NEW dataset version from a source that uses it — ' +
          'stored Quran data is never rewritten to match a decision.',
      );
      process.exitCode = 1;
    } else {
      await client.query('begin');
      const updated = await client.query(
        `update quran.data_schemes
         set decision_status = 'CONFIRMED', decided_by = $3, decided_at = now(),
             notes = coalesce($4, notes)
         where scheme_kind = $1 and scheme_code = $2
         returning scheme_kind, scheme_code, scheme_version, decision_status, decided_by, decided_at`,
        [kind, code, decidedBy, arg('notes') ?? null],
      );
      await client.query(
        `insert into quran.audit_logs (actor, actor_role, action, entity, entity_id, details)
         values ($1, 'service_role', 'scheme.decision', 'data_schemes', $2, $3)`,
        [decidedBy, `${kind}/${code}`, JSON.stringify({ decision: 'CONFIRMED' })],
      );
      await client.query('commit');
      console.log(JSON.stringify(updated.rows[0], null, 2));
    }
  }
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  console.error('[scheme] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  client.release();
  await closePool();
}
