import { ApiError } from '../core/errors.ts';
import { pageMeta, parsePagination } from '../core/pagination.ts';
import { readJsonBody } from '../http/middleware.ts';
import type { Ctx, Route } from '../http/router.ts';

function requireUser(ctx: Ctx): string {
  if (!ctx.userId) throw new ApiError('UNAUTHORIZED', 'Authentication required');
  return ctx.userId;
}

function paging(ctx: Ctx) {
  return parsePagination(ctx.query, {
    defaultLimit: ctx.env.defaultPageLimit,
    maxLimit: ctx.env.maxPageLimit,
  });
}

async function body(ctx: Ctx): Promise<Record<string, unknown>> {
  const parsed = await readJsonBody(ctx.req);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ApiError('BAD_REQUEST', 'Body must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

function requireUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError('VALIDATION_ERROR', `${field} must be a uuid`);
  }
  return value;
}

/** All statements below run under RLS as `authenticated`; user_id = auth.uid(). */
export const userRoutes: Route[] = [
  {
    method: 'GET',
    path: '/api/v1/me/bookmarks',
    auth: true,
    handler: async (ctx) => {
      const userId = requireUser(ctx);
      const page = paging(ctx);
      const count = await ctx.client.query<{ count: string }>(
        'select count(*)::text as count from quran.user_bookmarks where user_id = $1',
        [userId],
      );
      const { rows } = await ctx.client.query(
        `select b.id, b.ayah_id, b.note, b.created_at, s.surah_number, a.ayah_number
         from quran.user_bookmarks b
         join quran.ayahs a on a.id = b.ayah_id
         join quran.surahs s on s.id = a.surah_id
         where b.user_id = $1 order by b.created_at desc limit $2 offset $3`,
        [userId, page.limit, page.offset],
      );
      return { data: rows, meta: pageMeta(page, Number(count.rows[0]?.count ?? 0)) };
    },
  },
  {
    method: 'POST',
    path: '/api/v1/me/bookmarks',
    auth: true,
    handler: async (ctx) => {
      const userId = requireUser(ctx);
      const payload = await body(ctx);
      const ayahId = requireUuid(payload.ayah_id, 'ayah_id');
      const note = typeof payload.note === 'string' ? payload.note.slice(0, 500) : null;
      const { rows } = await ctx.client.query(
        `insert into quran.user_bookmarks (user_id, ayah_id, note) values ($1, $2, $3)
         on conflict (user_id, ayah_id) do update set note = excluded.note
         returning id, ayah_id, note, created_at`,
        [userId, ayahId, note],
      );
      return { data: rows[0], status: 201 };
    },
  },
  {
    method: 'DELETE',
    path: '/api/v1/me/bookmarks/:ayah_id',
    auth: true,
    handler: async (ctx) => {
      const userId = requireUser(ctx);
      const ayahId = requireUuid(ctx.params.ayah_id, 'ayah_id');
      const { rowCount } = await ctx.client.query(
        'delete from quran.user_bookmarks where user_id = $1 and ayah_id = $2',
        [userId, ayahId],
      );
      if (rowCount === 0) throw ApiError.notFound('Bookmark not found');
      return { data: { deleted: true, ayah_id: ayahId } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/me/favorites',
    auth: true,
    handler: async (ctx) => {
      const userId = requireUser(ctx);
      const page = paging(ctx);
      const count = await ctx.client.query<{ count: string }>(
        'select count(*)::text as count from quran.user_favorites where user_id = $1',
        [userId],
      );
      const { rows } = await ctx.client.query(
        `select f.id, f.ayah_id, f.created_at, s.surah_number, a.ayah_number
         from quran.user_favorites f
         join quran.ayahs a on a.id = f.ayah_id
         join quran.surahs s on s.id = a.surah_id
         where f.user_id = $1 order by f.created_at desc limit $2 offset $3`,
        [userId, page.limit, page.offset],
      );
      return { data: rows, meta: pageMeta(page, Number(count.rows[0]?.count ?? 0)) };
    },
  },
  {
    method: 'POST',
    path: '/api/v1/me/favorites',
    auth: true,
    handler: async (ctx) => {
      const userId = requireUser(ctx);
      const payload = await body(ctx);
      const ayahId = requireUuid(payload.ayah_id, 'ayah_id');
      const { rows } = await ctx.client.query(
        `insert into quran.user_favorites (user_id, ayah_id) values ($1, $2)
         on conflict (user_id, ayah_id) do nothing
         returning id, ayah_id, created_at`,
        [userId, ayahId],
      );
      if (rows[0]) return { data: rows[0], status: 201 };
      const existing = await ctx.client.query(
        'select id, ayah_id, created_at from quran.user_favorites where user_id = $1 and ayah_id = $2',
        [userId, ayahId],
      );
      return { data: existing.rows[0] };
    },
  },
  {
    method: 'DELETE',
    path: '/api/v1/me/favorites/:ayah_id',
    auth: true,
    handler: async (ctx) => {
      const userId = requireUser(ctx);
      const ayahId = requireUuid(ctx.params.ayah_id, 'ayah_id');
      const { rowCount } = await ctx.client.query(
        'delete from quran.user_favorites where user_id = $1 and ayah_id = $2',
        [userId, ayahId],
      );
      if (rowCount === 0) throw ApiError.notFound('Favorite not found');
      return { data: { deleted: true, ayah_id: ayahId } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/me/progress',
    auth: true,
    handler: async (ctx) => {
      const userId = requireUser(ctx);
      const { rows } = await ctx.client.query(
        `select p.id, p.edition_id, p.surah_id, p.ayah_id, p.updated_at,
                s.surah_number, a.ayah_number
         from quran.user_reading_progress p
         join quran.surahs s on s.id = p.surah_id
         join quran.ayahs a on a.id = p.ayah_id
         where p.user_id = $1 order by p.updated_at desc`,
        [userId],
      );
      return { data: rows, meta: { total: rows.length } };
    },
  },
  {
    method: 'PUT',
    path: '/api/v1/me/progress',
    auth: true,
    handler: async (ctx) => {
      const userId = requireUser(ctx);
      const payload = await body(ctx);
      const ayahId = requireUuid(payload.ayah_id, 'ayah_id');
      const { rows: ayahRows } = await ctx.client.query<{ edition_id: string; surah_id: string }>(
        'select edition_id, surah_id from quran.ayahs where id = $1',
        [ayahId],
      );
      const ayah = ayahRows[0];
      if (!ayah) throw ApiError.notFound('Ayah not found');
      const { rows } = await ctx.client.query(
        `insert into quran.user_reading_progress (user_id, edition_id, surah_id, ayah_id)
         values ($1, $2, $3, $4)
         on conflict (user_id, edition_id)
         do update set surah_id = excluded.surah_id, ayah_id = excluded.ayah_id, updated_at = now()
         returning id, edition_id, surah_id, ayah_id, updated_at`,
        [userId, ayah.edition_id, ayah.surah_id, ayahId],
      );
      return { data: rows[0] };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/me/favorite-reciters',
    auth: true,
    handler: async (ctx) => {
      const userId = requireUser(ctx);
      const { rows } = await ctx.client.query(
        `select fr.id, fr.reciter_id, fr.created_at, r.slug, r.name_ar, r.name_en
         from quran.user_favorite_reciters fr
         join quran.reciters r on r.id = fr.reciter_id
         where fr.user_id = $1 order by fr.created_at desc`,
        [userId],
      );
      return { data: rows, meta: { total: rows.length } };
    },
  },
  {
    method: 'POST',
    path: '/api/v1/me/favorite-reciters',
    auth: true,
    handler: async (ctx) => {
      const userId = requireUser(ctx);
      const payload = await body(ctx);
      const reciterId = requireUuid(payload.reciter_id, 'reciter_id');
      const { rows } = await ctx.client.query(
        `insert into quran.user_favorite_reciters (user_id, reciter_id) values ($1, $2)
         on conflict (user_id, reciter_id) do nothing
         returning id, reciter_id, created_at`,
        [userId, reciterId],
      );
      if (rows[0]) return { data: rows[0], status: 201 };
      const existing = await ctx.client.query(
        'select id, reciter_id, created_at from quran.user_favorite_reciters where user_id = $1 and reciter_id = $2',
        [userId, reciterId],
      );
      return { data: existing.rows[0] };
    },
  },
  {
    method: 'DELETE',
    path: '/api/v1/me/favorite-reciters/:id',
    auth: true,
    handler: async (ctx) => {
      const userId = requireUser(ctx);
      const reciterId = requireUuid(ctx.params.id, 'id');
      const { rowCount } = await ctx.client.query(
        'delete from quran.user_favorite_reciters where user_id = $1 and reciter_id = $2',
        [userId, reciterId],
      );
      if (rowCount === 0) throw ApiError.notFound('Favorite reciter not found');
      return { data: { deleted: true, reciter_id: reciterId } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/me/audio-progress',
    auth: true,
    handler: async (ctx) => {
      const userId = requireUser(ctx);
      const { rows } = await ctx.client.query(
        `select id, recitation_id, surah_id, ayah_id, position_ms, updated_at
         from quran.user_audio_progress where user_id = $1 order by updated_at desc`,
        [userId],
      );
      return { data: rows, meta: { total: rows.length } };
    },
  },
  {
    method: 'PUT',
    path: '/api/v1/me/audio-progress',
    auth: true,
    handler: async (ctx) => {
      const userId = requireUser(ctx);
      const payload = await body(ctx);
      const recitationId = requireUuid(payload.recitation_id, 'recitation_id');
      const positionMs = Number(payload.position_ms ?? 0);
      if (!Number.isInteger(positionMs) || positionMs < 0) {
        throw new ApiError('VALIDATION_ERROR', 'position_ms must be a non-negative integer');
      }
      const surahId = payload.surah_id == null ? null : requireUuid(payload.surah_id, 'surah_id');
      const ayahId = payload.ayah_id == null ? null : requireUuid(payload.ayah_id, 'ayah_id');
      const { rows } = await ctx.client.query(
        `insert into quran.user_audio_progress (user_id, recitation_id, surah_id, ayah_id, position_ms)
         values ($1, $2, $3, $4, $5)
         on conflict (user_id, recitation_id) do update
           set surah_id = excluded.surah_id, ayah_id = excluded.ayah_id,
               position_ms = excluded.position_ms, updated_at = now()
         returning id, recitation_id, surah_id, ayah_id, position_ms, updated_at`,
        [userId, recitationId, surahId, ayahId, positionMs],
      );
      return { data: rows[0] };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/me/settings',
    auth: true,
    handler: async (ctx) => {
      const userId = requireUser(ctx);
      const { rows } = await ctx.client.query(
        `select user_id, selected_edition, selected_riwayah, selected_reciter,
                selected_translation, selected_quality, autoplay_next_ayah,
                autoplay_next_surah, download_wifi_only, updated_at
         from quran.user_quran_settings where user_id = $1`,
        [userId],
      );
      return { data: rows[0] ?? null };
    },
  },
  {
    method: 'PUT',
    path: '/api/v1/me/settings',
    auth: true,
    handler: async (ctx) => {
      const userId = requireUser(ctx);
      const payload = await body(ctx);
      const uuidOrNull = (key: string): string | null =>
        payload[key] == null ? null : requireUuid(payload[key], key);
      const boolOr = (key: string, fallback: boolean): boolean =>
        typeof payload[key] === 'boolean' ? (payload[key] as boolean) : fallback;
      const { rows } = await ctx.client.query(
        `insert into quran.user_quran_settings
           (user_id, selected_edition, selected_riwayah, selected_reciter, selected_translation,
            selected_quality, autoplay_next_ayah, autoplay_next_surah, download_wifi_only)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (user_id) do update set
           selected_edition = excluded.selected_edition,
           selected_riwayah = excluded.selected_riwayah,
           selected_reciter = excluded.selected_reciter,
           selected_translation = excluded.selected_translation,
           selected_quality = excluded.selected_quality,
           autoplay_next_ayah = excluded.autoplay_next_ayah,
           autoplay_next_surah = excluded.autoplay_next_surah,
           download_wifi_only = excluded.download_wifi_only,
           updated_at = now()
         returning user_id, selected_edition, selected_riwayah, selected_reciter,
                   selected_translation, selected_quality, autoplay_next_ayah,
                   autoplay_next_surah, download_wifi_only, updated_at`,
        [
          userId,
          uuidOrNull('selected_edition'),
          uuidOrNull('selected_riwayah'),
          uuidOrNull('selected_reciter'),
          uuidOrNull('selected_translation'),
          typeof payload.selected_quality === 'string' ? payload.selected_quality : null,
          boolOr('autoplay_next_ayah', true),
          boolOr('autoplay_next_surah', false),
          boolOr('download_wifi_only', true),
        ],
      );
      return { data: rows[0] };
    },
  },
];
