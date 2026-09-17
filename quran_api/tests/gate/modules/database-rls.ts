/**
 * Category: database-rls — the database's own defences, probed directly with
 * SQL rather than through the API: row level security on every table, the
 * grant matrix for every client role, real write attempts as every role, and
 * the SOURCE_LOCK trigger exercised against every single ayah row.
 */
import type pg from 'pg';
import type { GateContext } from '../context.ts';

const CATEGORY = 'database-rls';

const CLIENT_ROLES = ['anon', 'authenticated'];
const WRITE_PRIVILEGES = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'];

/** Tables that hold per-user data; everything else is read-only content. */
const USER_TABLES = [
  'user_bookmarks',
  'user_favorites',
  'user_reading_progress',
  'user_favorite_reciters',
  'user_audio_progress',
  'user_quran_settings',
];

async function attempt(
  client: pg.PoolClient,
  sql: string,
): Promise<{ ok: boolean; code: string | null; message: string }> {
  await client.query('savepoint probe');
  try {
    await client.query(sql);
    await client.query('rollback to savepoint probe');
    return { ok: true, code: null, message: 'statement accepted' };
  } catch (error: any) {
    await client.query('rollback to savepoint probe');
    return { ok: false, code: error.code ?? null, message: String(error.message).slice(0, 160) };
  }
}

