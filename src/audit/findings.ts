/**
 * The defects this pre-launch audit found, with what was done about each one.
 * A finding is only listed here once its fix is in the repository AND the check
 * that caught it passes again, so the list and the run always agree.
 */
export interface FixedFinding {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  /** How the audit detected it. */
  detectedBy: string;
  cause: string;
  where: string;
  repro: string;
  fix: string;
  retest: string;
}

export const FIXED_FINDINGS: FixedFinding[] = [
  {
    id: 'QA-1',
    severity: 'HIGH',
    title: 'two printed ornaments were stored as hadiths',
    detectedBy: 'data.text_shape — per-record check that stored text is Arabic prose',
    cause:
      'the Shamela adapter treated any bullet line as a record and only skipped the '
      + '"• * *" form, so the ornament "• • •" on ج11/ص195 and ج11/ص278 became two records '
      + 'whose raw_text was "• •" — served by the API as if they were narrations.',
    where: 'src/importer/adapters/jami_kamil_shamela.ts',
    repro: 'GET /api/v1/hadiths?volume=11 and look for ج11/ص195/#1 in the V1 dataset',
    fix:
      'a bullet line carrying no Arabic letter is an ornament, not a record. Locked text is '
      + 'never edited in place, so the correction is a new sealed dataset JAMI-KAMIL-1437-V2 '
      + '(15,959 records) re-imported from the same, byte-identical source files; V1 is kept '
      + 'as superseded with its own fingerprint (migrations/0012_dataset_v2.sql).',
    retest:
      'PASS — 15,959/15,959 verbatim, 15,959/15,959 page match, 15,959/15,959 hashes; '
      + 'tests/audit-regressions.test.ts "QA-1"; data.text_shape 15,959/15,959 PASS',
  },
  {
    id: 'QA-2',
    severity: 'HIGH',
    title: 'a malformed percent-escape in a path returned 500',
    detectedBy: 'security.fuzz — path-segment fuzzing',
    cause: 'decodeURIComponent() threw inside the router, so a caller error surfaced as a server fault',
    where: 'src/http/router.ts',
    repro: 'curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/hadiths/%E0%A4%A"  # was 500',
    fix: 'the router decodes defensively and raises BAD_REQUEST (400) for an invalid escape',
    retest: 'PASS — now 400; tests/audit-regressions.test.ts "QA-2"; 18,615 fuzz checks PASS',
  },
  {
    id: 'QA-3',
    severity: 'HIGH',
    title: 'a NUL byte in a query value reached the database driver and returned 500',
    detectedBy: 'security.fuzz_random — generated payloads containing control characters',
    cause: 'PostgreSQL text cannot hold a NUL byte; the driver failed and the request became a 500',
    where: 'src/http/validate.ts, src/routes/classification.ts',
    repro: 'curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/search?q=%00abc"  # was 500',
    fix: 'text inputs and path names are refused with VALIDATION_ERROR (422) when they carry a control character',
    retest: 'PASS — now 422; tests/audit-regressions.test.ts "QA-3"; 1,800 random-fuzz checks PASS',
  },
  {
    id: 'QA-4',
    severity: 'HIGH',
    title: 'out-of-range integers reached the database and returned 500',
    detectedBy: 'security.fuzz — numeric payload family',
    cause:
      'Number() accepted 9999999999999999999, 2147483648 and 0x27… as integers; PostgreSQL int4 did not',
    where: 'src/http/validate.ts, src/routes/classification.ts',
    repro: 'curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/hadiths?page=9999999999999999999"  # was 500',
    fix: 'only plain decimal integers inside the int4 range are accepted; anything else is a 422',
    retest: 'PASS — now 422; tests/audit-regressions.test.ts "QA-4"',
  },
  {
    id: 'QA-5',
    severity: 'HIGH',
    title: 'the public view was unreadable by the anonymous role',
    detectedBy: 'db.views — reading each view as the anon role',
    cause:
      'corpus.hadiths_public calls corpus.content_license_confirmed(), which reads the '
      + 'operator-only corpus.app_settings, so anon was refused with "permission denied for table app_settings"',
    where: 'migrations/0001_corpus.sql (function), migrations/0010_public_gate_access.sql (fix)',
    repro: "psql -c \"begin; set local role anon; select count(*) from corpus.hadiths_public;\"",
    fix:
      'the gate function is SECURITY DEFINER with a fixed search_path and returns only a boolean; '
      + 'app_settings itself stays closed to the public roles',
    retest: 'PASS — anon reads 15,959 rows with the text withheld; tests/audit-regressions.test.ts "QA-5"',
  },
  {
    id: 'QA-6',
    severity: 'MEDIUM',
    title: 'search took about 3 s for a very common short term',
    detectedBy: 'api.search.latency — per-term latency budget',
    cause:
      'the substring branch matched on an expression index, so every index recheck re-ran three '
      + 'regular expressions over the row text, and the count was a second full pass',
    where: 'migrations/0011_search_normalized_column.sql, src/routes/search.ts',
    repro: 'time curl -s "$BASE/api/v1/search?q=%D9%85%D9%86&limit=20" > /dev/null  # was ~3.0 s',
    fix:
      'the normalized text is stored in a generated column with its own trigram index, and the page '
      + 'and its total are computed in one pass with a window count. raw_text is untouched and '
      + 'content_hash still hashes raw_text alone.',
    retest: 'PASS — 464 ms for the same term, identical totals; 195/195 search latency checks PASS',
  },
  {
    id: 'QA-7',
    severity: 'MEDIUM',
    title: 'the official clients did not cover the whole contract',
    detectedBy: 'project.clients — every public operation matched against the client sources',
    cause:
      'the Dart client had no call for editions, collections, volumes or cross-checks, and the '
      + 'TypeScript client had none for datasets/version, so an integrator had to hand-roll HTTP',
    where: 'clients/dart/lib/src/{models,repository}.dart, clients/typescript/falah-hadith.ts',
    repro: 'npm run audit -- --only=project',
    fix: 'typed models and repository methods were added for all of them; the TS client gained version() and datasets()',
    retest: 'PASS — 95/95 client checks PASS',
  },
  {
    id: 'QA-8',
    severity: 'LOW',
    title: 'the audit itself was not a CI gate',
    detectedBy: 'project.ci — every gate the workflow must run',
    cause: 'the new audit existed only as a local script',
    where: '.github/workflows/hadith_api.yml',
    repro: 'npm run audit -- --only=project',
    fix: 'CI runs "npm run audit -- --only=db,project" on every push; the corpus-dependent families run locally',
    retest: 'PASS — 7/7 CI gate checks PASS',
  },
  {
    id: 'QA-9',
    severity: 'HIGH',
    title: 'the test suite could seed synthetic rows into a release database',
    detectedBy: 'db.dataset — the sealed fingerprint of every dataset, recomputed',
    cause:
      'the suite takes its database from DATABASE_URL and seeds a TEST-FIXTURE edition. Run once '
      + 'with that variable pointing at the release database, it left a sealed TEST-FIXTURE-V1 '
      + 'dataset row behind (7 declared records, 0 rows).',
    where: 'tests/helpers.ts',
    repro: 'DATABASE_URL=<release db> npx vitest run  # used to seed the fixture',
    fix:
      'the suite refuses to start when the database holds any non-TEST dataset; the stray fixture '
      + 'rows were removed from the release database and the sealed fingerprint of '
      + 'JAMI-KAMIL-1437-V2 was re-verified unchanged.',
    retest: 'PASS — 204/204 tests on the scratch database, refusal on the release database, db.dataset 4/4 PASS',
  },
];
