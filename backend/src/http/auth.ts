import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { config } from '../config.ts';
import { ApiError } from './errors.ts';

export interface Principal {
  id: string;
  role: 'admin' | 'service';
  via: 'jwt' | 'api_key';
}

function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** HS256 verification against the Supabase JWT secret. */
export function verifyJwt(token: string, secret: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new ApiError('UNAUTHORIZED', 'Invalid token');
  const [header, payload, signature] = parts as [string, string, string];

  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest();
  const given = b64urlToBuf(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw new ApiError('UNAUTHORIZED', 'Invalid token');
  }

  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(b64urlToBuf(payload).toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new ApiError('UNAUTHORIZED', 'Invalid token');
  }
  const alg = JSON.parse(b64urlToBuf(header).toString('utf8')).alg as string;
  if (alg !== 'HS256') throw new ApiError('UNAUTHORIZED', 'Unsupported token algorithm');

  const exp = claims['exp'];
  if (typeof exp === 'number' && exp * 1000 < Date.now()) {
    throw new ApiError('UNAUTHORIZED', 'Token expired');
  }
  return claims;
}

function bearer(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme?.toLowerCase() !== 'bearer') return null;
  return value;
}

/**
 * Admin API guard (§28). Accepts either a service key (server-to-server, e.g.
 * CI importer) or a Supabase JWT carrying app_metadata.corpus_role = 'admin'.
 */
export function requireAdmin(req: IncomingMessage): Principal {
  const token = bearer(req);
  if (!token) throw new ApiError('UNAUTHORIZED', 'Authorization required');

  if (config.adminApiKey && safeEqual(token, config.adminApiKey)) {
    return { id: 'service-key', role: 'service', via: 'api_key' };
  }

  if (!config.supabaseJwtSecret) throw new ApiError('UNAUTHORIZED', 'Invalid credentials');
  const claims = verifyJwt(token, config.supabaseJwtSecret);
  const meta = (claims['app_metadata'] ?? {}) as Record<string, unknown>;
  if (meta['corpus_role'] !== 'admin') {
    throw new ApiError('FORBIDDEN', 'Admin role required');
  }
  return { id: String(claims['sub'] ?? 'unknown'), role: 'admin', via: 'jwt' };
}
