#!/usr/bin/env node
import { loadEnv } from '../config/env.ts';
import { closePool, getPool } from '../db/pool.ts';
import { runImport, type ImportMode } from './pipeline.ts';
import { TRANSLATIONS } from './registry.ts';
import { writeFileSync } from 'node:fs';

function parseArgs(argv: string[]): {
  mode: ImportMode;
  version: string;
  languages: string[];
  publish: boolean;
  out: string | null;
} {
  const get = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  };
  const mode: ImportMode = argv.includes('--validate-only')
    ? 'validate-only'
    : argv.includes('--dry-run')
      ? 'dry-run'
      : 'import';
  const languages = (get('translations') ?? 'en')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);
  const unknown = languages.filter((code) => !TRANSLATIONS.some((t) => t.language === code));
  if (unknown.length > 0) {
    throw new Error(`unknown translation language(s): ${unknown.join(', ')}`);
  }
  return {
    mode,
    version: get('version') ?? loadEnv().datasetVersion,
    languages,
    publish: argv.includes('--publish'),
    out: get('report') ?? null,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const db = getPool(env.databaseUrl);
  const client = await db.connect();
  try {
    await client.query('begin');
    const report = await runImport(client, options);
    if (options.mode === 'import' && report.status === 'success') {
      await client.query('commit');
    } else {
      await client.query('rollback');
    }
    const json = JSON.stringify(report, null, 2);
    if (options.out) writeFileSync(options.out, `${json}\n`);
    console.log(json);
    process.exitCode = report.status === 'success' ? 0 : 1;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('[import] failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    client.release();
    await closePool();
  }
}

await main();
