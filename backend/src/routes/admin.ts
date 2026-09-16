import type { IncomingMessage } from 'node:http';
import { get, post } from '../http/router.ts';
import { ok, paginated } from '../http/respond.ts';
import { query, queryOne } from '../db.ts';
import { requireAdmin, type Principal } from '../http/auth.ts';
import { ApiError, badRequest, notFound } from '../http/errors.ts';
import { readJsonBody } from '../http/middleware.ts';
import { optionalEnum, optionalText, pagination, uuidParam } from '../http/validate.ts';
import { serializeHadith, type HadithRow } from '../domain/serialize.ts';
import { HADITH_FROM, HADITH_SELECT } from './shared.ts';
import { config } from '../config.ts';

async function audit(
  actor: Principal,
  action: string,
  entityType: string,
  entityId: string | null,
  details: unknown,
  requestId: string,
): Promise<void> {
  await query(
    `insert into corpus.audit_logs (actor, actor_role, action, entity_type, entity_id, details, request_id)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [actor.id, actor.role, action, entityType, entityId, JSON.stringify(details ?? {}), requestId],
  );
}

function admin(req: IncomingMessage): Principal {
  return requireAdmin(req);
}

// ---------------- dashboard (§42) ----------------
get('/api/v1/admin/stats', async ({ res, req }) => {
  admin(req);
  const stats = await queryOne('select * from corpus.stats_view');
  const lastImport = await queryOne(
    `select id, adapter, file_name, file_hash, status, dataset_version, total_records,
            successful_records, failed_records, skipped_records, duplicate_records,
            import_started_at, import_completed_at
     from corpus.raw_imports order by created_at desc limit 1`,
  );
  const datasets = await query(
    'select version, is_active, released_at, description from corpus.dataset_versions order by created_at desc',
  );
  const failures = await queryOne<{ total: number }>(
    `select count(*)::int as total from corpus.raw_imports where status = 'failed'`,
  );
  ok(res, {
    ...stats,
    last_import: lastImport,
    dataset_versions: datasets,
    failed_imports: failures?.total ?? 0,
    content_license_confirmed: config.contentLicenseConfirmed,
    environment: config.environment,
  });
});

// ---------------- import history (§47) ----------------
get('/api/v1/admin/imports', async ({ res, req, query: q }) => {
  admin(req);
  const { page, limit, offset } = pagination(q);
  const total = (await queryOne<{ total: number }>('select count(*)::int as total from corpus.raw_imports'))?.total ?? 0;
  const rows = await query(
    `select id, source_id, edition_id, dataset_version, adapter, file_name, file_hash,
            dry_run, status, total_records, successful_records, failed_records,
            skipped_records, duplicate_records, import_started_at, import_completed_at
     from corpus.raw_imports order by created_at desc limit $1 offset $2`,
    [limit, offset],
  );
  paginated(res, rows, page, limit, total);
});

get('/api/v1/admin/imports/:id', async ({ res, req, params }) => {
  admin(req);
  const row = await queryOne('select * from corpus.raw_imports where id = $1', [
    uuidParam(params['id'] as string),
  ]);
  if (!row) throw notFound('Import');
  ok(res, row);
});

get('/api/v1/admin/dataset-versions', async ({ res, req }) => {
  admin(req);
  const rows = await query(
    `select v.version, v.description, v.is_active, v.released_at, v.created_at,
            (select count(*)::int from corpus.hadiths h where h.dataset_version = v.version) as hadith_count
     from corpus.dataset_versions v order by v.created_at desc`,
  );
  ok(res, rows);
});

get('/api/v1/admin/audit-logs', async ({ res, req, query: q }) => {
  admin(req);
  const { page, limit, offset } = pagination(q);
  const total = (await queryOne<{ total: number }>('select count(*)::int as total from corpus.audit_logs'))?.total ?? 0;
  const rows = await query(
    `select id, actor, actor_role, action, entity_type, entity_id, details, request_id, created_at
     from corpus.audit_logs order by created_at desc limit $1 offset $2`,
    [limit, offset],
  );
  paginated(res, rows, page, limit, total);
});

// ---------------- internal read of the full text (§3) ----------------
get('/api/v1/admin/hadiths/:id', async ({ res, req, params }) => {
  admin(req);
  const row = await queryOne<HadithRow>(`select ${HADITH_SELECT} ${HADITH_FROM} where h.id = $1`, [
    uuidParam(params['id'] as string),
  ]);
  if (!row) throw notFound('Hadith');
  ok(res, serializeHadith(row, true));
});

// ---------------- verification (§15) ----------------
const TYPES = ['manual_sample', 'hash_check', 'structural', 'external_source'] as const;
const RESULTS = ['passed', 'failed', 'inconclusive'] as const;

/**
 * verified=true is only ever the outcome of a recorded verification whose
 * content_hash still matches the stored text. No endpoint can touch the text.
 */
post('/api/v1/admin/hadiths/:id/verify', async ({ res, req, params, requestId }) => {
  const actor = admin(req);
  const id = uuidParam(params['id'] as string);
  const body = (await readJsonBody(req)) as Record<string, unknown>;

  const type = String(body['verification_type'] ?? '');
  if (!(TYPES as readonly string[]).includes(type)) {
    throw badRequest(`"verification_type" must be one of: ${TYPES.join(', ')}`);
  }
  const result = String(body['result'] ?? 'passed');
  if (!(RESULTS as readonly string[]).includes(result)) {
    throw badRequest(`"result" must be one of: ${RESULTS.join(', ')}`);
  }
  const verifiedBy = typeof body['verified_by'] === 'string' ? body['verified_by'].trim() : '';
  if (!verifiedBy) throw badRequest('"verified_by" is required (a human or pipeline identity)');
  const claimedHash = typeof body['content_hash'] === 'string' ? body['content_hash'] : null;

  const row = await queryOne<{ content_hash: string }>(
    'select content_hash from corpus.hadiths where id = $1',
    [id],
  );
  if (!row) throw notFound('Hadith');
  if (claimedHash && claimedHash !== row.content_hash) {
    throw new ApiError('SOURCE_LOCKED', 'content_hash mismatch: the stored text is not the one verified');
  }

  // A machine hash check never makes a hadith "verified" — only a human sample
  // check or an external-source check can (§48: imported ≠ verified).
  const HUMAN_TYPES = ['manual_sample', 'external_source'];
  const status =
    result === 'failed'
      ? 'rejected'
      : result === 'inconclusive'
        ? 'needs_review'
        : HUMAN_TYPES.includes(type)
          ? 'verified'
          : 'pending';

  const record = await queryOne(
    `insert into corpus.verification_records
       (hadith_id, verification_type, verified_by, source_reference, notes, content_hash, result)
     values ($1, $2, $3, $4, $5, $6, $7) returning *`,
    [
      id,
      type,
      verifiedBy,
      typeof body['source_reference'] === 'string' ? body['source_reference'] : null,
      typeof body['notes'] === 'string' ? body['notes'] : null,
      row.content_hash,
      result,
    ],
  );

  await query(
    'update corpus.hadiths set verification_status = $2, verified = $3 where id = $1',
    [id, status, status === 'verified'],
  );
  await audit(actor, 'hadith.verify', 'hadith', id, { result, type }, requestId);
  ok(res, { verification: record, verification_status: status, verified: status === 'verified' }, undefined, 201);
});

get('/api/v1/admin/verifications', async ({ res, req, query: q }) => {
  admin(req);
  const { page, limit, offset } = pagination(q);
  const hadithId = optionalText(q, 'hadith_id', 64);
  const resultFilter = optionalEnum(q, 'result', RESULTS);
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (hadithId) {
    params.push(uuidParam(hadithId, 'hadith_id'));
    clauses.push(`hadith_id = $${params.length}`);
  }
  if (resultFilter) {
    params.push(resultFilter);
    clauses.push(`result = $${params.length}`);
  }
  const where = clauses.length ? `where ${clauses.join(' and ')}` : '';
  const total =
    (await queryOne<{ total: number }>(`select count(*)::int as total from corpus.verification_records ${where}`, params))
      ?.total ?? 0;
  params.push(limit, offset);
  const rows = await query(
    `select * from corpus.verification_records ${where}
     order by verification_date desc limit $${params.length - 1} offset $${params.length}`,
    params,
  );
  paginated(res, rows, page, limit, total);
});
