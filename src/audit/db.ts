/**
 * Database-layer checks. Every privilege claim is proved by ATTEMPTING the
 * operation as that role inside a transaction that is always rolled back, so
 * the corpus is never modified — a write that unexpectedly succeeds is rolled
 * back and reported as a failure.
 */
import { getPool, query } from '../db.ts';
import { normalizeArabic } from '../domain/normalize.ts';
import { contentHash } from '../domain/hash.ts';
import { CHECKS } from '../scripts/integrity-checks.ts';
import type { Auditor } from './core.ts';

/** The release under audit; override with DATASET= to audit an older one. */
const DATASET = process.env['DATASET'] ?? 'JAMI-KAMIL-1437-V2';
import { rng, pick } from './core.ts';

const REPRO = 'npm run audit -- --only=db';
const ROLES = ['anon', 'authenticated'] as const;
const WRITE_OPS = ['insert', 'update', 'delete'] as const;
/**
 * Tables the public roles may read directly. Everything else is operator-only
 * or gated: `corpus.hadiths` itself is deliberately unreachable, because the
 * public reads through corpus.hadiths_public, which withholds the text while
 * the licence gate is closed (migrations/0003_rls.sql).
 */
const PUBLIC_READABLE = new Set([
  'sources', 'dataset_versions', 'editions', 'books', 'chapters', 'narrators',
  'hadith_narrators', 'hadith_sources', 'hadith_gradings', 'hadith_references',
  'reference_corpora', 'cross_checks',
]);

