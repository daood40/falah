#!/usr/bin/env node
/**
 * Records a human verification for a dataset version — the only way a version
 * can reach `published` (migration 0004 enforces it in the database).
 *
 * Usage:
 *   npm run verify:human -- --version=2026.09.16-1 --verifier="اسم المراجع" \
 *     --role="مراجع شرعي" --scope="عينة 200 آية + السجدات + حدود الأجزاء" \
 *     --sample=200 --result=approved [--notes="..."] [--evidence=URL]
 */
import { loadEnv } from '../config/env.ts';
import { closePool, getPool } from '../db/pool.ts';

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
};

const version = arg('version');
const verifier = arg('verifier');
const scope = arg('scope');
const sample = Number.parseInt(arg('sample') ?? '', 10);
const result = arg('result') ?? 'approved';

if (!version || !verifier || !scope || !Number.isInteger(sample) || sample < 1) {
  console.error(
    'usage: npm run verify:human -- --version=<dataset version> --verifier=<name> ' +
      '--scope=<what was reviewed> --sample=<count> [--role=] [--result=approved|rejected|needs_changes] ' +
      '[--notes=] [--evidence=URL]',
  );
  process.exit(2);
}
if (!['approved', 'rejected', 'needs_changes'].includes(result)) {
  console.error('--result must be approved, rejected or needs_changes');
  process.exit(2);
}

const env = loadEnv();
const db = getPool(env.databaseUrl);
const client = await db.connect();
try {
  const { rows } = await client.query<{ id: string; status: string }>(
    'select id, status from quran.quran_dataset_versions where version = $1 order by import_date desc limit 1',
    [version],
  );
  const dataset = rows[0];
  if (!dataset) {
    console.error(`no dataset version named ${version}`);
    process.exitCode = 1;
  } else {
    await client.query('begin');
    const inserted = await client.query(
      `insert into quran.human_verifications
         (dataset_version_id, verifier_name, verifier_role, scope, sample_count, result, notes, evidence_url)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning id, verified_at`,
      [dataset.id, verifier, arg('role') ?? null, scope, sample, result, arg('notes') ?? null, arg('evidence') ?? null],
    );
    if (result === 'approved') {
      await client.query(
        `update quran.quran_dataset_versions set status = 'published' where id = $1 and status = 'verified'`,
        [dataset.id],
      );
    }
    await client.query(
      `insert into quran.audit_logs (actor, actor_role, action, entity, entity_id, details)
       values ($1, 'service_role', 'dataset.human_verification', 'quran_dataset_versions', $2, $3)`,
      [verifier, dataset.id, JSON.stringify({ result, scope, sample_count: sample })],
    );
    await client.query('commit');
    const after = await client.query<{ status: string }>(
      'select status from quran.quran_dataset_versions where id = $1',
      [dataset.id],
    );
    console.log(
      JSON.stringify(
        {
          dataset_version: version,
          verification_id: inserted.rows[0]?.id,
          verified_at: inserted.rows[0]?.verified_at,
          result,
          dataset_status: after.rows[0]?.status,
        },
        null,
        2,
      ),
    );
  }
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  console.error('[verify:human] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  client.release();
  await closePool();
}
