import { ApiError } from '../core/errors.ts';
import { pageMeta, parsePagination, parsePositiveInt } from '../core/pagination.ts';
import type { Ctx, Route } from '../http/router.ts';
import { resolveEdition } from '../repositories/editions.ts';
import {
  findHizb,
  findJuz,
  findManzil,
  findPage,
  findRub,
  findRuku,
  findSurah,
  listJuzs,
  listHizbs,
  listManzils,
  listPages,
  listRubs,
  listRukus,
  listSurahs,
  queryAyahs,
  surahStructure,
  type SurahFilter,
} from '../repositories/quran.ts';
import { serializeAyah } from '../repositories/serializers.ts';

async function edition(ctx: Ctx) {
  return resolveEdition(ctx.client, ctx.query.get('edition'));
}

async function translationId(ctx: Ctx): Promise<string | null> {
  const ref = ctx.query.get('translation');
  if (!ref) return null;
  const { rows } = await ctx.client.query<{ id: string }>(
    `select id from quran.translations where ${/^[0-9a-f-]{36}$/i.test(ref) ? 'id = $1::uuid' : 'slug = $1'}`,
    [ref],
  );
  const row = rows[0];
  if (!row) throw ApiError.notFound('Translation not found');
  return row.id;
}

function paging(ctx: Ctx) {
  return parsePagination(ctx.query, {
    defaultLimit: ctx.env.defaultPageLimit,
    maxLimit: ctx.env.maxPageLimit,
  });
}

function requireNumber(raw: string, field: string, min: number, max: number): number {
  if (!/^\d+$/.test(raw)) throw new ApiError('VALIDATION_ERROR', `${field} must be an integer`);
  const value = Number.parseInt(raw, 10);
  if (value < min || value > max) {
    throw new ApiError('VALIDATION_ERROR', `${field} must be between ${min} and ${max}`);
  }
  return value;
}

/** `?revelation=makkah|madinah` and `?sort=number|revelation_order` on the surah list. */
function surahFilter(ctx: Ctx): SurahFilter {
  const filter: SurahFilter = {};
  const revelation = ctx.query.get('revelation');
  if (revelation) {
    if (revelation !== 'makkah' && revelation !== 'madinah') {
      throw new ApiError('VALIDATION_ERROR', 'revelation must be makkah or madinah');
    }
    filter.revelationPlace = revelation;
  }
  const sort = ctx.query.get('sort');
  if (sort) {
    if (sort !== 'number' && sort !== 'revelation_order') {
      throw new ApiError('VALIDATION_ERROR', 'sort must be number or revelation_order');
    }
    filter.sort = sort;
  }
  return filter;
}

async function ayahRange(ctx: Ctx, where: string, params: unknown[]) {
  const ed = await edition(ctx);
  const page = paging(ctx);
  const { rows, total } = await queryAyahs(ctx.client, {
    editionId: ed.id,
    where,
    params,
    limit: page.limit,
    offset: page.offset,
    translationId: await translationId(ctx),
  });
  return {
    data: rows.map((row) => serializeAyah(row, ed)),
    meta: { ...pageMeta(page, total), edition: ed.slug },
  };
}

