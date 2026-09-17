import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env['RATE_LIMIT_MAX'] = '5';
process.env['RATE_LIMIT_WINDOW_MS'] = '60000';

const { startApi } = await import('./helpers.ts');
const { closePool } = await import('../src/db.ts');
const { resetRateLimit } = await import('../src/http/middleware.ts');

type TestApi = Awaited<ReturnType<typeof startApi>>;
let api: TestApi;

beforeAll(async () => {
  resetRateLimit();
  api = await startApi();
});
afterAll(async () => {
  await api.close();
  await closePool();
});

describe('rate limiting (§27)', () => {
  it('serves up to the limit then answers 429 with Retry-After', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await api.get('/api/v1/health')).status);
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses[5]).toBe(429);

    const res = await fetch(`${api.base}/api/v1/health`);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
    const body = await res.json();
    expect(body).toMatchObject({ success: false, error: { code: 'RATE_LIMITED' } });
  });
});
