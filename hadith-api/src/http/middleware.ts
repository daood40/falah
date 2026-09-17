import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { config } from '../config.ts';
import { ApiError } from './errors.ts';

/**
 * A client-supplied id is echoed back in a header, so anything outside a safe
 * token charset is discarded — a CR/LF would otherwise split the response.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,64}$/;

export function requestId(req: IncomingMessage): string {
  const given = req.headers['x-request-id'];
  return typeof given === 'string' && SAFE_REQUEST_ID.test(given) ? given : randomUUID();
}

/** §27 — conservative headers; the API serves JSON only. */
export function secureHeaders(res: ServerResponse, reqId: string): void {
  res.setHeader('x-request-id', reqId);
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('cross-origin-resource-policy', 'same-site');
  res.setHeader('permissions-policy', 'geolocation=(), microphone=(), camera=()');
}

export function cors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  const allowed = config.corsOrigins;
  if (allowed.includes('*')) res.setHeader('access-control-allow-origin', '*');
  else if (origin && allowed.includes(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'Origin');
  }
  res.setHeader('access-control-allow-methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('access-control-allow-headers', 'authorization, content-type, x-request-id');
  res.setHeader('access-control-max-age', '600');
}

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(req: IncomingMessage, res: ServerResponse): void {
  const { windowMs, max } = config.rateLimit;
  const fwd = req.headers['x-forwarded-for'];
  const ip =
    (typeof fwd === 'string' ? fwd.split(',')[0]?.trim() : undefined) ||
    req.socket.remoteAddress ||
    'unknown';
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    res.setHeader('x-ratelimit-remaining', String(max - 1));
    return;
  }
  bucket.count += 1;
  res.setHeader('x-ratelimit-remaining', String(Math.max(0, max - bucket.count)));
  if (bucket.count > max) {
    res.setHeader('retry-after', String(Math.ceil((bucket.resetAt - now) / 1000)));
    throw new ApiError('RATE_LIMITED', 'Too many requests');
  }
}

/** Test-only reset so rate-limit state does not leak between suites. */
export function resetRateLimit(): void {
  buckets.clear();
}

export async function readJsonBody(req: IncomingMessage, maxBytes = 64 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > maxBytes) throw new ApiError('BAD_REQUEST', 'Request body too large');
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ApiError('BAD_REQUEST', 'Malformed JSON body');
  }
}
