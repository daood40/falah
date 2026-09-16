#!/usr/bin/env node
/**
 * PUBLIC RELEASE GATE — one place that decides whether anything may go public.
 *
 * It answers ALLOWED only when every condition below is true at the same time.
 * Any missing condition makes the release BLOCKED and names the reason. The
 * gate never flips a flag itself; it only reports what the current state is.
 *
 *   npm run release:gate            # human-readable
 *   npm run release:gate -- --json  # machine-readable, exit 1 when blocked
 */
import pg from 'pg';
import { loadEnv } from '../src/config/env.ts';

type Check = { id: string; required: boolean; ok: boolean; detail: string };

const asJson = process.argv.includes('--json');
const includeAudio = !process.argv.includes('--without-audio');
const env = loadEnv();
const checks: Check[] = [];
const add = (id: string, ok: boolean, detail: string, required = true): void => {
  checks.push({ id, required, ok, detail });
};

// ---------- 1. posture flags ----------
add('PRIVATE_MODE=false', !env.privateMode,
  env.privateMode ? 'PRIVATE_MODE is ON — everything stays internal' : 'private mode is off');
add('PUBLIC_DATA_ENABLED', env.flags.publicDataEnabled, `flag=${env.flags.publicDataEnabled}`);
add('PUBLIC_API_ENABLED', env.flags.publicApiEnabled, `flag=${env.flags.publicApiEnabled}`);
add('DATA_REDISTRIBUTION_ALLOWED', env.flags.dataRedistributionAllowed,
  `flag=${env.flags.dataRedistributionAllowed}`);
add('CONTENT_LICENSE_CONFIRMED', env.flags.contentLicenseConfirmed,
  `flag=${env.flags.contentLicenseConfirmed}`);
add('TRANSLATIONS_LICENSE_CONFIRMED', env.flags.translationsLicenseConfirmed,
  `flag=${env.flags.translationsLicenseConfirmed}`);
if (includeAudio) {
  add('AUDIO_LICENSE_CONFIRMED', env.flags.audioLicenseConfirmed,
    `flag=${env.flags.audioLicenseConfirmed} (pass --without-audio to release text only)`);
}

// ---------- 2. database state ----------
const client = new pg.Client({ connectionString: env.databaseUrl });
let datasetVersion = 'unknown';
try {
  await client.connect();

  const dataset = await client.query<{ version: string; status: string; id: string }>(
    'select id, version, status from quran.quran_dataset_versions order by import_date desc limit 1',
  );
  const current = dataset.rows[0];
  datasetVersion = current?.version ?? 'none';
  add('DATASET_EXISTS', Boolean(current), current ? `version ${current.version}` : 'no dataset imported');

  if (current) {
    const human = await client.query<{ count: string; verifier: string | null }>(
      `select count(*)::text as count, max(verifier_name) as verifier
       from quran.human_verifications
       where dataset_version_id = $1 and result = 'approved'`,
      [current.id],
    );
    const approved = Number(human.rows[0]?.count ?? 0) > 0;
    add('HUMAN_VERIFICATION=APPROVED', approved,
      approved ? `approved by ${human.rows[0]?.verifier}` : 'no approved human verification');
    add('DATASET_PUBLISHED', current.status === 'published',
      `dataset status = ${current.status}`);
  }

  // License Center: every kind that carries content must be CONFIRMED.
  const kinds = includeAudio
    ? ['quran_text', 'translation', 'qiraat', 'riwayat', 'metadata', 'audio', 'reciter']
    : ['quran_text', 'translation', 'qiraat', 'riwayat', 'metadata'];
  const gate = await client.query<{ dataset_kind: string; all_confirmed: boolean; pending: number; total: number }>(
    'select dataset_kind, all_confirmed, pending, total from quran.license_gate',
  );
  for (const kind of kinds) {
    const row = gate.rows.find((entry) => entry.dataset_kind === kind);
    if (!row || row.total === 0) {
      add(`LICENSE_CENTER:${kind}`, false, 'no licence record');
      continue;
    }
    add(`LICENSE_CENTER:${kind}`, row.all_confirmed === true,
      row.all_confirmed ? `${row.total} record(s) CONFIRMED` : `${row.pending} of ${row.total} not confirmed`);
  }

  // Integrity: nothing unverified, no hash gap.
  const integrity = await client.query<{ unverified: string; ayahs: string }>(
    `select (select count(*)::text from quran.ayahs where not verified) as unverified,
            (select count(*)::text from quran.ayahs) as ayahs`,
  );
  const unverified = Number(integrity.rows[0]?.unverified ?? 1);
  add('INTEGRITY=PASS', unverified === 0 && Number(integrity.rows[0]?.ayahs) > 0,
    `${integrity.rows[0]?.ayahs} ayahs, ${unverified} unverified`);
} catch (error) {
  add('DATABASE_REACHABLE', false, error instanceof Error ? error.message : 'connection failed');
} finally {
  await client.end().catch(() => undefined);
}

const failed = checks.filter((check) => check.required && !check.ok);
const allowed = failed.length === 0;
const verdict = allowed ? 'ALLOWED' : 'BLOCKED';

if (asJson) {
  console.log(JSON.stringify({ verdict, dataset_version: datasetVersion, checks }, null, 2));
} else {
  console.log('================ PUBLIC RELEASE GATE ================');
  console.log(`dataset version : ${datasetVersion}`);
  console.log(`audio included  : ${includeAudio}`);
  console.log('-----------------------------------------------------');
  for (const check of checks) {
    console.log(`  ${check.ok ? 'PASS   ' : 'BLOCKED'} ${check.id.padEnd(32)} ${check.detail}`);
  }
  console.log('-----------------------------------------------------');
  console.log(`PUBLIC RELEASE: ${verdict}`);
  if (!allowed) {
    console.log(`blocked by ${failed.length} condition(s): ${failed.map((c) => c.id).join(', ')}`);
  }
  console.log('=====================================================');
}

process.exitCode = allowed ? 0 : 1;
