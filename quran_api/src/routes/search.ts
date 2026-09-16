import { normalizeDigits } from '../core/arabic.ts';
import { ApiError } from '../core/errors.ts';
import { pageMeta, parsePagination } from '../core/pagination.ts';
import type { Ctx, Route } from '../http/router.ts';
import { resolveEdition } from '../repositories/editions.ts';
import { searchAyahs } from '../repositories/search.ts';
import { serializeAyah } from '../repositories/serializers.ts';

function optionalInt(ctx: Ctx, field: string, min: number, max: number): number | undefined {
  const raw = ctx.query.get(field);
  if (raw === null || raw === '') return undefined;
  const normalized = normalizeDigits(raw);
  if (!/^\d+$/.test(normalized)) {
    throw new ApiError('VALIDATION_ERROR', `${field} must be an integer`);
  }
  const value = Number.parseInt(normalized, 10);
  if (value < min || value > max) {
    throw new ApiError('VALIDATION_ERROR', `${field} must be between ${min} and ${max}`);
  }
  return value;
}

export const searchRoutes: Route[] = [
  {
    method: 'GET',
    path: '/api/v1/search',
    licensed: true,
    handler: async (ctx) => {
      const q = (ctx.query.get('q') ?? '').trim();
      if (q.length === 0) throw new ApiError('VALIDATION_ERROR', 'q is required');
      if (q.length > 200) throw new ApiError('VALIDATION_ERROR', 'q must be <= 200 characters');
      const page = parsePagination(ctx.query, {
        defaultLimit: ctx.env.defaultPageLimit,
        maxLimit: ctx.env.maxPageLimit,
      });
      const ed = await resolveEdition(ctx.client, ctx.query.get('edition'));
      const { rows, total } = await searchAyahs(ctx.client, {
        editionId: ed.id,
        q,
        surah: optionalInt(ctx, 'surah', 1, 114),
        ayah: optionalInt(ctx, 'ayah', 1, 286),
        juz: optionalInt(ctx, 'juz', 1, 30),
        hizb: optionalInt(ctx, 'hizb', 1, 60),
        page: optionalInt(ctx, 'page_number', 1, 9999),
        riwayah: ctx.query.get('riwayah') ?? undefined,
        qiraah: ctx.query.get('qiraah') ?? undefined,
        language: ctx.query.get('language') ?? undefined,
        exact: ctx.query.get('exact') === 'true',
        limit: page.limit,
        offset: page.offset,
      });
      return {
        data: rows.map((row) => ({ ...serializeAyah(row, ed), rank: row.rank })),
        meta: { ...pageMeta(page, total), query: q, edition: ed.slug },
      };
    },
  },
];
