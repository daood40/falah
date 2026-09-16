import type { AddressInfo } from 'node:net';
import { createServer, type Server } from 'node:http';
import pg from 'pg';
import { createApp } from '../src/app.ts';
import { loadEnv, type Env } from '../src/config/env.ts';
import { signSupabaseJwt } from '../src/auth/jwt.ts';

export const TEST_JWT_SECRET = 'test-secret-for-falah-quran-api-tests';

export function testUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL missing — global setup did not run');
  return url;
}

export function testEnv(overrides: Partial<Env> = {}): Env {
  // Tests run as an internal instance with private mode off so the public
  // paths are exercised; the licence flags they need are set explicitly.
  const base = loadEnv({
    ...process.env,
    ENVIRONMENT: 'test',
    SUPABASE_JWT_SECRET: TEST_JWT_SECRET,
    PRIVATE_MODE: 'false',
    PUBLIC_DATA_ENABLED: 'true',
    CONTENT_LICENSE_CONFIRMED: 'true',
    DATA_REDISTRIBUTION_ALLOWED: 'true',
    RATE_LIMIT_MAX: '10000',
  });
  const merged = { ...base, databaseUrl: testUrl(), ...overrides };
  // Mirror loadEnv(): private mode forces every public switch off, so a test
  // that flips `privateMode` gets the same posture the server would have.
  return merged.privateMode
    ? {
        ...merged,
        flags: {
          ...merged.flags,
          publicDataEnabled: false,
          publicApiEnabled: false,
          dataRedistributionAllowed: false,
        },
      }
    : merged;
}

export type Harness = {
  baseUrl: string;
  pool: pg.Pool;
  close: () => Promise<void>;
  request: (path: string, init?: RequestInit & { token?: string }) => Promise<{ status: number; body: any; headers: Headers }>;
};

export async function startHarness(env: Env = testEnv()): Promise<Harness> {
  const pool = new pg.Pool({ connectionString: env.databaseUrl, max: 5 });
  const app = createApp(env, pool);
  const server: Server = createServer((req, res) => void app.handler(req, res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    pool,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await pool.end();
    },
    request: async (path, init = {}) => {
      const { token, headers, ...rest } = init as RequestInit & { token?: string };
      const response = await fetch(`${baseUrl}${path}`, {
        ...rest,
        headers: {
          ...(headers as Record<string, string> | undefined),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      });
      const text = await response.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      return { status: response.status, body, headers: response.headers };
    },
  };
}

export async function createTestUser(pool: pg.Pool): Promise<{ id: string; token: string }> {
  const { rows } = await pool.query<{ id: string }>(
    'insert into auth.users default values returning id',
  );
  const id = rows[0]!.id;
  return {
    id,
    token: signSupabaseJwt({ sub: id, role: 'authenticated' }, TEST_JWT_SECRET),
  };
}
