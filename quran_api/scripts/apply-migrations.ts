#!/usr/bin/env node
/** Applies supabase/migrations/*.sql in order to DATABASE_URL (plain Postgres or Supabase). */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const dir = path.join(import.meta.dirname, '..', '..', 'supabase', 'migrations');
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
