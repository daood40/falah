/**
 * The HTTP families talk to a DEPLOYED staging instance over the network from
 * this separate process. Nothing here imports the router: if the server is not
 * actually running and reachable, the checks fail or block — they cannot
 * silently fall back to calling the code in-process.
 */
export const BASE_URL = process.env['AUDIT_BASE_URL'] ?? 'http://127.0.0.1:8799';
export const RATELIMIT_URL = process.env['AUDIT_RATELIMIT_URL'] ?? 'http://127.0.0.1:8800';

export interface HttpResult {
  status: number;
  ms: number;
  headers: Record<string, string>;
  body: string;
  json: unknown;
  error: string | null;
}

/** Never throws: a transport failure is a result with status 0 and an error. */
export async function http(
  path: string,
  init: RequestInit & { base?: string } = {},
): Promise<HttpResult> {
  const base = init.base ?? BASE_URL;
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}${path}`, { ...init, redirect: 'manual' });
    const body = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(body); } catch { json = null; }
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    return { status: res.status, ms: Date.now() - t0, headers, body, json, error: null };
  } catch (err) {
    return { status: 0, ms: Date.now() - t0, headers: {}, body: '', json: null, error: (err as Error).message };
  }
}

/** Anything that would be a leak if it ever reached a client. */
export const LEAK_PATTERNS: [string, RegExp][] = [
  ['connection string', /postgres(ql)?:\/\/[^\s"']+/i],
  ['service role key', /service_role/i],
  ['jwt secret', /jwt[_-]?secret/i],
  ['admin api key', /ADMIN_API_KEY/i],
  ['stack trace', /\n\s+at\s+[\w$.<>]+\s*\(/],
  ['sql fragment', /(select\s+.+\s+from\s+corpus\.|pg_catalog|syntax error at or near)/i],
  ['file path', /\/home\/[^\s"']+/],
  ['node internals', /node:internal/],
];

/**
 * `echoed` is input the caller sent: the API legitimately repeats a query term
 * back in meta.query, and a payload that happens to look like SQL must not be
 * counted as the service leaking its own internals.
 */
export function leaks(body: string, echoed: string[] = []): string[] {
  let text = body;
  for (const e of echoed) {
    if (!e) continue;
    text = text.split(JSON.stringify(e).slice(1, -1)).join(' ').split(e).join(' ');
  }
  return LEAK_PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
}

/** The documented envelope: success with data, or success:false with an error. */
export function envelopeProblem(res: HttpResult): string | null {
  if (res.status === 0) return `transport failure: ${res.error}`;
  if (res.status === 204) return null;
  // 413/414/431 are refused by the HTTP layer before any handler runs, so
  // there is no application envelope to produce
  if ([413, 414, 431].includes(res.status)) return null;
  if (res.json === null) return 'body is not JSON';
  const b = res.json as Record<string, unknown>;
  if (typeof b['success'] !== 'boolean') return 'missing success flag';
  if (b['success'] === true && !('data' in b)) return 'success response without data';
  if (b['success'] === false) {
    const e = b['error'] as Record<string, unknown> | undefined;
    if (!e || typeof e['code'] !== 'string' || typeof e['message'] !== 'string') {
      return 'error response without code/message';
    }
  }
  return null;
}
