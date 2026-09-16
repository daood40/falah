import { ApiError } from './errors.ts';

export type Page = { page: number; limit: number; offset: number };

export function parsePagination(
  params: URLSearchParams,
  opts: { defaultLimit: number; maxLimit: number },
): Page {
  const page = parsePositiveInt(params.get('page'), 1, 'page');
  const limit = parsePositiveInt(params.get('limit'), opts.defaultLimit, 'limit');
  if (limit > opts.maxLimit) {
    throw new ApiError('VALIDATION_ERROR', `limit must be <= ${opts.maxLimit}`);
  }
  return { page, limit, offset: (page - 1) * limit };
}

export function parsePositiveInt(raw: string | null, fallback: number, field: string): number {
  if (raw === null || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) {
    throw new ApiError('VALIDATION_ERROR', `${field} must be a positive integer`);
  }
  const value = Number.parseInt(raw, 10);
  if (value < 1) throw new ApiError('VALIDATION_ERROR', `${field} must be >= 1`);
  return value;
}

export function pageMeta(page: Page, total: number): Record<string, unknown> {
  return {
    page: page.page,
    limit: page.limit,
    total,
    total_pages: page.limit > 0 ? Math.ceil(total / page.limit) : 0,
  };
}
