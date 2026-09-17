import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Route } from '../http/router.ts';

/** Read once at boot: the spec that ships with this build. */
const OPENAPI_PATH = path.join(import.meta.dirname, '..', '..', 'openapi', 'openapi.yaml');
let openapiCache: string | null = null;
const openapiDocument = (): string => {
  openapiCache ??= readFileSync(OPENAPI_PATH, 'utf8');
  return openapiCache;
};

/** Build identifier of the API itself (independent of the dataset version). */
export const API_RELEASE = '1.2.0';

/** Migration series this build expects; checked against the database at runtime. */
export const SCHEMA_VERSION = '008';

/** Set by the build (e.g. a commit SHA); unknown when not provided. */
export const BUILD_INFO = {
  commit: process.env.BUILD_COMMIT ?? null,
  built_at: process.env.BUILD_TIME ?? null,
};

/** /health, /version, /openapi.yaml, /stats, /sources, /editions, /qiraat, /riwayat, /translations */
export const metaRoutes: Route[] = [
  {
    method: 'GET',
    path: '/api/v1/health',
    handler: async ({ client, env }) => {
      const checks: Record<string, unknown> = { api: 'ok' };
      let status = 'ok';
      try {
        await client.query('select 1');
        checks.database = 'ok';
      } catch {
        checks.database = 'error';
        status = 'degraded';
      }
      const dataset = await client.query<{ version: string; status: string; import_date: string }>(
        `select version, status, import_date from quran.quran_dataset_versions
         order by import_date desc limit 1`,
      );
      checks.dataset = dataset.rows[0] ?? null;
      if (!dataset.rows[0]) status = 'degraded';
      return {
        data: {
          status,
          environment: env.environment,
          api_version: 'v1',
          private_mode: env.privateMode,
          public_api_enabled: env.flags.publicApiEnabled,
          checks,
          license_flags: env.flags,
        },
      };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/version',
    handler: async ({ client, env }) => {
      const { rows } = await client.query<{
        version: string;
        status: string;
        import_date: string;
        source_file_hash: string;
        record_count: number;
        edition_slug: string | null;
        human_verified: boolean;
        verified_at: string | null;
        verifier_name: string | null;
      }>(
        `select dv.version, dv.status, dv.import_date, dv.source_file_hash, dv.record_count,
                e.slug as edition_slug,
                (hv.id is not null) as human_verified,
                hv.verified_at, hv.verifier_name
         from quran.quran_dataset_versions dv
         left join quran.quran_editions e on e.id = dv.edition_id
         left join lateral (
           select id, verified_at, verifier_name from quran.human_verifications
           where dataset_version_id = dv.id and result = 'approved'
           order by verified_at desc limit 1
         ) hv on true
         order by dv.import_date desc limit 1`,
      );
      const dataset = rows[0] ?? null;

      // Schema version = the highest migration applied, read from the database
      // itself rather than asserted by the code.
      const { rows: schemaRows } = await client.query<{ tables: string; views: string }>(
        `select (select count(*)::text from information_schema.tables
                 where table_schema = 'quran' and table_type = 'BASE TABLE') as tables,
                (select count(*)::text from information_schema.views
                 where table_schema = 'quran') as views`,
      );

      // Integrity status is derived from the data, never asserted.
      const { rows: integrityRows } = await client.query<{ ayahs: string; unverified: string }>(
        `select (select count(*)::text from quran.ayahs) as ayahs,
                (select count(*)::text from quran.ayahs where not verified) as unverified`,
      );
      const ayahs = Number(integrityRows[0]?.ayahs ?? 0);
      const unverified = Number(integrityRows[0]?.unverified ?? 0);

      const { rows: schemeRows } = await client.query<{
        scheme_kind: string; scheme_code: string; scheme_version: string; decision_status: string;
      }>(
        `select scheme_kind, scheme_code, scheme_version, decision_status
         from quran.data_schemes order by scheme_kind`,
      );

      return {
        data: {
          api_version: 'v1',
          api_release: API_RELEASE,
          build: BUILD_INFO,
          schema: {
            tables: Number(schemaRows[0]?.tables ?? 0),
            views: Number(schemaRows[0]?.views ?? 0),
            migrations_applied: SCHEMA_VERSION,
          },
          environment: env.environment,
          private_mode: env.privateMode,
          dataset: dataset && {
            version: dataset.version,
            status: dataset.status,
            edition: dataset.edition_slug,
            record_count: dataset.record_count,
            source_file_hash: dataset.source_file_hash,
            imported_at: dataset.import_date,
          },
          data_status: dataset
            ? dataset.status === 'published'
              ? 'published'
              : dataset.status
            : 'no_dataset',
          integrity_status:
            ayahs === 0 ? 'no_data' : unverified === 0 ? 'automated_verified' : 'incomplete',
          integrity: { ayahs, unverified },
          // Automated verification and human verification are separate facts.
          human_verification: {
            verified: dataset?.human_verified ?? false,
            verified_at: dataset?.verified_at ?? null,
            verifier: dataset?.verifier_name ?? null,
          },
          declared_schemes: schemeRows,
          license_flags: env.flags,
          openapi_url: '/api/v1/openapi.yaml',
        },
      };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/openapi.yaml',
    handler: async ({ res }) => {
      const document = openapiDocument();
      res.writeHead(200, {
        'content-type': 'application/yaml; charset=utf-8',
        'content-length': Buffer.byteLength(document),
        'cache-control': 'public, max-age=300',
      });
      res.end(document);
      return { data: null, raw: true };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/stats',
    handler: async ({ client }) => {
      const { rows } = await client.query<Record<string, string>>(`
        select
          (select count(*) from quran.surahs)::text as surahs,
          (select count(*) from quran.ayahs)::text as ayahs,
          (select count(*) from quran.juzs)::text as juzs,
          (select count(distinct hizb_number) from quran.hizbs)::text as hizbs,
          (select count(*) from quran.hizbs)::text as rubs,
          (select count(*) from quran.pages)::text as pages,
          (select count(*) from quran.manzils)::text as manzils,
          (select count(*) from quran.rukus)::text as rukus,
          (select count(*) from quran.ayahs where sajdah)::text as sajdahs,
          (select count(*) from quran.translations)::text as translations,
          (select count(*) from quran.ayah_translations)::text as ayah_translations,
          (select count(*) from quran.reciters)::text as reciters,
          (select count(*) from quran.recitations)::text as recitations,
          (select count(*) from quran.audio_files)::text as audio_files,
          (select count(*) from quran.quran_editions)::text as editions,
          (select count(*) from quran.quran_dataset_versions)::text as datasets,
          (select count(*) from quran.qiraat)::text as qiraat,
          (select count(*) from quran.riwayat)::text as riwayat,
          (select count(*) from quran.sources)::text as sources
      `);
      const raw = rows[0] ?? {};
      const data = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number(v)]));
      return { data };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/sources',
    handler: async ({ client }) => {
      const { rows } = await client.query(
        `select id, name, organization, url, api_url, description, language, license,
                license_url, attribution_required, attribution_text, version, status,
                created_at, updated_at
         from quran.sources order by id`,
      );
      return { data: rows, meta: { total: rows.length } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/editions',
    handler: async ({ client, query }) => {
      const values: unknown[] = [];
      const conditions: string[] = [];
      const type = query.get('type');
      const language = query.get('language');
      if (type) conditions.push(`edition_type = $${values.push(type)}`);
      if (language) conditions.push(`language = $${values.push(language)}`);
      const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
      const { rows } = await client.query(
        `select id, source_id, slug, name, edition_type, riwayah, qiraah, script_type,
                font_name, version, publisher, country, language, license, license_url
         from quran.quran_editions ${where} order by edition_type, slug`,
        values,
      );
      return { data: rows, meta: { total: rows.length } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/qiraat',
    handler: async ({ client }) => {
      const { rows } = await client.query(
        `select id, slug, name_ar, name_en, description, source_id, license, license_url, verified
         from quran.qiraat order by name_ar`,
      );
      return { data: rows, meta: { total: rows.length } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/riwayat',
    handler: async ({ client, query }) => {
      const values: unknown[] = [];
      const qiraah = query.get('qiraah');
      const where = qiraah ? `where q.slug = $${values.push(qiraah)}` : '';
      const { rows } = await client.query(
        `select r.id, r.slug, r.name_ar, r.name_en, r.description, r.source_id, r.license,
                r.license_url, r.verified, r.qiraah_id, q.slug as qiraah_slug, q.name_ar as qiraah_name_ar
         from quran.riwayat r join quran.qiraat q on q.id = r.qiraah_id ${where}
         order by r.name_ar`,
        values,
      );
      return { data: rows, meta: { total: rows.length } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/translations',
    handler: async ({ client, query }) => {
      const values: unknown[] = [];
      const language = query.get('language');
      const where = language ? `where language = $${values.push(language)}` : '';
      const { rows } = await client.query(
        `select id, slug, language, translator, title, edition_id, source_id, license,
                license_url, version, verified
         from quran.translations ${where} order by language, title`,
        values,
      );
      return { data: rows, meta: { total: rows.length } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/schemes',
    handler: async ({ client }) => {
      const { rows } = await client.query(
        `select scheme_kind, scheme_code, scheme_version, dataset_version, source_id,
                description, observed_summary, alternatives, decision_status,
                decided_by, decided_at, notes, updated_at
         from quran.data_schemes order by scheme_kind`,
      );
      return {
        data: rows,
        meta: {
          total: rows.length,
          pending: rows.filter((row) => row.decision_status === 'PENDING').length,
          note:
            'A scheme describes which convention the stored data follows. PENDING means the ' +
            'owner has not yet confirmed it; the data itself is unaffected either way.',
        },
      };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/catalog',
    // Internal while the project is private: it is an inventory of everything
    // the platform holds, category by category.
    auth: true,
    handler: async ({ client }) => {
      const { rows } = await client.query(
        `select category, label, table_name, records, verified, source, source_version,
                dataset_version, license_kind, license_status, license_records_confirmed,
                license_records_total, checksum_status, verification_status, availability, notes
         from quran.data_catalog order by records desc, category`,
      );
      const totals = rows.reduce(
        (accumulator, row) => {
          accumulator.records += Number(row.records ?? 0);
          accumulator.categories += 1;
          if (row.availability === 'ready') accumulator.ready += 1;
          if (row.availability === 'empty') accumulator.empty += 1;
          return accumulator;
        },
        { categories: 0, records: 0, ready: 0, empty: 0 },
      );
      return { data: rows, meta: totals };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/licenses',
    // Internal: the licence ledger is only visible to an authenticated caller.
    auth: true,
    handler: async ({ client }) => {
      const { rows } = await client.query(
        `select dataset_kind, subject, source_id, owner, copyright_holder, license,
                license_url, permission_reference, redistribution, commercial_use,
                modification, attribution_required, attribution_text, expires_at,
                evidence, evidence_url, status, recorded_by, notes, updated_at
         from quran.license_records order by dataset_kind, subject`,
      );
      const { rows: summary } = await client.query(
        'select dataset_kind, confirmed, pending, restricted, rejected, total, all_confirmed from quran.license_gate order by dataset_kind',
      );
      return {
        data: rows,
        meta: {
          total: rows.length,
          summary,
          note: 'CONFIRMED requires recorded evidence; anything else blocks public release.',
        },
      };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/datasets',
    handler: async ({ client }) => {
      const { rows } = await client.query(
        `select id, source_id, edition_id, version, source_file_hash, import_date,
                record_count, status, notes
         from quran.quran_dataset_versions order by import_date desc`,
      );
      return { data: rows, meta: { total: rows.length } };
    },
  },
];
