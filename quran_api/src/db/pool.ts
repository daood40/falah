import pg from 'pg';
import { loadEnv } from '../config/env.ts';

const { Pool } = pg;

export type Db = pg.Pool;

let pool: Db | null = null;

export function getPool(connectionString = loadEnv().databaseUrl): Db {
  pool ??= new Pool({
    connectionString,
    max: Number.parseInt(process.env.DB_POOL_MAX ?? '10', 10),
    idleTimeoutMillis: 30_000,
    statement_timeout: 10_000,
  });
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    const current = pool;
    pool = null;
    await current.end();
  }
}

/**
 * Runs `fn` inside a transaction with the Supabase-compatible role and JWT
 * claims applied, so every statement is subject to Row Level Security.
 * `anon` for unauthenticated traffic, `authenticated` + claims for a user.
 */
export async function withRls<T>(
  db: Db,
  userId: string | null,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('begin');
    // A pooled connection can carry session state left behind by whatever ran
    // on it last (a stray `set statement_timeout`, for instance). Every request
    // therefore pins its own limits for the duration of its transaction.
    await client.query("set local statement_timeout = '10s'");
    await client.query("set local idle_in_transaction_session_timeout = '15s'");
    if (userId) {
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ]);
      await client.query('select set_config($1, $2, true)', ['request.jwt.claim.sub', userId]);
      await client.query('set local role authenticated');
    } else {
      await client.query('set local role anon');
    }
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
