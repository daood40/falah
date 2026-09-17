/**
 * Flutter integration family. The Flutter/Dart SDK is not installed in this
 * environment, so the widget/unit suites cannot be EXECUTED here: that is
 * recorded as BLOCKED, never as passed. Everything that can be asserted from
 * the sources is asserted, and one real end-to-end call is made with the same
 * request the Dart client issues, against the deployed staging instance.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import type { Auditor } from './core.ts';
import { http, BASE_URL } from './http.ts';

const APP = '../flutter_app';
const REPRO = 'npm run audit -- --only=flutter';

function read(path: string): string {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

function dartFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const full = `${dir}/${e}`;
    if (statSync(full).isDirectory()) dartFiles(full, acc);
    else if (e.endsWith('.dart')) acc.push(full);
  }
  return acc;
}

export async function runFlutterChecks(audit: Auditor): Promise<void> {
  // The app is a CONSUMER of this service, not part of it. In a standalone
  // checkout of the API it is absent, and this family says so rather than
  // failing checks about code that is not here.
  if (!existsSync(`${APP}/pubspec.yaml`)) {
    audit.skipped('flutter.app_present', 'flutter.project',
      'the consumer application is checked alongside the service',
      'no consumer application in this checkout (the service is standalone here)',
      APP, REPRO);
    await runLiveConsumerChecks(audit);
    return;
  }

  audit.check('flutter.app_present', 'flutter.project',
    'the Flutter application is part of the repository',
    existsSync(`${APP}/pubspec.yaml`), {
      severity: 'HIGH', detail: 'no flutter_app/pubspec.yaml', where: APP, repro: REPRO });

  const pubspec = read(`${APP}/pubspec.yaml`);
  audit.check('flutter.uses_official_client', 'flutter.project',
    'the app consumes the official client package instead of hand-rolled HTTP',
    pubspec.includes('falah_hadith_api'), {
      severity: 'MEDIUM', detail: 'falah_hadith_api not in pubspec',
      where: `${APP}/pubspec.yaml`, repro: REPRO });

  const providers = read(`${APP}/lib/features/hadith/data/hadith_providers.dart`);
  audit.check('flutter.base_url_from_env', 'flutter.config',
    'the API base URL comes from the build environment, never from a literal',
    /String\.fromEnvironment\(\s*'FALAH_API_BASE_URL'/.test(providers), {
      severity: 'HIGH', detail: 'FALAH_API_BASE_URL is not read from the environment',
      where: 'lib/features/hadith/data/hadith_providers.dart', repro: REPRO });
  audit.check('flutter.base_url_guarded', 'flutter.config',
    'the app refuses an unusable base URL instead of silently calling localhost',
    providers.includes('isUsableApiBaseUrl'), {
      severity: 'HIGH', detail: 'no base URL guard',
      where: 'lib/features/hadith/data/hadith_providers.dart', repro: REPRO });

  for (const file of dartFiles(`${APP}/lib`)) {
    const body = read(file);
    audit.check(`flutter.no_secret:${file}`, 'flutter.security',
      'the app carries no server-side credential',
      !/service_role|SERVICE_ROLE|DATABASE_URL|JWT_SECRET|ADMIN_API_KEY/.test(body), {
        severity: 'CRITICAL', detail: 'a server credential appears in the app',
        where: file, repro: REPRO });
    audit.check(`flutter.no_sql:${file}`, 'flutter.security',
      'the app never speaks SQL: it goes through the API',
      !/\bselect\s+[\w*,\s]+\s+from\s+corpus\./i.test(body), {
        severity: 'CRITICAL', detail: 'SQL in the app', where: file, repro: REPRO });
    audit.check(`flutter.no_hadith_literal:${file}`, 'flutter.religious_safety',
      'no hadith text is hard-coded into the app',
      !/قال رسول الله|حدثنا |عن أبي هريرة/.test(body), {
        severity: 'CRITICAL', detail: 'religious text embedded in the client',
        where: file, repro: REPRO });
  }

  const tests = dartFiles(`${APP}/test`);
  audit.check('flutter.tests_exist', 'flutter.tests',
    'the app carries its own tests for the API integration',
    tests.some((f) => f.includes('hadith_api')), {
      severity: 'HIGH', detail: `${tests.length} test file(s)`, where: `${APP}/test`, repro: REPRO });

  let sdk = false;
  try { execFileSync('flutter', ['--version'], { stdio: 'ignore' }); sdk = true; } catch { sdk = false; }
  if (sdk) {
    try {
      execFileSync('flutter', ['test'], { cwd: APP, stdio: 'pipe' });
      audit.check('flutter.suite', 'flutter.tests', 'the Flutter test suite passes', true, {
        where: APP, repro: 'cd flutter_app && flutter test' });
    } catch (err) {
      audit.check('flutter.suite', 'flutter.tests', 'the Flutter test suite passes', false, {
        severity: 'HIGH', detail: String((err as Error).message).slice(0, 300),
        where: APP, repro: 'cd flutter_app && flutter test' });
    }
  } else {
    audit.blocked('flutter.suite', 'flutter.tests',
      'the Flutter unit and live suites pass',
      'no Flutter SDK in this environment; the suites run in CI and on the owner machine',
      APP, 'cd flutter_app && flutter test');
  }

  await runLiveConsumerChecks(audit);
}

/// The requests a client actually issues, made against the deployed instance.
/// These hold whether or not a consumer application sits next to the service.
async function runLiveConsumerChecks(audit: Auditor): Promise<void> {
  const ping = await http('/api/v1/health');
  if (ping.status !== 200) {
    audit.blocked('flutter.live', 'flutter.integration',
      'the requests a client issues answer from a deployed instance',
      `no instance answering at ${BASE_URL} (${ping.status} ${ping.error ?? ''})`,
      BASE_URL, 'bash scripts/staging-up.sh');
    return;
  }

  const live = await http('/api/v1/hadiths?page=1&limit=20');
  const body = live.json as { data?: { id: string; text: unknown; text_available: unknown }[]; meta?: Record<string, unknown> };
  audit.check('flutter.live_list', 'flutter.integration',
    'the list request the app issues answers from the deployed instance',
    live.status === 200 && Array.isArray(body.data) && body.data.length === 20, {
      severity: 'HIGH', detail: `status ${live.status}`, where: BASE_URL, repro: REPRO });
  audit.check('flutter.live_meta', 'flutter.integration',
    'the response carries the pagination fields the Dart models read',
    typeof body.meta?.['current_page'] === 'number' && typeof body.meta?.['total'] === 'number', {
      severity: 'HIGH', detail: JSON.stringify(body.meta), where: BASE_URL, repro: REPRO });
  for (const [i, item] of (body.data ?? []).entries()) {
    audit.check(`flutter.live_item_gate:${i}`, 'flutter.integration',
      'the app receives no hadith text while the licence gate is closed',
      item.text === null && item.text_available === false, {
        severity: 'CRITICAL', detail: JSON.stringify(item).slice(0, 120), where: BASE_URL, repro: REPRO });
  }

  const detail = await http(`/api/v1/hadiths/${(body.data ?? [])[0]?.id}?include=takhrij,gradings,verification`);
  const d = (detail.json as { data?: Record<string, unknown> })?.data ?? {};
  for (const field of ['id', 'location', 'dataset', 'verification', 'source_locked']) {
    audit.check(`flutter.live_detail:${field}`, 'flutter.integration',
      `the detail response carries the "${field}" the Dart model requires`,
      field in d, { severity: 'HIGH', detail: Object.keys(d).join(','), where: BASE_URL, repro: REPRO });
  }
}
