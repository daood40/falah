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

/** §44 — every number comes from the database, none is hard-coded. */
get('/api/v1/stats', async ({ res }) => {
  const row = await queryOne('select * from corpus.stats_view');
  const lastImport = await queryOne(
    `select id, adapter, file_name, status, dataset_version, total_records,
            successful_records, failed_records, skipped_records, duplicate_records,
            import_started_at, import_completed_at
     from corpus.raw_imports order by created_at desc limit 1`,
  );
  ok(res, {
    ...row,
    last_import: lastImport,
    dataset_version: config.activeDatasetVersion,
    content_license_confirmed: config.contentLicenseConfirmed,
  });
});
