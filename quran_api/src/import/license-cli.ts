#!/usr/bin/env node
/**
 * Records or updates a licence record. This is how the owner enters real
 * permission evidence; CONFIRMED without evidence is refused by the database.
 *
 *   npm run license:record -- --kind=translation --subject=en-saheeh \
 *     --status=CONFIRMED --redistribution=allowed --commercial=allowed \
 *     --owner="…" --license="…" --license-url=… \
 *     --evidence="email from … dated …, stored in owner_dropzone/licenses/…" \
 *     --evidence-url=… --recorded-by="اسم المالك"
 *
 *   npm run license:list
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
      `select dataset_kind, subject, status, redistribution, commercial_use,
              coalesce(license, '-') as license, recorded_by
       from quran.license_records order by dataset_kind, subject`,
    );
    for (const row of rows) {
      console.log(
        `${String(row.status).padEnd(10)} ${String(row.dataset_kind).padEnd(14)} ` +
          `${String(row.subject).padEnd(42)} redistribution=${row.redistribution} ` +
          `commercial=${row.commercial_use} by=${row.recorded_by ?? '-'}`,
      );
    }
    const { rows: gate } = await client.query('select * from quran.license_gate order by dataset_kind');
    console.log('\nsummary:');
    for (const row of gate) {
      console.log(
        `  ${String(row.dataset_kind).padEnd(14)} confirmed=${row.confirmed} pending=${row.pending} ` +
          `restricted=${row.restricted} rejected=${row.rejected} all_confirmed=${row.all_confirmed}`,
      );
    }
  } else {
    const kind = arg('kind');
    const subject = arg('subject');
    const status = (arg('status') ?? 'PENDING').toUpperCase();
    if (!kind || !subject) {
      console.error('usage: npm run license:record -- --kind=<kind> --subject=<subject> [--status=…] …');
      process.exit(2);
    }
    if (!['UNKNOWN', 'PENDING', 'RESTRICTED', 'CONFIRMED', 'REJECTED'].includes(status)) {
      console.error('--status must be UNKNOWN | PENDING | RESTRICTED | CONFIRMED | REJECTED');
      process.exit(2);
    }
    const { rows } = await client.query(
      `insert into quran.license_records (dataset_kind, subject, source_id, owner,
         copyright_holder, license, license_url, permission_reference, redistribution,
         commercial_use, modification, attribution_required, attribution_text,
         expires_at, evidence, evidence_url, status, recorded_by, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,
               coalesce($9,'unknown'), coalesce($10,'unknown'), coalesce($11,'forbidden_by_policy'),
               coalesce($12, true), $13, $14, $15, $16, $17, $18, $19)
       on conflict (dataset_kind, subject) do update set
         source_id = coalesce(excluded.source_id, quran.license_records.source_id),
         owner = coalesce(excluded.owner, quran.license_records.owner),
         copyright_holder = coalesce(excluded.copyright_holder, quran.license_records.copyright_holder),
         license = coalesce(excluded.license, quran.license_records.license),
         license_url = coalesce(excluded.license_url, quran.license_records.license_url),
         permission_reference = coalesce(excluded.permission_reference, quran.license_records.permission_reference),
         redistribution = excluded.redistribution,
         commercial_use = excluded.commercial_use,
         modification = excluded.modification,
         attribution_text = coalesce(excluded.attribution_text, quran.license_records.attribution_text),
         expires_at = coalesce(excluded.expires_at, quran.license_records.expires_at),
         evidence = coalesce(excluded.evidence, quran.license_records.evidence),
         evidence_url = coalesce(excluded.evidence_url, quran.license_records.evidence_url),
         status = excluded.status,
         recorded_by = excluded.recorded_by,
         notes = coalesce(excluded.notes, quran.license_records.notes),
         updated_at = now()
       returning dataset_kind, subject, status, redistribution, commercial_use, updated_at`,
      [
        kind, subject, arg('source') ?? null, arg('owner') ?? null,
        arg('copyright') ?? null, arg('license') ?? null, arg('license-url') ?? null,
        arg('permission') ?? null, arg('redistribution') ?? null, arg('commercial') ?? null,
        arg('modification') ?? null,
        arg('attribution-required') === undefined ? null : arg('attribution-required') === 'true',
        arg('attribution') ?? null, arg('expires') ?? null, arg('evidence') ?? null,
        arg('evidence-url') ?? null, status, arg('recorded-by') ?? 'owner', arg('notes') ?? null,
      ],
    );
    await client.query(
      `insert into quran.audit_logs (actor, actor_role, action, entity, entity_id, details)
       values ($1, 'service_role', 'license.record', 'license_records', $2, $3)`,
      [arg('recorded-by') ?? 'owner', `${kind}/${subject}`, JSON.stringify({ status })],
    );
    console.log(JSON.stringify(rows[0], null, 2));
  }
} catch (error) {
  console.error('[license] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  client.release();
  await closePool();
}
