#!/usr/bin/env node
/**
 * Applies this package's own migrations (migrations/*.sql) in order to
 * DATABASE_URL. The API is standalone: it needs no file from outside this
 * directory. Pass file names to apply a subset.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const dir = path.join(import.meta.dirname, '..', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  for (const file of files) {
    if (only.length > 0 && !only.includes(file)) continue;
    process.stdout.write(`applying ${file} ... `);
    await client.query(readFileSync(path.join(dir, file), 'utf8'));
    console.log('ok');
  }
} finally {
  await client.end();
}
