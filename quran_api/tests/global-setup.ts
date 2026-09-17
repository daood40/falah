import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { runImport } from '../src/import/pipeline.ts';

/** This package's own migrations — nothing outside quran_api/ is needed. */
const MIGRATIONS = [
  '001_quran_platform.sql',
  '002_human_verification.sql',
  '003_license_center.sql',
  '004_data_catalog.sql',
];
const TEST_DB = process.env.TEST_DB_NAME ?? 'falah_quran_test';

/**
 * Builds a real Postgres database for the test run: applies every migration in
 * order, then runs the real import pipeline against the real source datasets.
 * No mocked database, no fixture Quran text.
 */
export default async function setup(): Promise<() => Promise<void>> {
  const adminUrl = process.env.DATABASE_URL ?? 'postgresql://postgres@localhost:5432/postgres';
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB} with (force)`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const testUrl = adminUrl.replace(/\/postgres(\?|$)/, `/${TEST_DB}$1`);
  process.env.TEST_DATABASE_URL = testUrl;

  const client = new pg.Client({ connectionString: testUrl });
  await client.connect();
  const migrationsDir = path.join(import.meta.dirname, '..', 'migrations');
  for (const file of MIGRATIONS) {
    await client.query(readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
  await client.query('begin');
  const report = await runImport(client, {
    mode: 'import',
    version: 'test-1',
    languages: ['en'],
    publish: true,
  });
  if (report.status !== 'success') {
    throw new Error(`test dataset import failed: ${report.errors.join('; ')}`);
  }
  await client.query('commit');
  await client.end();

  return async () => {
    const cleanup = new pg.Client({ connectionString: adminUrl });
    await cleanup.connect();
    await cleanup.query(`drop database if exists ${TEST_DB} with (force)`);
    await cleanup.end();
  };
}
