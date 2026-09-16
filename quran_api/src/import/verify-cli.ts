#!/usr/bin/env node
import { loadEnv } from '../config/env.ts';
import { closePool, getPool } from '../db/pool.ts';
import { verifyEdition } from './pipeline.ts';
import { parseDataset } from './parse.ts';

const slug = process.argv[2];
const env = loadEnv();
const db = getPool(env.databaseUrl);
const client = await db.connect();
try {
  const { rows } = await client.query<{ id: string; slug: string }>(
    slug
      ? 'select id, slug from quran.quran_editions where slug = $1'
      : `select id, slug from quran.quran_editions where edition_type = 'quran'`,
    slug ? [slug] : [],
  );
  if (rows.length === 0) {
    console.error('[verify] no edition found');
    process.exitCode = 1;
  } else {
    const dataset = parseDataset([]);
    for (const edition of rows) {
      const result = await verifyEdition(client, edition.id, dataset);
      console.log(JSON.stringify({ edition: edition.slug, ...result }, null, 2));
      if (result.failed > 0) process.exitCode = 1;
    }
  }
} finally {
  client.release();
  await closePool();
}
