import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from '../core/errors.ts';

export type JwtPayload = { sub: string; role?: string; exp?: number };

function base64UrlDecode(part: string): Buffer {
  return Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * Verifies a Supabase HS256 access token. Returns the user id.
 * Only HS256 is accepted — `alg: none` and algorithm confusion are rejected.
 */
export function verifySupabaseJwt(token: string, secret: string, now = Date.now()): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new ApiError('UNAUTHORIZED', 'Invalid token');
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];

  let header: { alg?: string; typ?: string };
  let payload: JwtPayload;
  try {
    header = JSON.parse(base64UrlDecode(headerPart).toString('utf8'));
    payload = JSON.parse(base64UrlDecode(payloadPart).toString('utf8'));
  } catch {
    throw new ApiError('UNAUTHORIZED', 'Invalid token');
  }

  if (header.alg !== 'HS256') throw new ApiError('UNAUTHORIZED', 'Unsupported token algorithm');

  const expected = createHmac('sha256', secret).update(`${headerPart}.${payloadPart}`).digest();
  const provided = base64UrlDecode(signaturePart);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new ApiError('UNAUTHORIZED', 'Invalid token signature');
  }
  if (typeof payload.exp === 'number' && payload.exp * 1000 <= now) {
    throw new ApiError('UNAUTHORIZED', 'Token expired');
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new ApiError('UNAUTHORIZED', 'Token has no subject');
  }
  return payload;
}

/** Test/ops helper — signs an HS256 token the same way Supabase Auth does. */
export function signSupabaseJwt(payload: JwtPayload, secret: string): string {
  const encode = (value: object): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const head = encode({ alg: 'HS256', typ: 'JWT' });
  const body = encode(payload);
  const signature = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${signature}`;
}
