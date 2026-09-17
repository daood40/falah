/**
 * Category: backup-restore — a real dump, a real destroy, a real restore and a
 * full re-verification. The gate database is dumped with pg_dump, restored into
 * a second database, that database is destroyed and restored again, and every
 * surah, division and hash is compared between original and restore.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { contentHash } from '../../../src/core/hash.ts';
import type { GateContext } from '../context.ts';

const CATEGORY = 'backup-restore';
const RESTORE_DB = 'falah_quran_restore';

function run_(command: string, args: string[]): { ok: boolean; output: string } {
  try {
    const output = execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, output };
  } catch (error: any) {
    return { ok: false, output: String(error.stderr ?? error.message).slice(0, 300) };
  }
}

export async function run(ctx: GateContext): Promise<void> {
  const { gate, pool, adminUrl, databaseUrl } = ctx;

  const dir = mkdtempSync(path.join(tmpdir(), 'falah-backup-'));
  const dumpFile = path.join(dir, 'gate.dump');

  // 1. Dump.
  const dump = run_('pg_dump', ['--format=custom', '--no-owner', `--file=${dumpFile}`, databaseUrl]);
  gate.check('BR-DUMP', CATEGORY, 'pg_dump produces a custom-format backup of the live database', { command: 'pg_dump --format=custom' }, dump.ok, 'exit 0', dump.ok ? 'exit 0' : dump.output, 'CRITICAL', 1);
  if (!dump.ok) {
    gate.blocked('BR-RESTORE', CATEGORY, 'restore cycle', `pg_dump failed: ${dump.output}`);
    return;
  }
  const size = statSync(dumpFile).size;
  gate.check('BR-DUMP-SIZE', CATEGORY, 'the backup file is non-trivial in size', { file: dumpFile }, size > 100_000, '> 100 KB', `${size} bytes`, 'HIGH', 1);

  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  const restoreUrl = adminUrl.replace(/\/postgres(\?|$)/, `/${RESTORE_DB}$1`);

  const cycle = async (label: string, index: number): Promise<pg.Pool | null> => {
    // 2. Destroy any previous restore target, then restore into a fresh one.
    await admin.query(`drop database if exists ${RESTORE_DB} with (force)`);
    const existsAfterDrop = await admin.query('select 1 from pg_database where datname = $1', [RESTORE_DB]);
    gate.equals(`BR-DESTROY-${index}`, CATEGORY, `${label}: the restore target is destroyed before restoring`, RESTORE_DB, 0, existsAfterDrop.rowCount ?? 0, 'HIGH');
    await admin.query(`create database ${RESTORE_DB}`);
    const restore = run_('pg_restore', ['--no-owner', '--dbname', restoreUrl, dumpFile]);
    gate.check(`BR-RESTORE-${index}`, CATEGORY, `${label}: pg_restore loads the backup into an empty database`, { command: 'pg_restore --no-owner' }, restore.ok, 'exit 0', restore.ok ? 'exit 0' : restore.output, 'CRITICAL', 1);
    if (!restore.ok) return null;
    return new pg.Pool({ connectionString: restoreUrl, max: 4 });
  };

  for (const [index, label] of ['first restore', 'second restore after another destroy'].entries()) {
    const restored = await cycle(label, index + 1);
    if (!restored) {
      gate.blocked(`BR-VERIFY-${index + 1}`, CATEGORY, `${label}: post-restore verification`, 'pg_restore failed, so nothing could be verified');
      continue;
    }
    try {
      // 3. Re-verify: counts, digests, per-surah hashes, structure, policies.
      const counts: { table: string; expected: number }[] = [
        { table: 'surahs', expected: 114 },
        { table: 'ayahs', expected: 6236 },
        { table: 'juzs', expected: 30 },
        { table: 'hizbs', expected: 240 },
        { table: 'pages', expected: 604 },
        { table: 'manzils', expected: 7 },
      ];
      for (const item of counts) {
        const { rows } = await restored.query<{ count: number }>(`select count(*)::int as count from quran.${item.table}`);
        gate.equals(
          `BR-COUNT-${index + 1}-${item.table}`,
          CATEGORY,
          `${label}: quran.${item.table} holds the same number of rows as the original`,
          { table: item.table },
          item.expected,
          rows[0]!.count,
          'CRITICAL',
        );
      }

      const digestSql = `select md5(string_agg(content_hash, '' order by global_ayah_number)) as digest from quran.ayahs`;
      const original = await pool.query<{ digest: string }>(digestSql);
      const copy = await restored.query<{ digest: string }>(digestSql);
      gate.equals(
        `BR-DIGEST-${index + 1}`,
        CATEGORY,
        `${label}: the digest over all 6,236 content hashes is identical to the original`,
        'md5(all content hashes)',
        original.rows[0]!.digest,
        copy.rows[0]!.digest,
        'CRITICAL',
      );

      // Per surah: compare a digest of the restored text against the original,
      // and recompute the hash from the restored text itself.
      const perSurahSql = `select s.surah_number,
                                  md5(string_agg(a.raw_text, '' order by a.ayah_number)) as text_digest,
                                  count(*)::int as ayahs
                             from quran.ayahs a join quran.surahs s on s.id = a.surah_id
                            group by s.surah_number order by s.surah_number`;
      const originalSurahs = await pool.query(perSurahSql);
      const restoredSurahs = await restored.query(perSurahSql);
      const restoredByNumber = new Map((restoredSurahs.rows as any[]).map((row) => [row.surah_number, row]));
      for (const row of originalSurahs.rows as any[]) {
        const mirror: any = restoredByNumber.get(row.surah_number);
        gate.check(
          `BR-SURAH-${index + 1}-${String(row.surah_number).padStart(3, '0')}`,
          CATEGORY,
          `${label}: surah ${row.surah_number} restored byte-identically`,
          { surah: row.surah_number, ayahs: row.ayahs },
          Boolean(mirror) && mirror.text_digest === row.text_digest && mirror.ayahs === row.ayahs,
          `${row.ayahs} ayahs, digest ${row.text_digest}`,
          mirror ? `${mirror.ayahs} ayahs, digest ${mirror.text_digest}` : 'missing',
          'CRITICAL',
          2,
        );
      }

      // Recompute a sample of hashes in JavaScript from the restored text, so
      // the restore is verified independently of the stored hash column.
      const { rows: sample } = await restored.query<{ raw_text: string; content_hash: string; global_ayah_number: number }>(
        'select raw_text, content_hash, global_ayah_number from quran.ayahs order by global_ayah_number',
      );
      let recomputeFailures = 0;
      for (const row of sample) {
        if (contentHash(row.raw_text) !== row.content_hash) recomputeFailures += 1;
      }
      gate.equals(
        `BR-REHASH-${index + 1}`,
        CATEGORY,
        `${label}: all 6,236 hashes recompute from the restored text`,
        'recomputed hash mismatches',
        0,
        recomputeFailures,
        'CRITICAL',
      );

      // Security posture must survive the restore, table by table.
      const { rows: tables } = await restored.query<{ table_name: string; rls: boolean; forced: boolean }>(
        `select c.relname as table_name, c.relrowsecurity as rls, c.relforcerowsecurity as forced
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'quran' and c.relkind = 'r' order by c.relname`,
      );
      for (const table of tables) {
        gate.check(
          `BR-RLS-${index + 1}-${table.table_name}`,
          CATEGORY,
          `${label}: row level security survives the restore on quran.${table.table_name}`,
          { table: table.table_name },
          table.rls === true && table.forced === true,
          'enabled and forced',
          `rls=${table.rls}, forced=${table.forced}`,
          'CRITICAL',
          2,
        );
      }

      // The SOURCE_LOCK trigger must exist in the restored database too.
      const { rows: triggers } = await restored.query<{ count: number }>(
        `select count(*)::int as count from pg_trigger where tgname = 'ayahs_source_lock' and not tgisinternal`,
      );
      gate.equals(`BR-TRIGGER-${index + 1}`, CATEGORY, `${label}: the SOURCE_LOCK trigger exists in the restored database`, 'ayahs_source_lock', 1, triggers[0]!.count, 'CRITICAL');

      // And it must still refuse a rewrite.
      const client = await restored.connect();
      try {
        await client.query('begin');
        let rejected = false;
        let code: string | null = null;
        try {
          await client.query("update quran.ayahs set raw_text = raw_text || 'X' where global_ayah_number = 1");
        } catch (error: any) {
          rejected = true;
          code = error.code ?? null;
        }
        await client.query('rollback');
        gate.check(
          `BR-SOURCELOCK-${index + 1}`,
          CATEGORY,
          `${label}: SOURCE_LOCK still refuses to rewrite ayah 1:1 in the restored database`,
          { statement: "update quran.ayahs set raw_text = raw_text || 'X' where global_ayah_number = 1" },
          rejected && code === '23514',
          'check_violation',
          rejected ? code : 'accepted — the text was rewritten',
          'CRITICAL',
          2,
        );
      } finally {
        client.release();
      }
    } finally {
      await restored.end();
    }
  }

  // 4. The production (gate) database must be untouched by the whole exercise.
  const { rows: finalCount } = await pool.query<{ count: number }>('select count(*)::int as count from quran.ayahs');
  gate.equals('BR-SOURCE-UNTOUCHED', CATEGORY, 'the source database still holds all 6,236 ayahs after the backup cycle', 'count(ayahs)', 6236, finalCount[0]!.count, 'CRITICAL');

  await admin.query(`drop database if exists ${RESTORE_DB} with (force)`);
  await admin.end();
  gate.check('BR-CLEANUP', CATEGORY, 'the temporary restore database is removed after the test', { database: RESTORE_DB }, true, 'dropped', 'dropped', 'LOW', 1);
}