export const quranRoutes: Route[] = [
  {
    method: 'GET',
    path: '/api/v1/surahs',
    licensed: true,
    handler: async (ctx) => {
      const ed = await edition(ctx);
      const page = parsePagination(ctx.query, {
        defaultLimit: Math.max(ctx.env.defaultPageLimit, 114),
        maxLimit: Math.max(ctx.env.maxPageLimit, 114),
      });
      const filter = surahFilter(ctx);
      const { rows, total } = await listSurahs(ctx.client, ed.id, page.limit, page.offset, filter);
      return { data: rows, meta: { ...pageMeta(page, total), edition: ed.slug, ...filter } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/surahs/:id',
    licensed: true,
    handler: async (ctx) => {
      const ed = await edition(ctx);
      const surah = await findSurah(ctx.client, ed.id, ctx.params.id ?? '');
      if (!surah) throw ApiError.notFound('Surah not found');
      const structure = await surahStructure(ctx.client, ed.id, surah.id);
      return { data: { ...surah, structure, edition: { id: ed.id, slug: ed.slug, name: ed.name } } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/surahs/:id/ayahs',
    licensed: true,
    handler: async (ctx) => {
      const ed = await edition(ctx);
      const surah = await findSurah(ctx.client, ed.id, ctx.params.id ?? '');
      if (!surah) throw ApiError.notFound('Surah not found');
      return ayahRange(ctx, 'a.surah_id = $2::uuid', [surah.id]);
    },
  },
  {
    method: 'GET',
    path: '/api/v1/ayahs/by-key/:key',
    licensed: true,
    handler: async (ctx) => {
      const key = ctx.params.key ?? '';
      const match = /^(\d{1,3}):(\d{1,3})$/.exec(key);
      if (!match) throw new ApiError('VALIDATION_ERROR', 'key must be "surah:ayah"');
      const ed = await edition(ctx);
      const { rows } = await queryAyahs(ctx.client, {
        editionId: ed.id,
        where: 's.surah_number = $2::int and a.ayah_number = $3::int',
        params: [Number(match[1]), Number(match[2])],
        translationId: await translationId(ctx),
      });
      const row = rows[0];
      if (!row) throw ApiError.notFound('Ayah not found');
      return { data: serializeAyah(row, ed) };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/ayahs/:id',
    licensed: true,
    handler: async (ctx) => {
      const id = ctx.params.id ?? '';
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError('VALIDATION_ERROR', 'id must be a uuid');
      const ed = await edition(ctx);
      const { rows } = await queryAyahs(ctx.client, {
        editionId: ed.id,
        where: 'a.id = $2::uuid',
        params: [id],
        translationId: await translationId(ctx),
      });
      const row = rows[0];
      if (!row) throw ApiError.notFound('Ayah not found');
      return { data: serializeAyah(row, ed) };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/juzs',
    licensed: true,
    handler: async (ctx) => {
      const ed = await edition(ctx);
      const rows = await listJuzs(ctx.client, ed.id);
      return { data: rows, meta: { total: rows.length, edition: ed.slug } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/juzs/:number',
    licensed: true,
    handler: async (ctx) => {
      const ed = await edition(ctx);
      const number = requireNumber(ctx.params.number ?? '', 'juz', 1, 30);
      const juz = await findJuz(ctx.client, ed.id, number);
      if (!juz) throw ApiError.notFound('Juz not found');
      return { data: juz, meta: { edition: ed.slug } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/juzs/:number/ayahs',
    licensed: true,
    handler: async (ctx) => {
      const number = requireNumber(ctx.params.number ?? '', 'juz', 1, 30);
      return ayahRange(ctx, 'a.juz_number = $2::int', [number]);
    },
  },
  {
    method: 'GET',
    path: '/api/v1/hizbs',
    licensed: true,
    handler: async (ctx) => {
      const ed = await edition(ctx);
      const rows = await listHizbs(ctx.client, ed.id);
      return { data: rows, meta: { total: rows.length, edition: ed.slug } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/hizbs/:number',
    licensed: true,
    handler: async (ctx) => {
      const ed = await edition(ctx);
      const number = requireNumber(ctx.params.number ?? '', 'hizb', 1, 60);
      const found = await findHizb(ctx.client, ed.id, number);
      if (!found) throw ApiError.notFound('Hizb not found');
      return { data: { ...found.hizb, quarters: found.quarters }, meta: { edition: ed.slug } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/hizbs/:number/ayahs',
    licensed: true,
    handler: async (ctx) => {
      const number = requireNumber(ctx.params.number ?? '', 'hizb', 1, 60);
      const quarter = ctx.query.get('quarter');
      if (quarter) {
        const q = requireNumber(quarter, 'quarter', 1, 4);
        return ayahRange(ctx, 'a.hizb_number = $2::int and a.rub_number = ($2::int - 1) * 4 + $3::int', [number, q]);
      }
      return ayahRange(ctx, 'a.hizb_number = $2::int', [number]);
    },
  },
  {
    method: 'GET',
    path: '/api/v1/rubs',
    licensed: true,
    handler: async (ctx) => {
      const ed = await edition(ctx);
      const rows = await listRubs(ctx.client, ed.id);
      return { data: rows, meta: { total: rows.length, edition: ed.slug } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/rubs/:number',
    licensed: true,
    handler: async (ctx) => {
      const ed = await edition(ctx);
      const number = requireNumber(ctx.params.number ?? '', 'rub', 1, 240);
      const rub = await findRub(ctx.client, ed.id, number);
      if (!rub) throw ApiError.notFound('Rub not found');
      return { data: rub, meta: { edition: ed.slug } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/rubs/:number/ayahs',
    licensed: true,
    handler: async (ctx) => {
      const number = requireNumber(ctx.params.number ?? '', 'rub', 1, 240);
      return ayahRange(ctx, 'a.rub_number = $2::int', [number]);
    },
  },
  {
    method: 'GET',
    path: '/api/v1/pages',
    licensed: true,
    handler: async (ctx) => {
      const ed = await edition(ctx);
      const rows = await listPages(ctx.client, ed.id);
      return { data: rows, meta: { total: rows.length, edition: ed.slug } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/pages/:page',
    licensed: true,
    handler: async (ctx) => {
      const ed = await edition(ctx);
      const number = parsePositiveInt(ctx.params.page ?? '', 0, 'page');
      const page = await findPage(ctx.client, ed.id, number);
      if (!page) throw ApiError.notFound('Page not found for this edition');
      return { data: page, meta: { edition: ed.slug } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/pages/:page/ayahs',
    licensed: true,
    handler: async (ctx) => {
      const number = parsePositiveInt(ctx.params.page ?? '', 0, 'page');
      return ayahRange(ctx, 'a.page_number = $2::int', [number]);
    },
  },
  {
    method: 'GET',
    path: '/api/v1/manzils',
    licensed: true,
    handler: async (ctx) => {
      const ed = await edition(ctx);
      const rows = await listManzils(ctx.client, ed.id);
      return { data: rows, meta: { total: rows.length, edition: ed.slug } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/manzils/:number',
    licensed: true,
    handler: async (ctx) => {
      const ed = await edition(ctx);
      const number = requireNumber(ctx.params.number ?? '', 'manzil', 1, 7);
      const manzil = await findManzil(ctx.client, ed.id, number);
      if (!manzil) throw ApiError.notFound('Manzil not found');
      return { data: manzil, meta: { edition: ed.slug } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/manzils/:number/ayahs',
    licensed: true,
    handler: async (ctx) => {
      const number = requireNumber(ctx.params.number ?? '', 'manzil', 1, 7);
      return ayahRange(ctx, 'a.manzil_number = $2::int', [number]);
    },
  },
  {
    method: 'GET',
    path: '/api/v1/sajdahs',
    licensed: true,
    handler: async (ctx) => {
      const ed = await edition(ctx);
      const { rows } = await queryAyahs(ctx.client, {
        editionId: ed.id,
        where: 'a.sajdah',
        params: [],
      });
      return {
        data: rows.map((row) => ({
          ayah_id: row.id,
          surah: row.surah_number,
          ayah: row.ayah_number,
          global_ayah_number: row.global_ayah_number,
          juz: row.juz_number,
          page: row.page_number,
          sajdah_type: row.sajdah_type,
          source_id: row.source_id,
          verified: row.verified,
        })),
        meta: { total: rows.length, edition: ed.slug },
      };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/rukus',
    licensed: true,
    handler: async (ctx) => {
      const ed = await edition(ctx);
      const surahParam = ctx.query.get('surah');
      const surah = surahParam ? requireNumber(surahParam, 'surah', 1, 114) : undefined;
      const rows = await listRukus(ctx.client, ed.id, surah);
      return { data: rows, meta: { total: rows.length, edition: ed.slug, ...(surah ? { surah } : {}) } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/rukus/:number',
    licensed: true,
    handler: async (ctx) => {
      const ed = await edition(ctx);
      const number = requireNumber(ctx.params.number ?? '', 'ruku', 1, 556);
      const ruku = await findRuku(ctx.client, ed.id, number);
      if (!ruku) throw ApiError.notFound('Ruku not found');
      return { data: ruku, meta: { edition: ed.slug } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/rukus/:number/ayahs',
    licensed: true,
    handler: async (ctx) => {
      const number = requireNumber(ctx.params.number ?? '', 'ruku', 1, 556);
      return ayahRange(ctx, 'a.ruku_number = $2::int', [number]);
    },
  },
];
