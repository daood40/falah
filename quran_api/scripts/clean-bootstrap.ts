#!/usr/bin/env node
/**
 * Clean-database bootstrap check.
 *
 * Proves the service can stand up from nothing:
 *   empty database → migrations → import → validation → API start →
 *   health → data queries → integrity check
 *
 * It creates its own throwaway database, uses only files inside quran_api/,
 * and drops the database afterwards. Any failed step exits non-zero.
 */
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';
import { createApp } from '../src/app.ts';
import { loadEnv } from '../src/config/env.ts';
import { runImport } from '../src/import/pipeline.ts';
import { contentHash } from '../src/core/hash.ts';

const adminUrl = process.env.DATABASE_URL;
if (!adminUrl) {
  console.error('DATABASE_URL is required (it is used to create a throwaway database)');
  process.exit(2);
}
const dbName = process.env.BOOTSTRAP_DB ?? `falah_bootstrap_${Date.now()}`;
const testUrl = adminUrl.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
const steps: { step: string; ok: boolean; detail: string }[] = [];
const record = (step: string, ok: boolean, detail: string): void => {
  steps.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step.padEnd(28)} ${detail}`);
};

const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
await admin.query(`drop database if exists ${dbName} with (force)`);
await admin.query(`create database ${dbName}`);
record('empty database', true, dbName);

let client: pg.Client | null = null;
try {
  // --- migrations, run exactly the way an operator would ---
  execFileSync(process.execPath, [path.join(import.meta.dirname, 'apply-migrations.ts')], {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'pipe',
  });
  client = new pg.Client({ connectionString: testUrl });
  await client.connect();
  const { rows: tables } = await client.query<{ count: string }>(
    `select count(*)::text as count from information_schema.tables
     where table_schema = 'quran' and table_type = 'BASE TABLE'`,
  );
  record('migrations', Number(tables[0]!.count) > 0, `${tables[0]!.count} tables in schema quran`);

  // --- validation before any write ---
  await client.query('begin');
  const dryRun = await runImport(client, {
    mode: 'validate-only',
    version: 'bootstrap',
    languages: ['en'],
    publish: false,
  });
  await client.query('rollback');
  record('validation', dryRun.status === 'success', `${dryRun.issues.length} issue(s)`);

  // --- import ---
  await client.query('begin');
  const report = await runImport(client, {
    mode: 'import',
    version: 'bootstrap-1',
    languages: ['en'],
    publish: true,
  });
  await client.query('commit');
  record(
    'data import',
    report.status === 'success' && report.counters.failed === 0,
    `${report.counters.imported} records, ${report.counters.failed} failed, status=${report.dataset_status}`,
  );

  // --- API start on an ephemeral port ---
  const env = { ...loadEnv({ ...process.env, PRIVATE_MODE: 'true' }), databaseUrl: testUrl };
  const pool = new pg.Pool({ connectionString: testUrl, max: 3 });
  const app = createApp(env, pool);
  const server = createServer((request, response) => void app.handler(request, response));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  const base = `http://127.0.0.1:${port}`;
  record('api start', true, `listening on ${base} (private mode)`);

  const health = (await (await fetch(`${base}/api/v1/health`)).json()) as {
    data?: { status?: string; checks?: { database?: string } };
  };
  record('health check', health.data?.checks?.database === 'ok', `status=${health.data?.status}`);

  const version = (await (await fetch(`${base}/api/v1/version`)).json()) as {
    data?: { dataset?: { version?: string }; integrity_status?: string };
  };
  record(
    'version endpoint',
    version.data?.dataset?.version === 'bootstrap-1',
    `dataset=${version.data?.dataset?.version} integrity=${version.data?.integrity_status}`,
  );

  // Content is private, so an anonymous query must be refused, and the same
  // query must work for the service itself against the database.
  const surahs = await fetch(`${base}/api/v1/surahs`);
  record('private mode enforced', surahs.status === 451, `anonymous /surahs → ${surahs.status}`);

  const { rows: counts } = await client.query<{
    surahs: string; ayahs: string; pages: string; juzs: string;
  }>(`select (select count(*)::text from quran.surahs) as surahs,
             (select count(*)::text from quran.ayahs) as ayahs,
             (select count(*)::text from quran.pages) as pages,
             (select count(*)::text from quran.juzs) as juzs`);
  const expected = counts[0]!.surahs === '114' && counts[0]!.ayahs === '6236' &&
    counts[0]!.pages === '604' && counts[0]!.juzs === '30';
  record(
    'data queries',
    expected,
    `${counts[0]!.surahs} surahs, ${counts[0]!.ayahs} ayahs, ${counts[0]!.pages} pages, ${counts[0]!.juzs} juz`,
  );

  // --- integrity: recompute every hash from the freshly imported rows ---
  const { rows: ayahRows } = await client.query<{ raw_text: string; content_hash: string }>(
    'select raw_text, content_hash from quran.ayahs',
  );
  const mismatches = ayahRows.filter((row) => contentHash(row.raw_text) !== row.content_hash).length;
  record('integrity check', mismatches === 0 && ayahRows.length === 6236,
    `${ayahRows.length} ayahs, ${mismatches} hash mismatches`);

  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
} finally {
  if (client) await client.end().catch(() => undefined);
  if (!process.argv.includes('--keep')) {
    await admin.query(`drop database if exists ${dbName} with (force)`);
  }
  await admin.end();
}

const failed = steps.filter((step) => !step.ok);
console.log(
  failed.length === 0
    ? `\nCLEAN BOOTSTRAP: PASS (${steps.length} steps)`
    : `\nCLEAN BOOTSTRAP: FAIL — ${failed.map((step) => step.step).join(', ')}`,
);
process.exitCode = failed.length === 0 ? 0 : 1;
