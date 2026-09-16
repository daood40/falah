import { ApiError } from '../core/errors.ts';
import type { Route } from '../http/router.ts';
import { resolveEdition } from '../repositories/editions.ts';
import { findReciter } from '../repositories/reciters.ts';

/**
 * Offline manifests. Content is offered for download only when the licence
 * flags allow redistribution; otherwise the manifest is returned with
 * `downloadable: false` and no URLs, so clients can show an honest state.
 */
export const downloadRoutes: Route[] = [
  {
    method: 'GET',
    path: '/api/v1/downloads/quran',
    licensed: true,
    handler: async (ctx) => {
      const ed = await resolveEdition(ctx.client, ctx.query.get('edition'));
      const { rows } = await ctx.client.query<{
        version: string;
        source_file_hash: string;
        record_count: number;
        status: string;
        import_date: string;
      }>(
        `select version, source_file_hash, record_count, status, import_date
         from quran.quran_dataset_versions
         where edition_id = $1 and status in ('verified', 'published')
         order by import_date desc limit 1`,
        [ed.id],
      );
      const dataset = rows[0];
      if (!dataset) throw ApiError.notFound('No verified dataset for this edition');

      const translationSlug = ctx.query.get('translation');
      const translation = translationSlug
        ? (
            await ctx.client.query(
              `select slug, language, title, license, license_url, version
               from quran.translations where slug = $1`,
              [translationSlug],
            )
          ).rows[0] ?? null
        : null;

      const downloadable = ctx.env.flags.contentLicenseConfirmed && ctx.env.flags.publicDataEnabled;
      const { rows: sizeRows } = await ctx.client.query<{ bytes: string }>(
        `select coalesce(sum(octet_length(raw_text)), 0)::text as bytes
         from quran.ayahs where edition_id = $1`,
        [ed.id],
      );

      return {
        data: {
          dataset_version: dataset.version,
          edition: {
            id: ed.id,
            slug: ed.slug,
            name: ed.name,
            riwayah: ed.riwayah,
            qiraah: ed.qiraah,
            language: ed.language,
            license: ed.license,
            license_url: ed.license_url,
          },
          language: ed.language,
          translation,
          audio: null,
          record_count: dataset.record_count,
          size: Number(sizeRows[0]?.bytes ?? 0),
          checksum: dataset.source_file_hash,
          downloadable,
          download_url: downloadable ? `/api/v1/surahs?edition=${ed.slug}&limit=114` : null,
          license_note: downloadable
            ? 'Redistribution confirmed by configuration'
            : 'Redistribution not confirmed — text is served read-only via the API',
        },
      };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/downloads/reciters/:id/surah/:surah_id',
    licensed: true,
    handler: async (ctx) => {
      const reciter = await findReciter(ctx.client, ctx.params.id ?? '');
      if (!reciter) throw ApiError.notFound('Reciter not found');
      const surahNumber = Number.parseInt(ctx.params.surah_id ?? '', 10);
      if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
        throw new ApiError('VALIDATION_ERROR', 'surah_id must be 1..114');
      }
      const { rows } = await ctx.client.query(
        `select af.sequence_number as sequence, af.audio_url, af.stream_url, af.download_url,
                af.file_size as size, af.duration_ms as duration, af.format, af.bitrate,
                af.checksum, af.dataset_version as version, af.status, af.verified
         from quran.audio_files af
         join quran.recitations rec on rec.id = af.recitation_id
         left join quran.ayahs ay on ay.id = af.ayah_id
         left join quran.surahs s on s.id = coalesce(af.surah_id, ay.surah_id)
         where rec.reciter_id = $1 and s.surah_number = $2
         order by af.sequence_number`,
        [reciter.id, surahNumber],
      );
      const downloadable = ctx.env.flags.audioLicenseConfirmed;
      return {
        data: {
          reciter: { id: reciter.id, slug: reciter.slug, name_ar: reciter.name_ar },
          surah: surahNumber,
          downloadable,
          files: rows.map((row) => ({
            ...row,
            download_url: downloadable && row.status === 'public' ? row.download_url : null,
          })),
        },
        meta: {
          total: rows.length,
          license_note: downloadable
            ? 'Audio redistribution confirmed by configuration'
            : 'Audio redistribution not confirmed — download URLs withheld',
        },
      };
    },
  },
];