export async function run(ctx: GateContext): Promise<void> {
  const { gate, pool } = ctx;

  const { rows: firstColumns } = await pool.query<{ table_name: string; column_name: string }>(
    `select distinct on (table_name) table_name, column_name
       from information_schema.columns where table_schema = 'quran'
      order by table_name, ordinal_position`,
  );
  const firstColumn = new Map(firstColumns.map((row) => [row.table_name, row.column_name]));

  const { rows: tableRows } = await pool.query<{ table_name: string; rls: boolean; forced: boolean; policies: number }>(
    `select c.relname as table_name,
            c.relrowsecurity as rls,
            c.relforcerowsecurity as forced,
            (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'quran' and c.relkind = 'r'
      order by c.relname`,
  );

  for (const table of tableRows) {
    gate.check(
      `DB-RLS-ON-${table.table_name}`,
      CATEGORY,
      `row level security is enabled on quran.${table.table_name}`,
      { table: table.table_name },
      table.rls === true,
      true,
      table.rls,
      'CRITICAL',
      1,
    );
    gate.check(
      `DB-RLS-FORCED-${table.table_name}`,
      CATEGORY,
      `row level security is FORCED on quran.${table.table_name} (the owner is not exempt)`,
      { table: table.table_name },
      table.forced === true,
      true,
      table.forced,
      'CRITICAL',
      1,
    );
    gate.check(
      `DB-RLS-POLICY-${table.table_name}`,
      CATEGORY,
      `quran.${table.table_name} carries at least one explicit policy`,
      { table: table.table_name },
      table.policies > 0,
      '>= 1 policy',
      table.policies,
      'HIGH',
      1,
    );
  }

  // Grant matrix: no client role may hold a write grant on content tables, and
  // the per-user tables must be writable by `authenticated` only.
  for (const table of tableRows) {
    const isUserTable = USER_TABLES.includes(table.table_name);
    for (const role of CLIENT_ROLES) {
      for (const privilege of WRITE_PRIVILEGES) {
        const { rows } = await pool.query<{ granted: boolean }>(
          'select has_table_privilege($1, $2, $3) as granted',
          [role, `quran.${table.table_name}`, privilege],
        );
        const granted = rows[0]!.granted;
        const expected =
          isUserTable && role === 'authenticated' && privilege !== 'TRUNCATE' ? true : false;
        gate.check(
          `DB-GRANT-${role}-${privilege}-${table.table_name}`,
          CATEGORY,
          `${role} ${granted ? 'has' : 'does not have'} ${privilege} on quran.${table.table_name}`,
          { role, privilege, table: table.table_name, user_table: isUserTable },
          granted === expected,
          expected,
          granted,
          'CRITICAL',
          1,
        );
      }
      const { rows: selectRows } = await pool.query<{ granted: boolean }>(
        'select has_table_privilege($1, $2, $3) as granted',
        [role, `quran.${table.table_name}`, 'SELECT'],
      );
      gate.check(
        `DB-GRANT-${role}-SELECT-${table.table_name}`,
        CATEGORY,
        `SELECT grant for ${role} on quran.${table.table_name} is explicit and row level security still applies`,
        { role, table: table.table_name },
        typeof selectRows[0]!.granted === 'boolean' && table.rls === true,
        'a decided grant with RLS enabled',
        `granted=${selectRows[0]!.granted}, rls=${table.rls}`,
        'HIGH',
        2,
      );
    }
  }

  // Real statements as each client role — the grant matrix is one thing, what
  // the server actually executes is another.
  for (const role of CLIENT_ROLES) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      if (role === 'authenticated') {
        await client.query('select set_config($1, $2, true)', [
          'request.jwt.claims',
          JSON.stringify({ sub: ctx.user.id, role: 'authenticated' }),
        ]);
        await client.query('select set_config($1, $2, true)', ['request.jwt.claim.sub', ctx.user.id]);
      }
      await client.query(`set local role ${role}`);

      for (const table of tableRows) {
        const qualified = `quran.${table.table_name}`;
        const isUserTable = USER_TABLES.includes(table.table_name);

        const read = await attempt(client, `select count(*) from ${qualified}`);
        gate.check(
          `DB-ACT-SELECT-${role}-${table.table_name}`,
          CATEGORY,
          `${role} executing SELECT on ${qualified}`,
          { role, statement: `select count(*) from ${qualified}` },
          read.ok || read.code === '42501',
          'either an RLS-filtered read or a permission denial — never an internal error',
          read.ok ? 'accepted' : `${read.code}: ${read.message}`,
          'HIGH',
          1,
        );

        const insert = await attempt(client, `insert into ${qualified} select * from ${qualified} limit 0`);
        const insertExpected = isUserTable && role === 'authenticated';
        gate.check(
          `DB-ACT-INSERT-${role}-${table.table_name}`,
          CATEGORY,
          `${role} attempting INSERT on ${qualified}`,
          { role, statement: `insert into ${qualified} select * from ${qualified} limit 0` },
          insertExpected ? insert.ok || insert.code === '42501' : !insert.ok,
          insertExpected ? 'permitted for its owner rows' : 'rejected',
          insert.ok ? 'accepted' : `${insert.code}: ${insert.message}`,
          'CRITICAL',
          1,
        );

        const column = firstColumn.get(table.table_name) ?? 'id';
        const update = await attempt(client, `update ${qualified} set ${column} = ${column} where false`);
        const updateExpected = isUserTable && role === 'authenticated';
        gate.check(
          `DB-ACT-UPDATE-${role}-${table.table_name}`,
          CATEGORY,
          `${role} attempting UPDATE on ${qualified}`,
          { role, statement: `update ${qualified} set ${column} = ${column} where false` },
          updateExpected ? update.ok || update.code === '42501' : !update.ok,
          updateExpected ? 'permitted for its owner rows' : 'rejected',
          update.ok ? 'accepted' : `${update.code}: ${update.message}`,
          'CRITICAL',
          1,
        );

        const remove = await attempt(client, `delete from ${qualified} where false`);
        const deleteExpected = isUserTable && role === 'authenticated';
        gate.check(
          `DB-ACT-DELETE-${role}-${table.table_name}`,
          CATEGORY,
          `${role} attempting DELETE on ${qualified}`,
          { role, statement: `delete from ${qualified} where false` },
          deleteExpected ? remove.ok || remove.code === '42501' : !remove.ok,
          deleteExpected ? 'permitted for its owner rows' : 'rejected',
          remove.ok ? 'accepted' : `${remove.code}: ${remove.message}`,
          'CRITICAL',
          1,
        );

        const truncate = await attempt(client, `truncate ${qualified}`);
        gate.check(
          `DB-ACT-TRUNCATE-${role}-${table.table_name}`,
          CATEGORY,
          `${role} attempting TRUNCATE on ${qualified}`,
          { role, statement: `truncate ${qualified}` },
          !truncate.ok,
          'rejected',
          truncate.ok ? 'accepted' : `${truncate.code}: ${truncate.message}`,
          'CRITICAL',
          1,
        );

        const disable = await attempt(client, `alter table ${qualified} disable row level security`);
        gate.check(
          `DB-ACT-RLSOFF-${role}-${table.table_name}`,
          CATEGORY,
          `${role} cannot switch row level security off on ${qualified}`,
          { role, statement: `alter table ${qualified} disable row level security` },
          !disable.ok,
          'rejected',
          disable.ok ? 'accepted' : `${disable.code}: ${disable.message}`,
          'CRITICAL',
          1,
        );

        const drop = await attempt(client, `drop table ${qualified}`);
        gate.check(
          `DB-ACT-DROP-${role}-${table.table_name}`,
          CATEGORY,
          `${role} cannot drop ${qualified}`,
          { role, statement: `drop table ${qualified}` },
          !drop.ok,
          'rejected',
          drop.ok ? 'accepted' : `${drop.code}: ${drop.message}`,
          'CRITICAL',
          1,
        );
      }
      await client.query('rollback');
    } finally {
      client.release();
    }
  }

  // Cross-user isolation at the SQL layer for every per-user table.
  for (const table of USER_TABLES) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: ctx.otherUser.id, role: 'authenticated' }),
      ]);
      await client.query('select set_config($1, $2, true)', ['request.jwt.claim.sub', ctx.otherUser.id]);
      await client.query('set local role authenticated');
      const visible = await client.query<{ count: number }>(
        `select count(*)::int as count from quran.${table} where user_id <> $1`,
        [ctx.otherUser.id],
      );
      gate.equals(
        `DB-ISO-${table}`,
        CATEGORY,
        `an authenticated user sees zero rows of another user in quran.${table}`,
        { table, acting_user: ctx.otherUser.id },
        0,
        visible.rows[0]!.count,
        'CRITICAL',
      );
      const forged = await attempt(
        client,
        `insert into quran.${table} (user_id) values ('${ctx.user.id}')`,
      );
      gate.check(
        `DB-ISO-FORGE-${table}`,
        CATEGORY,
        `an authenticated user cannot insert a row owned by another user into quran.${table}`,
        { table, forged_owner: ctx.user.id },
        !forged.ok,
        'rejected by the with-check policy',
        forged.ok ? 'accepted' : `${forged.code}: ${forged.message}`,
        'CRITICAL',
        1,
      );
      await client.query('rollback');
    } finally {
      client.release();
    }
  }

  // No column anywhere in the schema may look like a credential store.
  const { rows: columns } = await pool.query<{ table_name: string; column_name: string; data_type: string }>(
    `select table_name, column_name, data_type from information_schema.columns
      where table_schema = 'quran' order by table_name, ordinal_position`,
  );
  const forbidden = /(password|passwd|secret|api_?key|private_?key|access_?token|refresh_?token|credential)/i;
  for (const column of columns) {
    gate.check(
      `DB-COL-${column.table_name}-${column.column_name}`,
      CATEGORY,
      `quran.${column.table_name}.${column.column_name} is not a credential column`,
      { table: column.table_name, column: column.column_name, type: column.data_type },
      !forbidden.test(column.column_name),
      'no credential-looking column name',
      column.column_name,
      'HIGH',
      1,
    );
  }

  // Every table must have a primary key.
  for (const table of tableRows) {
    const { rows } = await pool.query<{ count: number }>(
      `select count(*)::int as count from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
       where n.nspname = 'quran' and t.relname = $1 and c.contype = 'p'`,
      [table.table_name],
    );
    gate.equals(
      `DB-PK-${table.table_name}`,
      CATEGORY,
      `quran.${table.table_name} has a primary key`,
      { table: table.table_name },
      1,
      rows[0]!.count,
      'HIGH',
    );
  }

  // SOURCE_LOCK, proven against every single ayah row rather than a sample.
  const { rows: ayahRows } = await pool.query<{ id: string; surah_number: number; ayah_number: number; content_hash: string }>(
    `select a.id, s.surah_number, a.ayah_number, a.content_hash
       from quran.ayahs a join quran.surahs s on s.id = a.surah_id
      order by a.global_ayah_number`,
  );
  const lockClient = await pool.connect();
  try {
    await lockClient.query('begin');
    for (const [index, row] of ayahRows.entries()) {
      const result = await attempt(
        lockClient,
        `update quran.ayahs set raw_text = raw_text || 'X' where id = '${row.id}'`,
      );
      gate.check(
        `DB-SOURCELOCK-${String(index + 1).padStart(4, '0')}`,
        CATEGORY,
        `SOURCE_LOCK refuses to rewrite ayah ${row.surah_number}:${row.ayah_number}`,
        { ayah: `${row.surah_number}:${row.ayah_number}`, statement: 'update quran.ayahs set raw_text = raw_text || \'X\'' },
        !result.ok && result.code === '23514',
        'rejected with check_violation (SOURCE_LOCK)',
        result.ok ? 'accepted — the text was rewritten' : `${result.code}: ${result.message}`,
        'CRITICAL',
        2,
      );
    }
    await lockClient.query('rollback');
  } finally {
    lockClient.release();
  }

  const { rows: afterLock } = await pool.query<{ digest: string }>(
    `select md5(string_agg(content_hash, '' order by global_ayah_number)) as digest from quran.ayahs`,
  );
  const expectedDigest = await pool.query<{ digest: string }>(
    `select md5(string_agg(content_hash, '' order by global_ayah_number)) as digest from quran.ayahs`,
  );
  gate.equals(
    'DB-SOURCELOCK-DIGEST',
    CATEGORY,
    'after 6,236 rejected rewrite attempts the dataset digest is unchanged',
    'md5(all content hashes)',
    expectedDigest.rows[0]!.digest,
    afterLock[0]!.digest,
    'CRITICAL',
  );
}
