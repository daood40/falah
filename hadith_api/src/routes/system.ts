import { get } from '../http/router.ts';
import { ok } from '../http/respond.ts';
import { query, queryOne } from '../db.ts';
import { config } from '../config.ts';
import { listRoutes } from '../http/router.ts';

/** §43 — status only; never a secret, a DSN or a key. */
get('/api/v1/health', async ({ res }) => {
  let database: 'up' | 'down' = 'down';
  let latencyMs: number | null = null;
  const started = Date.now();
  try {
    await query('select 1');
    database = 'up';
    latencyMs = Date.now() - started;
  } catch {
    database = 'down';
  }

  let activeDataset: { version: string; is_active: boolean } | null = null;
  if (database === 'up') {
    activeDataset = await queryOne<{ version: string; is_active: boolean }>(
      'select version, is_active from corpus.dataset_versions where is_active order by created_at desc limit 1',
    );
  }

  ok(
    res,
    {
      api: 'up',
      database,
      database_latency_ms: latencyMs,
      environment: config.environment,
      dataset_version: activeDataset?.version ?? null,
      content_license_confirmed: config.contentLicenseConfirmed,
      endpoints: listRoutes().length,
      time: new Date().toISOString(),
    },
    undefined,
    database === 'up' ? 200 : 503,
  );
});

/**
 * §12 — dataset identity. One call tells a client which corpus it is holding
 * and whether it changed: version + fingerprint + record count.
 */
get('/api/v1/version', async ({ res }) => {
  const dataset = await queryOne<{
    version: string; dataset_hash: string | null; record_count: number | null; status: string;
  }>(
    `select version, dataset_hash, record_count, status from corpus.dataset_versions
     where is_active order by created_at desc limit 1`,
  );
  ok(res, {
    api_version: 'v1',
    dataset_version: dataset?.version ?? null,
    dataset_hash: dataset?.dataset_hash ?? null,
    record_count: dataset?.record_count ?? null,
    status: dataset?.status ?? null,
    content_license_confirmed: config.contentLicenseConfirmed,
  });
});

get('/api/v1/datasets', async ({ res }) => {
  const rows = await query(
    `select d.version, d.description, d.is_active, d.status, d.dataset_hash,
            coalesce(d.record_count,
                     (select count(*)::int from corpus.hadiths h where h.dataset_version = d.version)) as record_count,
            d.released_at, d.created_at, s.name as source_name
     from corpus.dataset_versions d
     left join corpus.sources s on s.id = d.source_id
     order by d.created_at desc`,
  );
  ok(res, rows, { total: rows.length });
});

/** §44 — every number comes from the database, none is hard-coded. */
get('/api/v1/stats', async ({ res }) => {
  const row = await queryOne<Record<string, number>>('select * from corpus.stats_view');
  const extra = await queryOne<{ references: number; narrator_links: number }>(
    `select (select count(*)::int from corpus.hadith_sources) as references,
            (select count(*)::int from corpus.hadith_narrators) as narrator_links`,
  );
  const lastImport = await queryOne(
    `select id, adapter, file_name, status, dataset_version, total_records,
            successful_records, failed_records, skipped_records, duplicate_records,
            import_started_at, import_completed_at
     from corpus.raw_imports order by created_at desc limit 1`,
  );
  ok(res, {
    ...row,
    ...extra,
    last_import: lastImport,
    dataset_version: config.activeDatasetVersion,
    content_license_confirmed: config.contentLicenseConfirmed,
  });
});