/** Runs `fn` as `role` inside a transaction that is rolled back unconditionally. */
async function asRole<T>(role: string, fn: (q: (sql: string, p?: unknown[]) => Promise<unknown>) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${role}`);
    return await fn(async (sql, p = []) => (await client.query(sql, p)).rows);
  } finally {
    await client.query('rollback').catch(() => undefined);
    client.release();
  }
}

/** Counts the rows a role can actually obtain; -1 when the read is refused. */
async function visibleRows(role: string, relation: string): Promise<{ count: number; message: string }> {
  try {
    const rows = await asRole(role, async (q) => q(`select count(*)::int as c from corpus.${relation}`));
    return { count: Number((rows as { c: number }[])[0]?.c ?? 0), message: 'read allowed' };
  } catch (err) {
    return { count: -1, message: (err as Error).message };
  }
}

/** True when the statement was refused (any error). */
async function refused(role: string, sql: string, params: unknown[] = []): Promise<{ refused: boolean; message: string }> {
  try {
    const rows = await asRole(role, async (q) => q(sql, params));
    return { refused: false, message: `statement succeeded, ${(rows as unknown[]).length} row(s) affected` };
  } catch (err) {
    return { refused: true, message: (err as Error).message };
  }
}

export async function runDbChecks(audit: Auditor): Promise<void> {
  const tables = await query<{ relname: string; relrowsecurity: boolean }>(
    `select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'corpus' and c.relkind = 'r' order by relname`,
  );

  // ---- structure -------------------------------------------------------
  for (const t of tables) {
    audit.check(`db.rls_enabled:${t.relname}`, 'db.rls',
      'row level security is enabled on the table', t.relrowsecurity, {
        severity: 'CRITICAL', detail: 'RLS is off', where: `corpus.${t.relname}`, repro: REPRO,
      });

    const pk = await query(
      `select 1 from pg_constraint where conrelid = 'corpus.${t.relname}'::regclass and contype = 'p'`,
    );
    audit.check(`db.primary_key:${t.relname}`, 'db.schema',
      'the table has a primary key', pk.length === 1, {
        severity: 'HIGH', detail: 'no primary key', where: `corpus.${t.relname}`, repro: REPRO,
      });

    const policies = await query<{ policyname: string; cmd: string; roles: string[] }>(
      `select policyname, cmd, roles::text[] from pg_policies where schemaname = 'corpus' and tablename = $1`,
      [t.relname],
    );
    audit.check(`db.has_policy:${t.relname}`, 'db.rls',
      'the table carries at least one explicit policy', policies.length > 0, {
        severity: 'CRITICAL', detail: 'RLS on but no policy: the table is unreachable or unguarded',
        where: `corpus.${t.relname}`, repro: REPRO,
      });

    for (const p of policies) {
      audit.check(`db.policy_scoped:${t.relname}:${p.policyname}`, 'db.rls',
        'the policy names the roles it applies to instead of PUBLIC',
        p.roles.length > 0 && !p.roles.includes('public'), {
          severity: 'HIGH', detail: `policy ${p.policyname} applies to ${p.roles.join(',') || 'public'}`,
          where: `corpus.${t.relname}`, repro: REPRO,
        });
    }
  }

  // every column of every table, individually
  const columns = await query<{ table_name: string; column_name: string; data_type: string; is_nullable: string }>(
    `select table_name, column_name, data_type, is_nullable from information_schema.columns
      where table_schema = 'corpus' order by table_name, ordinal_position`,
  );
  const SECRETY = /(password|secret|token|api_key|service_role|private_key)/i;
  for (const c of columns) {
    audit.check(`db.column_not_secret:${c.table_name}.${c.column_name}`, 'db.schema',
      'no column stores a credential in the corpus schema',
      !SECRETY.test(c.column_name), {
        severity: 'CRITICAL', detail: `column ${c.column_name} looks like a credential store`,
        where: `corpus.${c.table_name}`, repro: REPRO,
      });
  }

  // indexes: every one must be valid and ready
  const indexes = await query<{ indexname: string; tablename: string; valid: boolean; ready: boolean }>(
    `select i.relname as indexname, t.relname as tablename, x.indisvalid as valid, x.indisready as ready
       from pg_index x join pg_class i on i.oid = x.indexrelid
       join pg_class t on t.oid = x.indrelid join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'corpus' order by i.relname`,
  );
  for (const i of indexes) {
    audit.check(`db.index_valid:${i.indexname}`, 'db.schema',
      'the index is valid and ready for use', i.valid && i.ready, {
        severity: 'HIGH', detail: `valid=${i.valid} ready=${i.ready}`,
        where: `corpus.${i.tablename}`, repro: REPRO,
      });
  }

  // constraints: each one validated by the server
  const constraints = await query<{ conname: string; rel: string; convalidated: boolean; contype: string }>(
    `select c.conname, t.relname as rel, c.convalidated, c.contype
       from pg_constraint c join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'corpus' order by c.conname`,
  );
  for (const c of constraints) {
    audit.check(`db.constraint_validated:${c.rel}.${c.conname}`, 'db.constraints',
      'the constraint is validated, not merely declared', c.convalidated, {
        severity: 'HIGH', detail: `${c.conname} is NOT VALID`, where: `corpus.${c.rel}`, repro: REPRO,
      });
  }

  // views
  const views = await query<{ viewname: string }>(
    `select viewname from pg_views where schemaname = 'corpus' order by viewname`,
  );
  for (const v of views) {
    const r = await refused('anon', `select * from corpus.${v.viewname} limit 1`);
    audit.check(`db.view_readable:${v.viewname}`, 'db.views',
      'the public view is readable by the anonymous role', !r.refused, {
        severity: 'HIGH', detail: r.message, where: `corpus.${v.viewname}`, repro: REPRO,
      });
    const w = await refused('anon', `delete from corpus.${v.viewname}`);
    audit.check(`db.view_readonly:${v.viewname}`, 'db.views',
      'the anonymous role cannot write through the view', w.refused, {
        severity: 'CRITICAL', detail: w.message, where: `corpus.${v.viewname}`, repro: REPRO,
      });
  }

  // ---- privilege matrix, proved by attempting each operation ------------
  for (const t of tables) {
    for (const role of ROLES) {
      const read = await visibleRows(role, t.relname);
      const isPublic = PUBLIC_READABLE.has(t.relname);
      audit.check(`db.priv:${role}:select:${t.relname}`, 'db.privileges',
        isPublic
          ? `the ${role} role can read this public catalogue table`
          : `the ${role} role obtains no rows from this gated table`,
        isPublic ? read.count >= 0 : read.count <= 0, {
          severity: isPublic ? 'HIGH' : 'CRITICAL',
          detail: `${read.message} (rows visible: ${read.count})`,
          where: `corpus.${t.relname}`, repro: REPRO,
        });

      for (const op of WRITE_OPS) {
        const sql = op === 'insert'
          ? `insert into corpus.${t.relname} default values`
          : op === 'update'
            ? `update corpus.${t.relname} set created_at = created_at`
            : `delete from corpus.${t.relname}`;
        const r = await refused(role, sql);
        audit.check(`db.priv:${role}:${op}:${t.relname}`, 'db.privileges',
          `the ${role} role cannot ${op} into the table`, r.refused, {
            severity: 'CRITICAL', detail: r.message, where: `corpus.${t.relname}`, repro: REPRO,
          });
      }
    }
  }

  // ---- SOURCE_LOCK, proved on real records (always rolled back) ---------
  const sample = await query<{ id: string; raw_text: string; source_locator: string }>(
    `select id, raw_text, source_locator from corpus.hadiths order by id limit 300`,
  );
  for (const row of sample) {
    const upd = await refused('falah', `update corpus.hadiths set raw_text = raw_text || 'X' where id = $1`, [row.id]);
    audit.check(`db.source_lock_update:${row.source_locator}`, 'db.source_lock',
      'the database refuses to modify locked scripture even for the owner role',
      upd.refused, { severity: 'CRITICAL', detail: upd.message, where: 'corpus.enforce_source_lock()', repro: REPRO });

    const del = await refused('falah', `delete from corpus.hadiths where id = $1`, [row.id]);
    audit.check(`db.source_lock_delete:${row.source_locator}`, 'db.source_lock',
      'the database refuses to delete locked scripture even for the owner role',
      del.refused, { severity: 'CRITICAL', detail: del.message, where: 'corpus.refuse_locked_delete()', repro: REPRO });
  }

  // ---- normalize_ar parity: SQL and TypeScript must agree --------------
  const rand = rng(20_260_917);
  const words = await query<{ w: string }>(
    `select distinct substring(raw_text from 1 for 60) as w from corpus.hadiths order by w limit 400`,
  );
  const EXTRAS = ['أبجد', '١٢٣', 'آل', 'ة', 'ى', '  ', 'abc 123', ''];
  const samples = [...words.map((w) => w.w), ...EXTRAS];
  for (const [i, s] of samples.entries()) {
    const mutated = rand() < 0.5 ? s : `${s} ${pick(rand, EXTRAS)}`;
    const row = await query<{ n: string }>('select corpus.normalize_ar($1) as n', [mutated]);
    audit.check(`db.normalize_parity:${i}`, 'db.normalization',
      'corpus.normalize_ar() and the TypeScript normalizer return the same string',
      row[0]?.n === normalizeArabic(mutated), {
        severity: 'HIGH',
        detail: `sql=${JSON.stringify(row[0]?.n)} ts=${JSON.stringify(normalizeArabic(mutated))}`,
        where: 'migrations/0003_search.sql vs src/domain/normalize.ts', repro: REPRO,
      });
  }

  // ---- hash function parity -------------------------------------------
  for (const [i, row] of sample.slice(0, 100).entries()) {
    const r = await query<{ h: string }>('select corpus.sha256_hex($1) as h', [row.raw_text]);
    audit.check(`db.sha256_parity:${i}`, 'db.normalization',
      'corpus.sha256_hex() equals the Node SHA-256 of the same text',
      r[0]?.h === contentHash(row.raw_text), {
        severity: 'CRITICAL', detail: `sql=${r[0]?.h} node=${contentHash(row.raw_text)}`,
        where: 'migrations/0001_corpus.sql', repro: REPRO,
      });
  }

  // ---- dataset seal ----------------------------------------------------
  const datasets = await query<{ version: string; dataset_hash: string | null; status: string; record_count: number | null }>(
    `select version, dataset_hash, status, record_count from corpus.dataset_versions order by version`,
  );
  for (const d of datasets) {
    // A TEST-* dataset is a fixture the suite seeds and wipes; it is not a
    // release, and its fingerprint says nothing about the corpus.
    if (d.version.startsWith('TEST-')) {
      audit.skipped(`db.dataset_hash:${d.version}`, 'db.dataset',
        'the sealed dataset fingerprint still equals a freshly computed one',
        'test fixture, not a release', 'corpus.dataset_versions', REPRO);
      audit.skipped(`db.dataset_count:${d.version}`, 'db.dataset',
        'the sealed record count still equals the rows in the corpus',
        'test fixture, not a release', 'corpus.dataset_versions', REPRO);
      continue;
    }
    const live = await query<{ h: string; c: number }>(
      `select corpus.compute_dataset_hash($1) as h, count(*)::int as c from corpus.hadiths where dataset_version = $1`,
      [d.version],
    );
    audit.check(`db.dataset_hash:${d.version}`, 'db.dataset',
      'the sealed dataset fingerprint still equals a freshly computed one',
      d.status !== 'sealed' || live[0]?.h === d.dataset_hash, {
        severity: 'CRITICAL', detail: `stored ${d.dataset_hash} vs recomputed ${live[0]?.h}`,
        where: 'corpus.dataset_versions', repro: REPRO,
      });
    audit.check(`db.dataset_count:${d.version}`, 'db.dataset',
      'the sealed record count still equals the rows in the corpus',
      d.status !== 'sealed' || live[0]?.c === d.record_count, {
        severity: 'CRITICAL', detail: `declared ${d.record_count} vs actual ${live[0]?.c}`,
        where: 'corpus.dataset_versions', repro: REPRO,
      });
  }

  // ---- the 21 integrity rules -----------------------------------------
  for (const rule of CHECKS) {
    const offenders = await query(rule.sql);
    audit.check(`db.integrity_rule:${rule.name}`, 'db.integrity_rules',
      rule.name, offenders.length === 0, {
        severity: rule.level === 'warn' ? 'LOW' : 'HIGH',
        detail: `${offenders.length} offending row(s)`,
        where: 'src/scripts/integrity-checks.ts', repro: 'npm run verify',
      });
  }

  // ---- query plans: the hot paths must use an index --------------------
  const realBook = (await query<{ id: string }>('select id from corpus.books limit 1'))[0]?.id;
  const realChapter = (await query<{ id: string }>('select id from corpus.chapters limit 1'))[0]?.id;
  const realNarrator = (await query<{ id: string }>('select id from corpus.narrators limit 1'))[0]?.id;
  const plans: [string, string, unknown[]][] = [
    ['hadith_by_id', `select id from corpus.hadiths where id = $1`, [sample[0]?.id]],
    ['hadith_by_locator', `select id from corpus.hadiths where source_locator = $1 and dataset_version = $2`, [sample[0]?.source_locator, DATASET]],
    ['hadith_by_book', `select id from corpus.hadiths where book_id = $1`, [realBook]],
    ['hadith_by_chapter', `select id from corpus.hadiths where chapter_id = $1`, [realChapter]],
    ['hadith_by_narrator', `select id from corpus.hadiths where narrator_id = $1`, [realNarrator]],
    ['hadith_by_hash', `select id from corpus.hadiths where content_hash = $1`, [sample[0]?.id]],
    ['hadith_reading_order', `select id from corpus.hadiths where volume_number = 3 and page_number = 20`, []],
    ['search_tsv', `select id from corpus.hadiths where search_tsv @@ plainto_tsquery('simple', $1)`, ['\u0627\u0644\u0635\u0644\u0627\u0629']],
    ['search_trgm', `select id from corpus.hadiths where raw_text_normalized like $1`, ['%\u0627\u0644\u0635\u0644\u0627\u0629%']],
  ];
  // An empty database (a fresh checkout, CI) has nothing to plan: the planner
  // answers with a trivial node, and asserting on that would be asserting on
  // emptiness rather than on the indexes.
  const corpusRows = (await query<{ c: number }>('select count(*)::int as c from corpus.hadiths'))[0]?.c ?? 0;
  for (const [name, sql, params] of plans) {
    if (corpusRows === 0) {
      audit.skipped(`db.plan:${name}`, 'db.performance',
        'the hot query path is served by an index, not a sequential scan',
        'no corpus in this database', 'corpus.hadiths indexes', REPRO);
      continue;
    }
    const rows = await query<{ 'QUERY PLAN': string }>(`explain (costs off) ${sql}`, params);
    const plan = rows.map((r) => r['QUERY PLAN']).join('\n');
    audit.check(`db.plan:${name}`, 'db.performance',
      'the hot query path is served by an index, not a sequential scan',
      /Index|Bitmap/.test(plan), {
        severity: 'MEDIUM', detail: plan.split('\n')[0] ?? '', where: 'corpus.hadiths indexes', repro: REPRO,
      });
  }

  // latency budget: a low-selectivity filter is allowed to scan, but must
  // still answer a paged request quickly.
  const budgets: [string, string, unknown[], number][] = [
    ['count_all', 'select count(*) from corpus.hadiths', [], 500],
    ['page_first', `select id from corpus.hadiths order by volume_number, page_number, source_ordinal limit 20`, [], 500],
    ['page_deep', `select id from corpus.hadiths order by volume_number, page_number, source_ordinal offset 15000 limit 20`, [], 800],
    ['pending_filter', `select id from corpus.hadiths where verification_status = 'pending' limit 20`, [], 500],
    ['catalog_view', 'select * from corpus.catalog_view limit 50', [], 1000],
    ['stats_view', 'select * from corpus.stats_view', [], 1500],
    ['verification_state', 'select * from corpus.verification_state', [], 1500],
    ['cross_check_summary', 'select * from corpus.cross_check_summary', [], 1500],
  ];
  for (const [name, sql, params, budget] of budgets) {
    const t0 = Date.now();
    await query(sql, params);
    const ms = Date.now() - t0;
    audit.check(`db.latency:${name}`, 'db.performance',
      `the query answers within its ${budget} ms budget`, ms <= budget, {
        severity: 'MEDIUM', detail: `${ms} ms`, where: 'corpus', repro: REPRO,
      });
  }

  // ---- concurrency: parallel readers observe one consistent corpus -----
  const expectedCount = (await query<{ c: number }>(`select count(*)::int as c from corpus.hadiths`))[0]?.c;
  const concurrent = await Promise.all(
    Array.from({ length: 50 }, (_, i) =>
      query<{ c: number }>(`select count(*)::int as c from corpus.hadiths where page_number >= $1`, [0]).then((r) => ({ i, c: r[0]?.c })),
    ),
  );
  for (const r of concurrent) {
    audit.check(`db.concurrent_read:${r.i}`, 'db.concurrency',
      'a concurrent reader sees the same, complete corpus',
      r.c === expectedCount, {
        severity: 'HIGH', detail: `${r.c} vs ${expectedCount}`, where: 'corpus.hadiths', repro: REPRO,
      });
  }
}
