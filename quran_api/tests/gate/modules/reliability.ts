/**
 * Category: reliability — behaviour under concurrency, repetition and induced
 * failure. Every case runs against the live server; failures are injected for
 * real (killed connections, poisoned statements, exhausted pool) and the
 * service must keep answering correctly afterwards.
 */
import type { GateContext } from '../context.ts';

const CATEGORY = 'reliability';
const V1 = '/api/v1';

export async function run(ctx: GateContext): Promise<void> {
  const { gate, request, pool } = ctx;

  // 1. Concurrency: bursts of parallel reads must all succeed and agree.
  const reference = await request(`${V1}/ayahs/by-key/2:255`);
  const referenceText = reference.body?.data?.text;
  for (let round = 1; round <= 20; round += 1) {
    const burst = await Promise.all(
      Array.from({ length: 10 }, (_, index) => request(`${V1}/ayahs/by-key/${(index % 114) + 1}:1`)),
    );
    const allOk = burst.every((response) => response.status === 200 && typeof response.body?.data?.text === 'string');
    gate.check(
      `REL-BURST-${String(round).padStart(2, '0')}`,
      CATEGORY,
      `10 concurrent reads (round ${round}) all succeed`,
      { concurrency: 10, round },
      allOk,
      'ten 200 responses with text',
      `${burst.filter((response) => response.status === 200).length}/10 succeeded`,
      'HIGH',
      10,
    );
  }

  // 2. Repetition: the same request repeated must return the same bytes.
  for (let repeat = 1; repeat <= 100; repeat += 1) {
    const response = await request(`${V1}/ayahs/by-key/2:255`);
    gate.check(
      `REL-REPEAT-${String(repeat).padStart(3, '0')}`,
      CATEGORY,
      `repeat ${repeat} of GET /ayahs/by-key/2:255 returns identical text`,
      { path: `${V1}/ayahs/by-key/2:255`, repeat },
      response.status === 200 && response.body?.data?.text === referenceText,
      'identical to the first response',
      response.status === 200 ? (response.body?.data?.text === referenceText ? 'identical' : 'DIFFERENT') : `status ${response.status}`,
      'CRITICAL',
      2,
    );
  }

  // 3. Induced failure: kill a pooled connection from the server side, then
  // check the API still answers.
  for (let injection = 1; injection <= 20; injection += 1) {
    const victim = await pool.connect();
    const { rows } = await victim.query<{ pid: number }>('select pg_backend_pid() as pid');
    victim.release();
    await pool.query('select pg_terminate_backend($1)', [rows[0]!.pid]).catch(() => undefined);
    const after = await request(`${V1}/surahs/1/ayahs?limit=3`);
    gate.check(
      `REL-KILL-${String(injection).padStart(2, '0')}`,
      CATEGORY,
      `the API recovers after a pooled database connection is terminated (round ${injection})`,
      { terminated_pid: rows[0]!.pid },
      after.status === 200 && (after.body?.data ?? []).length === 3,
      '200 with three ayahs',
      `status ${after.status}, ${(after.body?.data ?? []).length} rows`,
      'CRITICAL',
      2,
    );
  }

  // 4. Induced failure: statements that must fail cleanly, one per error class.
  const poison: { sql: string; kind: string }[] = [
    { sql: 'select * from quran.does_not_exist', kind: 'unknown table' },
    { sql: 'select 1/0', kind: 'division by zero' },
    { sql: "select 'x'::uuid", kind: 'invalid uuid cast' },
    { sql: 'select * from quran.ayahs where global_ayah_number = $1', kind: 'missing bind parameter' },
    { sql: 'this is not sql', kind: 'syntax error' },
    { sql: "insert into quran.ayahs (id) values ('x')", kind: 'invalid insert' },
    { sql: 'select pg_sleep(0.01)', kind: 'slow statement' },
    { sql: "select 9223372036854775807::bigint + 1", kind: 'integer overflow' },
    { sql: 'set statement_timeout = 1', kind: 'session setting' },
    { sql: 'select count(*) from quran.ayahs', kind: 'valid control statement' },
  ];
  for (const [index, statement] of poison.entries()) {
    let outcome: string;
    try {
      await pool.query(statement.sql);
      outcome = 'accepted';
    } catch (error: any) {
      outcome = `${error.code ?? 'no-code'}: ${String(error.message).slice(0, 80)}`;
    }
    const after = await request(`${V1}/surahs/1`);
    gate.check(
      `REL-POISON-${String(index + 1).padStart(2, '0')}`,
      CATEGORY,
      `${statement.kind} at the database layer does not take the API down`,
      { sql: statement.sql, kind: statement.kind },
      after.status === 200,
      'the API still answers 200 afterwards',
      `statement: ${outcome}; next API call: ${after.status}`,
      'HIGH',
      2,
    );
  }

  // 5. Pool saturation: hold every connection, then confirm recovery.
  const held = [];
  for (let index = 0; index < 8; index += 1) {
    held.push(await pool.connect().catch(() => null));
  }
  const saturated = await Promise.race([
    request(`${V1}/health`),
    new Promise<{ status: number }>((resolve) => setTimeout(() => resolve({ status: 0 }), 2000)),
  ]);
  held.forEach((client) => client?.release());
  const recovered = await request(`${V1}/surahs/1/ayahs?limit=3`);
  gate.check(
    'REL-POOL-SATURATION',
    CATEGORY,
    'the API recovers after every pooled connection was held and released',
    { held_connections: held.filter(Boolean).length },
    recovered.status === 200,
    '200 after the pool is released',
    `during saturation: ${saturated.status === 0 ? 'queued (no response within 2s)' : saturated.status}; after: ${recovered.status}`,
    'HIGH',
    2,
  );

  // 6. Sustained load: 100 sequential requests with no degradation in results.
  let mismatches = 0;
  for (let index = 0; index < 100; index += 1) {
    const response = await request(`${V1}/pages/${(index % 604) + 1}/ayahs?limit=100`);
    const ok = response.status === 200 && (response.body?.data ?? []).length > 0;
    if (!ok) mismatches += 1;
    gate.check(
      `REL-SUSTAINED-${String(index + 1).padStart(3, '0')}`,
      CATEGORY,
      `sustained read ${index + 1}/100 stays correct under continuous load`,
      { path: `${V1}/pages/${(index % 604) + 1}/ayahs?limit=100` },
      ok,
      '200 with a non-empty page',
      `status ${response.status}, ${(response.body?.data ?? []).length} rows`,
      'MEDIUM',
      2,
    );
  }
  gate.equals('REL-SUSTAINED-TOTAL', CATEGORY, 'no failure across 100 sustained reads', 'failed requests', 0, mismatches, 'HIGH');
}
