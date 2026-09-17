/**
 * Live context for the quality gate: a real Postgres database built from this
 * package's own migrations, a real import of the real source datasets, and a
 * real HTTP server serving the real API. Nothing here is mocked.
 */
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import pg from 'pg';
import { createApp } from '../../src/app.ts';
import { loadEnv, type Env } from '../../src/config/env.ts';
import { signSupabaseJwt } from '../../src/auth/jwt.ts';
import { parseDataset, type ParsedDataset } from '../../src/import/parse.ts';
import { runImport } from '../../src/import/pipeline.ts';
import { API_RELEASE } from '../../src/routes/meta.ts';
import { Gate } from './framework.ts';

export const MIGRATIONS = [
  '001_quran_platform.sql',
  '002_human_verification.sql',
  '003_license_center.sql',
  '004_data_catalog.sql',
  '005_data_schemes.sql',
  '006_data_catalog_v2.sql',
  '007_ops_policies.sql',
];

export const GATE_JWT_SECRET = 'gate-secret-for-falah-quran-api-quality-gate';
export const GATE_DB = process.env.GATE_DB_NAME ?? 'falah_quran_gate';
export const DATASET_VERSION = 'gate-1';

export type HttpResult = { status: number; body: any; headers: Headers; ms: number };

export type GateContext = {
  gate: Gate;
  pool: pg.Pool;
  adminUrl: string;
  databaseUrl: string;
  baseUrl: string;
  datasetVersion: string;
  env: Env;
  dataset: ParsedDataset;
  user: { id: string; token: string };
  otherUser: { id: string; token: string };
  request: (path: string, init?: RequestInit & { token?: string }) => Promise<HttpResult>;
  close: () => Promise<void>;
};

export function gateEnv(databaseUrl: string): Env {
  return {
    ...loadEnv({
      ...process.env,
      ENVIRONMENT: 'test',
      SUPABASE_JWT_SECRET: GATE_JWT_SECRET,
      PRIVATE_MODE: 'false',
      PUBLIC_DATA_ENABLED: 'true',
      CONTENT_LICENSE_CONFIRMED: 'true',
      DATA_REDISTRIBUTION_ALLOWED: 'true',
      RATE_LIMIT_MAX: '1000000',
    }),
    databaseUrl,
  };
}

export async function applyMigrations(client: pg.Client): Promise<void> {
  const dir = path.join(import.meta.dirname, '..', '..', 'migrations');
  for (const file of MIGRATIONS) {
    await client.query(readFileSync(path.join(dir, file), 'utf8'));
  }
}

export async function buildContext(gate: Gate): Promise<GateContext> {
  const adminUrl = process.env.DATABASE_URL ?? 'postgresql://postgres@localhost:5432/postgres';
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${GATE_DB} with (force)`);
  await admin.query(`create database ${GATE_DB}`);
  await admin.end();

  const databaseUrl = adminUrl.replace(/\/postgres(\?|$)/, `/${GATE_DB}$1`);
  const setup = new pg.Client({ connectionString: databaseUrl });
  await setup.connect();
  await applyMigrations(setup);
  await setup.query('begin');
  const report = await runImport(setup, {
    mode: 'import',
    version: DATASET_VERSION,
    languages: ['en'],
    publish: true,
  });
  if (report.status !== 'success') {
    throw new Error(`gate dataset import failed: ${report.errors.join('; ')}`);
  }
  await setup.query('commit');
  await setup.end();

  const env = gateEnv(databaseUrl);
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 8 });
  const app = createApp(env, pool);
  const server: Server = createServer((req, res) => void app.handler(req, res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const makeUser = async () => {
    const { rows } = await pool.query<{ id: string }>('insert into auth.users default values returning id');
    const id = rows[0]!.id;
    return { id, token: signSupabaseJwt({ sub: id, role: 'authenticated' }, GATE_JWT_SECRET) };
  };

  const request = async (target: string, init: RequestInit & { token?: string } = {}): Promise<HttpResult> => {
    const { token, headers, ...rest } = init;
    const started = performance.now();
    const response = await fetch(`${baseUrl}${target}`, {
      ...rest,
      headers: {
        ...(headers as Record<string, string> | undefined),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    const text = await response.text();
    const ms = performance.now() - started;
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: response.status, body, headers: response.headers, ms };
  };

  return {
    gate,
    pool,
    adminUrl,
    databaseUrl,
    baseUrl,
    datasetVersion: DATASET_VERSION,
    env,
    dataset: parseDataset(['en']),
    user: await makeUser(),
    otherUser: await makeUser(),
    request,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await pool.end();
    },
  };
}

export const BUILD = API_RELEASE;
