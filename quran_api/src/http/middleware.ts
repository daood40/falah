import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Env } from '../config/env.ts';
import { ApiError } from '../core/errors.ts';
import { verifySupabaseJwt } from '../auth/jwt.ts';

export const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
  'cross-origin-resource-policy': 'same-site',
  'permissions-policy': 'geolocation=(), microphone=(), camera=()',
};

export function applyCors(req: IncomingMessage, res: ServerResponse, env: Env): void {
  const origin = req.headers.origin;
  const allowed =
    env.corsOrigins.length === 0
      ? '*'
      : origin && env.corsOrigins.includes(origin)
        ? origin
        : null;
  if (allowed) res.setHeader('access-control-allow-origin', allowed);
  res.setHeader('vary', 'Origin');
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('access-control-allow-headers', 'authorization,content-type');
  res.setHeader('access-control-max-age', '600');
}

export function applySecurityHeaders(res: ServerResponse): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);
}

/** Fixed-window in-memory limiter. Behind a shared proxy use the platform limiter too. */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private readonly windowMs: number;
  private readonly max: number;

  constructor(windowMs: number, max: number) {
    this.windowMs = windowMs;
    this.max = max;
  }

  check(key: string, now = Date.now()): { remaining: number; resetAt: number } {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.hits.set(key, { count: 1, resetAt });
      return { remaining: this.max - 1, resetAt };
    }
    entry.count += 1;
    if (entry.count > this.max) {
      throw new ApiError('RATE_LIMITED', 'Too many requests');
    }
    return { remaining: this.max - entry.count, resetAt: entry.resetAt };
  }

  reset(): void {
    this.hits.clear();
  }
}

export function authenticate(req: IncomingMessage, env: Env): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new ApiError('UNAUTHORIZED', 'Invalid authorization header');
  }
  if (!env.jwtSecret) {
    throw new ApiError('UNAUTHORIZED', 'Authentication is not configured');
  }
  return verifySupabaseJwt(token, env.jwtSecret).sub;
}

export async function readJsonBody(req: IncomingMessage, limitBytes = 16 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > limitBytes) throw new ApiError('BAD_REQUEST', 'Request body too large');
    chunks.push(buf);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ApiError('BAD_REQUEST', 'Malformed JSON body');
  }
}
