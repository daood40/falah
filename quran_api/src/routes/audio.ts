import { ApiError } from '../core/errors.ts';
import { pageMeta, parsePagination } from '../core/pagination.ts';
import type { Ctx, Route } from '../http/router.ts';
import { resolveEdition } from '../repositories/editions.ts';
import { findSurah } from '../repositories/quran.ts';
import {
  findReciter,
  listAudioFiles,
  listReciterRiwayat,
  listReciters,
  listRecitations,
} from '../repositories/reciters.ts';

/**
 * Audio licensing gate: download URLs are withheld unless
 * AUDIO_LICENSE_CONFIRMED=true AND the row itself is marked public.
 */
function serializeAudio(row: Record<string, unknown>, audioLicenseConfirmed: boolean) {
  const publicAudio = audioLicenseConfirmed && row.status === 'public';
  return {
    ...row,
    download_url: publicAudio ? row.download_url : null,
    downloadable: publicAudio,
  };
}

function paging(ctx: Ctx) {
  return parsePagination(ctx.query, {
    defaultLimit: ctx.env.defaultPageLimit,
    maxLimit: ctx.env.maxPageLimit,
  });
}

async function requireReciter(ctx: Ctx) {
  const reciter = await findReciter(ctx.client, ctx.params.id ?? '');
  if (!reciter) throw ApiError.notFound('Reciter not found');
  return reciter;
}

export const audioRoutes: Route[] = [
  {
    method: 'GET',
    path: '/api/v1/reciters',
    handler: async (ctx) => {
      const page = paging(ctx);
      const search = ctx.query.get('search') ?? undefined;
      const { rows, total } = await listReciters(ctx.client, {
        search,
        limit: page.limit,
        offset: page.offset,
      });
      return { data: rows, meta: pageMeta(page, total) };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/reciters/:id',
    handler: async (ctx) => ({ data: await requireReciter(ctx) }),
  },
  {
    method: 'GET',
    path: '/api/v1/reciters/:id/riwayat',
    handler: async (ctx) => {
      const reciter = await requireReciter(ctx);
      const rows = await listReciterRiwayat(ctx.client, reciter.id);
      return { data: rows, meta: { total: rows.length } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/reciters/:id/recitations',
    handler: async (ctx) => {
      const reciter = await requireReciter(ctx);
      const rows = await listRecitations(ctx.client, reciter.id);
      return { data: rows, meta: { total: rows.length } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/reciters/:id/surahs',
    licensed: true,
    handler: async (ctx) => {
      const reciter = await requireReciter(ctx);
      const { rows } = await ctx.client.query(
        `select s.surah_number, s.name_ar, count(af.id)::int as audio_file_count
         from quran.audio_files af
         join quran.recitations rec on rec.id = af.recitation_id
         left join quran.ayahs ay on ay.id = af.ayah_id
         join quran.surahs s on s.id = coalesce(af.surah_id, ay.surah_id)
         where rec.reciter_id = $1
         group by s.surah_number, s.name_ar order by s.surah_number`,
        [reciter.id],
      );
      return { data: rows, meta: { total: rows.length } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/reciters/:id/surahs/:surah_id',
    licensed: true,
    handler: async (ctx) => {
      const reciter = await requireReciter(ctx);
      const page = paging(ctx);
      const surahNumber = Number.parseInt(ctx.params.surah_id ?? '', 10);
      if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
        throw new ApiError('VALIDATION_ERROR', 'surah_id must be 1..114');
      }
      const { rows, total } = await listAudioFiles(
        ctx.client,
        { kind: 'reciter_surah', reciterId: reciter.id, surahNumber },
        page,
      );
      return {
        data: rows.map((row) => serializeAudio(row, ctx.env.flags.audioLicenseConfirmed)),
        meta: pageMeta(page, total),
      };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/reciters/:id/juzs/:juz_number',
    licensed: true,
    handler: async (ctx) => {
      const reciter = await requireReciter(ctx);
      const page = paging(ctx);
      const juzNumber = Number.parseInt(ctx.params.juz_number ?? '', 10);
      if (!Number.isInteger(juzNumber) || juzNumber < 1 || juzNumber > 30) {
        throw new ApiError('VALIDATION_ERROR', 'juz_number must be 1..30');
      }
      const { rows, total } = await listAudioFiles(
        ctx.client,
        { kind: 'reciter_juz', reciterId: reciter.id, juzNumber },
        page,
      );
      return {
        data: rows.map((row) => serializeAudio(row, ctx.env.flags.audioLicenseConfirmed)),
        meta: pageMeta(page, total),
      };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/reciters/:id/full-quran',
    licensed: true,
    handler: async (ctx) => {
      const reciter = await requireReciter(ctx);
      const page = paging(ctx);
      const { rows, total } = await listAudioFiles(
        ctx.client,
        { kind: 'reciter', reciterId: reciter.id },
        page,
      );
      return {
        data: rows.map((row) => serializeAudio(row, ctx.env.flags.audioLicenseConfirmed)),
        meta: pageMeta(page, total),
      };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/ayahs/:id/audio',
    licensed: true,
    handler: async (ctx) => {
      const page = paging(ctx);
      const id = ctx.params.id ?? '';
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError('VALIDATION_ERROR', 'id must be a uuid');
      const { rows, total } = await listAudioFiles(ctx.client, { kind: 'ayah', ayahId: id }, page);
      return {
        data: rows.map((row) => serializeAudio(row, ctx.env.flags.audioLicenseConfirmed)),
        meta: pageMeta(page, total),
      };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/surahs/:id/audio',
    licensed: true,
    handler: async (ctx) => {
      const ed = await resolveEdition(ctx.client, ctx.query.get('edition'));
      const surah = await findSurah(ctx.client, ed.id, ctx.params.id ?? '');
      if (!surah) throw ApiError.notFound('Surah not found');
      const page = paging(ctx);
      const { rows, total } = await listAudioFiles(
        ctx.client,
        { kind: 'surah', surahId: surah.id },
        page,
      );
      return {
        data: rows.map((row) => serializeAudio(row, ctx.env.flags.audioLicenseConfirmed)),
        meta: pageMeta(page, total),
      };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/audio/search',
    licensed: true,
    handler: async (ctx) => {
      const page = paging(ctx);
      const surahRaw = ctx.query.get('surah');
      const surah = surahRaw ? Number.parseInt(surahRaw, 10) : undefined;
      if (surahRaw && (!Number.isInteger(surah) || surah! < 1 || surah! > 114)) {
        throw new ApiError('VALIDATION_ERROR', 'surah must be 1..114');
      }
      const { rows, total } = await listAudioFiles(
        ctx.client,
        {
          kind: 'search',
          reciter: ctx.query.get('reciter') ?? undefined,
          surah,
          riwayah: ctx.query.get('riwayah') ?? undefined,
          format: ctx.query.get('format') ?? undefined,
        },
        page,
      );
      return {
        data: rows.map((row) => serializeAudio(row, ctx.env.flags.audioLicenseConfirmed)),
        meta: pageMeta(page, total),
      };
    },
  },
];
