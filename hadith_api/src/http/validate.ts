import { config } from '../config.ts';
import { badRequest } from './errors.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PostgreSQL text cannot contain a NUL byte: passing one through made the
 * driver fail and the request came back as a 500. A control character in a
 * query value is a malformed request, so it is refused here.
 */
const CONTROL_RE = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(8)
  + String.fromCharCode(11) + String.fromCharCode(12)
  + String.fromCharCode(14) + '-' + String.fromCharCode(31) + ']');

export function rejectControlCharacters(value: string, field: string): string {
  if (CONTROL_RE.test(value)) throw badRequest(`"${field}" contains a control character`);
  return value;
}

export function uuidParam(value: string, field = 'id'): string {
  if (!UUID_RE.test(value)) throw badRequest(`"${field}" must be a UUID`);
  return value;
}

export function optionalUuid(q: URLSearchParams, field: string): string | null {
  const v = q.get(field);
  if (v === null || v === '') return null;
  return uuidParam(v, field);
}

/**
 * PostgreSQL integers are 32-bit. A value like 9999999999999999999 or 0x1F
 * parsed as a JavaScript number and reached the driver, which failed and
 * surfaced as a 500. Only plain decimal integers inside the int4 range are
 * accepted, and everything else is the caller's error.
 */
const INT_RE = /^-?\d{1,10}$/;
const INT4_MIN = -2147483648;
const INT4_MAX = 2147483647;

export function parseBoundedInt(raw: string, field: string): number {
  if (!INT_RE.test(raw)) throw badRequest(`"${field}" must be a decimal integer`);
  const n = Number(raw);
  if (!Number.isInteger(n) || n < INT4_MIN || n > INT4_MAX) {
    throw badRequest(`"${field}" is out of range`);
  }
  return n;
}

export function optionalInt(q: URLSearchParams, field: string): number | null {
  const v = q.get(field);
  if (v === null || v === '') return null;
  return parseBoundedInt(v, field);
}

export function optionalEnum<T extends string>(
  q: URLSearchParams,
  field: string,
  allowed: readonly T[],
): T | null {
  const v = q.get(field);
  if (v === null || v === '') return null;
  rejectControlCharacters(v, field);
  if (!(allowed as readonly string[]).includes(v)) {
    throw badRequest(`"${field}" must be one of: ${allowed.join(', ')}`);
  }
  return v as T;
}

/** Bounded text input — blunts oversized payloads and junk queries. */
export function optionalText(q: URLSearchParams, field: string, maxLen = 200): string | null {
  const v = q.get(field);
  if (v === null) return null;
  const t = rejectControlCharacters(v, field).trim();
  if (t === '') return null;
  if (t.length > maxLen) throw badRequest(`"${field}" must be at most ${maxLen} characters`);
  return t;
}

export interface Page {
  page: number;
  limit: number;
  offset: number;
}

/** §22 — limit is clamped; limit=100000 is rejected, never served. */
export function pagination(q: URLSearchParams): Page {
  const rawPage = q.get('page');
  const rawLimit = q.get('limit');
  const page = rawPage === null || rawPage === '' ? 1 : parseBoundedInt(rawPage, 'page');
  const limit =
    rawLimit === null || rawLimit === ''
      ? config.pagination.defaultLimit
      : parseBoundedInt(rawLimit, 'limit');

  if (page < 1) throw badRequest('"page" must be an integer >= 1');
  if (limit < 1) throw badRequest('"limit" must be an integer >= 1');
  if (limit > config.pagination.maxLimit) {
    throw badRequest(`"limit" must be at most ${config.pagination.maxLimit}`);
  }
  return { page, limit, offset: (page - 1) * limit };
}

export function sortDirection(q: URLSearchParams): 'asc' | 'desc' {
  return optionalEnum(q, 'order', ['asc', 'desc'] as const) ?? 'asc';
}
