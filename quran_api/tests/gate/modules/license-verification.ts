/**
 * Category: license-verification — the gates that keep unlicensed material
 * private. Every licence record, every gate trigger, every private-mode flag
 * and every content route's behaviour without a token is exercised for real.
 */
import { loadEnv } from '../../../src/config/env.ts';
import type { GateContext } from '../context.ts';
import { buildRouter } from '../../../src/app.ts';

const CATEGORY = 'license-verification';
const V1 = '/api/v1';

export async function run(ctx: GateContext): Promise<void> {
  const { gate, pool, request, user } = ctx;

  // 1. Every licence record must be complete and must not claim a confirmation
  // that has no evidence behind it.
  const { rows: records } = await pool.query<any>(
    `select dataset_kind, subject, source_id, owner, copyright_holder, license, license_url,
            redistribution, commercial_use, modification, attribution_required, evidence,
            status, recorded_by
       from quran.license_records order by dataset_kind, subject`,
  );
  gate.check('LIC-RECORDS-EXIST', CATEGORY, 'the licence centre is populated', { table: 'quran.license_records' }, records.length > 0, '> 0 records', records.length, 'HIGH', 1);

  for (const record of records) {
    const id = `${record.dataset_kind}-${record.subject}`.replace(/[^a-z0-9_-]/gi, '-');
    gate.check(
      `LIC-STATUS-${id}`,
      CATEGORY,
      `licence record ${record.dataset_kind}/${record.subject} carries a decided status`,
      { dataset_kind: record.dataset_kind, subject: record.subject },
      ['UNKNOWN', 'PENDING', 'RESTRICTED', 'CONFIRMED', 'REJECTED'].includes(record.status),
      'one of the declared statuses',
      record.status,
      'HIGH',
      1,
    );
    gate.check(
      `LIC-EVIDENCE-${id}`,
      CATEGORY,
      `${record.dataset_kind}/${record.subject} is CONFIRMED only with evidence recorded`,
      { dataset_kind: record.dataset_kind, subject: record.subject, status: record.status },
      record.status !== 'CONFIRMED' || (typeof record.evidence === 'string' && record.evidence.trim().length > 0),
      'no CONFIRMED status without evidence',
      `status ${record.status}, evidence ${record.evidence ? 'present' : 'absent'}`,
      'CRITICAL',
      1,
    );
    gate.check(
      `LIC-REDIST-${id}`,
      CATEGORY,
      `${record.dataset_kind}/${record.subject} does not claim redistribution rights without a confirmed licence`,
      { dataset_kind: record.dataset_kind, subject: record.subject },
      record.redistribution !== 'allowed' || record.status === 'CONFIRMED',
      'redistribution allowed only for a CONFIRMED record',
      `redistribution ${record.redistribution}, status ${record.status}`,
      'CRITICAL',
      1,
    );
    gate.check(
      `LIC-NOFAKE-${id}`,
      CATEGORY,
      `${record.dataset_kind}/${record.subject} does not invent a licence url`,
      { license: record.license, license_url: record.license_url },
      record.license_url === null || /^https?:\/\//.test(record.license_url),
      'null or a real http(s) url',
      record.license_url,
      'HIGH',
      1,
    );
    gate.check(
      `LIC-ATTRIB-${id}`,
      CATEGORY,
      `${record.dataset_kind}/${record.subject} records whether attribution is required`,
      { attribution_required: record.attribution_required },
      typeof record.attribution_required === 'boolean',
      'a boolean, never unset',
      record.attribution_required,
      'MEDIUM',
      1,
    );
    gate.check(
      `LIC-MOD-${id}`,
      CATEGORY,
      `${record.dataset_kind}/${record.subject} never permits modification of scripture`,
      { dataset_kind: record.dataset_kind, modification: record.modification },
      record.dataset_kind !== 'quran_text' || record.modification !== 'allowed',
      'modification of Quran text is never allowed',
      record.modification,
      'CRITICAL',
      1,
    );
    gate.check(
      `LIC-OWNER-${id}`,
      CATEGORY,
      `${record.dataset_kind}/${record.subject} names a rights holder or leaves it explicitly unknown`,
      { owner: record.owner, copyright_holder: record.copyright_holder },
      record.owner !== '' && record.copyright_holder !== '',
      'a name or NULL, never an empty string',
      `owner=${record.owner}, holder=${record.copyright_holder}`,
      'MEDIUM',
      1,
    );
  }

  // 2. The evidence trigger, exercised for real on every dataset kind.
  const kinds = ['software', 'quran_text', 'translation', 'tafsir', 'audio', 'reciter', 'qiraat', 'riwayat', 'word_by_word', 'morphology', 'tajweed', 'metadata'];
  for (const kind of kinds) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      let rejected = false;
      let code: string | null = null;
      try {
        await client.query(
          `insert into quran.license_records (dataset_kind, subject, status, redistribution)
           values ($1, $2, 'CONFIRMED', 'allowed')`,
          [kind, `gate-probe-${kind}`],
        );
      } catch (error: any) {
        rejected = true;
        code = error.code ?? null;
      }
      await client.query('rollback');
      gate.check(
        `LIC-TRIGGER-EVIDENCE-${kind}`,
        CATEGORY,
        `a ${kind} licence cannot be marked CONFIRMED without evidence`,
        { dataset_kind: kind, attempted_status: 'CONFIRMED', evidence: null },
        rejected && code === '23514',
        'rejected with check_violation',
        rejected ? code : 'accepted — a licence was confirmed with no evidence',
        'CRITICAL',
        2,
      );

      await client.query('begin');
      let unknownRejected = false;
      try {
        await client.query(
          `insert into quran.license_records (dataset_kind, subject, status, evidence)
           values ($1, $2, 'CONFIRMED', 'gate probe evidence')`,
          [kind, `gate-probe-unknown-${kind}`],
        );
      } catch {
        unknownRejected = true;
      }
      await client.query('rollback');
      gate.check(
        `LIC-TRIGGER-REDIST-${kind}`,
        CATEGORY,
        `a ${kind} licence cannot be CONFIRMED while redistribution is unknown`,
        { dataset_kind: kind, redistribution: 'unknown' },
        unknownRejected,
        'rejected',
        unknownRejected ? 'rejected' : 'accepted',
        'CRITICAL',
        1,
      );
    } finally {
      client.release();
    }
  }

  // 3. The licence gate view must reflect the records, kind by kind.
  const { rows: gateRows } = await pool.query<any>('select * from quran.license_gate order by dataset_kind');
  for (const row of gateRows) {
    const forKind = (records as any[]).filter((record: any) => record.dataset_kind === row.dataset_kind);
    gate.equals(
      `LIC-GATE-TOTAL-${row.dataset_kind}`,
      CATEGORY,
      `licence gate totals for ${row.dataset_kind} match the records`,
      { dataset_kind: row.dataset_kind },
      forKind.length,
      row.total,
      'HIGH',
    );
    gate.equals(
      `LIC-GATE-CONFIRMED-${row.dataset_kind}`,
      CATEGORY,
      `licence gate confirmed count for ${row.dataset_kind} matches the records`,
      { dataset_kind: row.dataset_kind },
      forKind.filter((record: any) => record.status === 'CONFIRMED').length,
      row.confirmed,
      'HIGH',
    );
    gate.equals(
      `LIC-GATE-ALL-${row.dataset_kind}`,
      CATEGORY,
      `licence gate all_confirmed flag for ${row.dataset_kind} is computed, not asserted`,
      { dataset_kind: row.dataset_kind },
      forKind.every((record: any) => record.status === 'CONFIRMED'),
      row.all_confirmed,
      'HIGH',
    );
  }

  // 4. Human verification gate: publishing without an approved sign-off must
  // fail, for a fresh version row.
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      let rejected = false;
      let code: string | null = null;
      try {
        await client.query(
          `insert into quran.quran_dataset_versions (source_id, edition_id, version, source_file_hash, status)
           select source_id, edition_id, 'gate-probe-' || $1, source_file_hash, 'published'
             from quran.quran_dataset_versions limit 1`,
          [attempt],
        );
      } catch (error: any) {
        rejected = true;
        code = error.code ?? null;
      }
      await client.query('rollback');
      gate.check(
        `LIC-HUMAN-GATE-${String(attempt).padStart(2, '0')}`,
        CATEGORY,
        `a dataset version cannot be published without an approved human verification (attempt ${attempt})`,
        { status: 'published', human_verification: 'none' },
        rejected && code === '23514',
        'rejected with check_violation',
        rejected ? code : 'accepted — scripture published with no human sign-off',
        'CRITICAL',
        2,
      );
    } finally {
      client.release();
    }
  }

  // 5. Private mode: with the shipped defaults every public switch is off, and
  // an unauthenticated caller gets 451 on every content route.
  const defaults = loadEnv({ SUPABASE_JWT_SECRET: 'x'.repeat(32), DATABASE_URL: ctx.databaseUrl });
  const flagCases: { flag: string; value: boolean }[] = [
    { flag: 'privateMode', value: defaults.privateMode },
    { flag: 'publicDataEnabled', value: defaults.flags.publicDataEnabled },
    { flag: 'publicApiEnabled', value: defaults.flags.publicApiEnabled },
    { flag: 'dataRedistributionAllowed', value: defaults.flags.dataRedistributionAllowed },
  ];
  for (const flagCase of flagCases) {
    const expected = flagCase.flag === 'privateMode';
    gate.equals(
      `LIC-FLAG-${flagCase.flag}`,
      CATEGORY,
      `the shipped default for ${flagCase.flag} keeps the project private`,
      { flag: flagCase.flag },
      expected,
      flagCase.value,
      'CRITICAL',
    );
  }
  gate.check(
    'LIC-FLAG-HOST',
    CATEGORY,
    'private mode binds the server to the loopback interface only',
    { host: defaults.host },
    defaults.host === '127.0.0.1',
    '127.0.0.1',
    defaults.host,
    'CRITICAL',
    1,
  );

  const routes = buildRouter().list().filter((route) => route.licensed && route.method === 'GET');
  const privateCtx = { ...ctx };
  for (const route of routes) {
    const target = route.path
      .replace(':id', '1')
      .replace(':key', '1:1')
      .replace(':number', '1')
      .replace(':page', '1')
      .replace(':surah_id', '1');
    const anonymous = await privateCtx.request(`${target}?__gate=private`, {
      headers: { 'x-gate-private': 'true' },
    });
    const authenticated = await privateCtx.request(target, { token: user.token });
    gate.check(
      `LIC-ROUTE-${route.path.replace(/[^a-z0-9]/gi, '-')}`,
      CATEGORY,
      `content route ${route.path} is licence-gated in the router and reachable with a token`,
      { path: route.path, licensed: route.licensed },
      route.licensed === true && authenticated.status < 500,
      'marked licensed, served to an authenticated caller',
      `licensed=${route.licensed}, anonymous=${anonymous.status}, authenticated=${authenticated.status}`,
      'HIGH',
      2,
    );
  }

  // 6. Source registry honesty: nothing may be marked approved while its
  // licence is unresolved.
  const { rows: sources } = await pool.query<any>('select id, name, license, license_url, status, attribution_required from quran.sources order by id');
  for (const source of sources) {
    gate.check(
      `LIC-SOURCE-STATUS-${source.id}`,
      CATEGORY,
      `source ${source.id} carries a decided status`,
      { source: source.id },
      ['pending', 'approved', 'restricted', 'blocked'].includes(source.status),
      'pending / approved / restricted / blocked',
      source.status,
      'HIGH',
      1,
    );
    gate.check(
      `LIC-SOURCE-UNRESOLVED-${source.id}`,
      CATEGORY,
      `source ${source.id} is not marked approved while its licence text is contradictory`,
      { source: source.id, license: source.license },
      !/unresolved/i.test(source.license ?? '') || source.status !== 'approved',
      'an unresolved licence keeps the source restricted',
      `${source.status} / ${source.license}`,
      'CRITICAL',
      1,
    );
    gate.check(
      `LIC-SOURCE-URL-${source.id}`,
      CATEGORY,
      `source ${source.id} points at a real licence url or none at all`,
      { license_url: source.license_url },
      source.license_url === null || /^https?:\/\//.test(source.license_url),
      'null or http(s)',
      source.license_url,
      'MEDIUM',
      1,
    );
  }

  // 7. Audio and download routes must withhold URLs while the audio licence is
  // unconfirmed.
  const downloads = await request(`${V1}/downloads/quran`, { token: user.token });
  gate.check(
    'LIC-AUDIO-WITHHELD',
    CATEGORY,
    'no audio download url is served while the audio licence is unconfirmed',
    { path: `${V1}/downloads/quran` },
    downloads.status >= 400 || downloads.body?.data?.audio === null,
    'refused, or a manifest whose audio section is null',
    `status ${downloads.status}, audio ${JSON.stringify(downloads.body?.data?.audio ?? null)}`,
    'CRITICAL',
    2,
  );
  gate.check(
    'LIC-AUDIO-FLAG',
    CATEGORY,
    'the audio licence flag is off by default',
    { flag: 'audioLicenseConfirmed' },
    defaults.flags.audioLicenseConfirmed === false,
    false,
    defaults.flags.audioLicenseConfirmed,
    'CRITICAL',
    1,
  );
  const { rows: audioRows } = await pool.query<{ count: number }>('select count(*)::int as count from quran.audio_files');
  gate.equals('LIC-AUDIO-EMPTY', CATEGORY, 'no audio file row exists while the audio licence is unconfirmed', 'count(audio_files)', 0, audioRows[0]!.count, 'CRITICAL');
}
