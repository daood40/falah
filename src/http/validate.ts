import { config } from '../config.ts';
import { badRequest } from './errors.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuidParam(value: string, field = 'id'): string {
  if (!UUID_RE.test(value)) throw badRequest(`"${field}" must be a UUID`);
  return value;
}

export function optionalUuid(q: URLSearchParams, field: string): string | null {
  const v = q.get(field);
  if (v === null || v === '') return null;
  return uuidParam(v, field);
}

export function optionalInt(q: URLSearchParams, field: string): number | null {
  const v = q.get(field);
  if (v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n)) throw badRequest(`"${field}" must be an integer`);
  return n;
}

export function optionalEnum<T extends string>(
  q: URLSearchParams,
  field: string,
  allowed: readonly T[],
): T | null {
  const v = q.get(field);
  if (v === null || v === '') return null;
  if (!(allowed as readonly string[]).includes(v)) {
    throw badRequest(`"${field}" must be one of: ${allowed.join(', ')}`);
  }
  return v as T;
}

/** Bounded text input — blunts oversized payloads and junk queries. */
export function optionalText(q: URLSearchParams, field: string, maxLen = 200): string | null {
  const v = q.get(field);
  if (v === null) return null;
  const t = v.trim();
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
  const page = rawPage === null || rawPage === '' ? 1 : Number(rawPage);
  const limit =
    rawLimit === null || rawLimit === '' ? config.pagination.defaultLimit : Number(rawLimit);

  if (!Number.isInteger(page) || page < 1) throw badRequest('"page" must be an integer >= 1');
  if (!Number.isInteger(limit) || limit < 1) throw badRequest('"limit" must be an integer >= 1');
  if (limit > config.pagination.maxLimit) {
    throw badRequest(`"limit" must be at most ${config.pagination.maxLimit}`);
  }
  return { page, limit, offset: (page - 1) * limit };
}

export function sortDirection(q: URLSearchParams): 'asc' | 'desc' {
  return optionalEnum(q, 'order', ['asc', 'desc'] as const) ?? 'asc';
}
