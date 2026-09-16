#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { loadEnv } from '../config/env.ts';
import { closePool, getPool } from '../db/pool.ts';
import { importAudioManifest, type AudioManifest } from './audio.ts';

const argv = process.argv.slice(2);
const manifestPath = argv.find((arg) => !arg.startsWith('--'));
if (!manifestPath) {
  console.error('usage: npm run import:audio -- <manifest.json> [--dry-run] [--no-network]');
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as AudioManifest;
const env = loadEnv();
const db = getPool(env.databaseUrl);
const client = await db.connect();
try {
  await client.query('begin');
  const report = await importAudioManifest(client, manifest, {
    mode: argv.includes('--dry-run') ? 'dry-run' : 'import',
    network: !argv.includes('--no-network'),
    datasetVersion: env.datasetVersion,
  });
  if (report.mode === 'import') await client.query('commit');
  else await client.query('rollback');
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.totals.failed > 0 ? 1 : 0;
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  console.error('[audio-import] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  client.release();
  await closePool();
}
