/**
 * Category: flutter — the Flutter client.
 *
 * Every Dart source file is audited against the repository's own rules, and the
 * Flutter toolchain is then driven for real: pub get, gen-l10n, analyze, the
 * whole Dart test suite (one gate case per Dart test, parsed from
 * `flutter test --machine`) and a web build. The module requires the SDK — it
 * never records a BLOCKED case — so it must run where Flutter exists (the
 * gate-flutter job in .github/workflows/quality-gate.yml).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { GateContext } from '../context.ts';

type Run = { ok: boolean; code: number | null; stdout: string; stderr: string };

function flutter(root: string, args: string[], timeout = 1_200_000): Run {
  const result = spawnSync('flutter', args, {
    cwd: root,
    encoding: 'utf8',
    timeout,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: 'true' },
  });
  return {
    ok: result.status === 0,
    code: result.status,
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? '').slice(0, 4000),
  };
}

const CATEGORY = 'flutter';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.dart')) out.push(full);
  }
  return out;
}

export async function run(ctx: GateContext): Promise<void> {
  const { gate } = ctx;
  const root = path.join(import.meta.dirname, '..', '..', '..', '..', 'flutter_app');

  const files = [...walk(path.join(root, 'lib')), ...walk(path.join(root, 'test'))].sort();
  gate.check('FL-FILES', CATEGORY, 'the Flutter client has Dart sources to audit', { root }, files.length > 0, '> 0 dart files', files.length, 'HIGH', 1);

  for (const file of files) {
    const relative = path.relative(root, file);
    const id = relative.replace(/[^a-z0-9]/gi, '-');
    const source = readFileSync(file, 'utf8');
    const lines = source.split('\n');

    gate.check(`FL-NONEMPTY-${id}`, CATEGORY, `${relative} is not an empty file`, { file: relative }, source.trim().length > 0, 'non-empty', `${source.length} bytes`, 'MEDIUM', 1);

    gate.check(
      `FL-SECRET-${id}`,
      CATEGORY,
      `${relative} contains no embedded key, token or service-role secret`,
      { file: relative },
      !/(SUPABASE_SERVICE_ROLE_KEY|service_role|eyJhbGciOi|sk_live_|-----BEGIN [A-Z ]*PRIVATE KEY)/.test(source),
      'no secret material',
      'scanned',
      'CRITICAL',
      5,
    );

    // Shipped code must not point at a plain-http host. Test sources are
    // exempt: they assert that such urls are REJECTED, so they must name one.
    gate.check(
      `FL-HTTPS-${id}`,
      CATEGORY,
      `${relative} hardcodes no insecure http:// endpoint`,
      { file: relative },
      relative.startsWith('test/') || !/'http:\/\/(?!localhost|127\.0\.0\.1|10\.0\.2\.2)/.test(source),
      'no plain-http remote url in shipped code',
      'scanned',
      'HIGH',
      1,
    );

    gate.check(
      `FL-RTL-${id}`,
      CATEGORY,
      `${relative} uses directional insets rather than left/right (the app is RTL)`,
      { file: relative },
      !/EdgeInsets\.(only|fromLTRB)\([^)]*\b(left|right):/.test(source),
      'EdgeInsetsDirectional only',
      'scanned',
      'HIGH',
      1,
    );

    gate.check(
      `FL-PRINT-${id}`,
      CATEGORY,
      `${relative} leaves no print() call in the shipped client`,
      { file: relative },
      !/(^|\s)print\(/m.test(source),
      'no print()',
      'scanned',
      'MEDIUM',
      1,
    );

    gate.check(
      `FL-TODO-${id}`,
      CATEGORY,
      `${relative} carries no unfinished TODO or FIXME marker`,
      { file: relative },
      !/(TODO|FIXME)\b/.test(source),
      'no TODO/FIXME',
      'scanned',
      'MEDIUM',
      1,
    );

    const braces = [...source].reduce((count, character) => count + (character === '{' ? 1 : character === '}' ? -1 : 0), 0);
    gate.equals(`FL-BRACES-${id}`, CATEGORY, `${relative} has balanced braces`, { file: relative }, 0, braces, 'MEDIUM');

    const parens = [...source].reduce((count, character) => count + (character === '(' ? 1 : character === ')' ? -1 : 0), 0);
    gate.equals(`FL-PARENS-${id}`, CATEGORY, `${relative} has balanced parentheses`, { file: relative }, 0, parens, 'MEDIUM');

    gate.check(`FL-NEWLINE-${id}`, CATEGORY, `${relative} ends with a newline`, { file: relative }, source.endsWith('\n'), 'trailing newline', JSON.stringify(source.slice(-1)), 'LOW', 1);

    gate.check(`FL-TABS-${id}`, CATEGORY, `${relative} uses spaces, not tabs`, { file: relative }, !source.includes('\t'), 'no tab characters', 'scanned', 'LOW', 1);

    const trailing = lines.filter((line) => /\s+$/.test(line)).length;
    gate.equals(`FL-TRAILWS-${id}`, CATEGORY, `${relative} has no trailing whitespace`, { file: relative }, 0, trailing, 'LOW');

    // Every relative import must point at a file that exists.
    // Anchored at the start of a line so a path quoted inside a doc comment is
    // not mistaken for an import.
    const imports = [...source.matchAll(/^import\s+'((?!package:|dart:)[^']+)'/gm)].map((match) => match[1]!);
    const missing = imports.filter((target) => !existsSync(path.resolve(path.dirname(file), target)));
    gate.equals(
      `FL-IMPORTS-${id}`,
      CATEGORY,
      `${relative}: every relative import resolves to a file that exists`,
      { file: relative, relative_imports: imports.length },
      0,
      missing.length,
      'HIGH',
    );

    // A base url may be mentioned in a comment or a test fixture; what must
    // never happen is a remote host assigned as a default in shipped code.
    const hardcodedDefault = /\b(baseUrl|apiBaseUrl|BASE_URL)\b[^\n]{0,40}=\s*'https?:\/\/(?!localhost|127\.0\.0\.1|10\.0\.2\.2)/i.test(source);
    gate.check(
      `FL-BASEURL-${id}`,
      CATEGORY,
      `${relative} takes the API base url from configuration, never a hardcoded remote host`,
      { file: relative },
      relative.startsWith('test/') || !hardcodedDefault,
      'no remote host assigned as a default base url',
      hardcodedDefault ? 'hardcoded default found' : 'scanned',
      'HIGH',
      1,
    );
  }

  // Screens must implement the four states the repository rules require.
  // The four-state rule applies to screens that load data asynchronously; a
  // purely local screen (a counter, a static list) has no loading or error
  // state to render.
  const screens = files
    .filter((file) => file.endsWith('_screen.dart'))
    .filter((file) => /(AsyncValue|FutureProvider|StreamProvider|\.when\(|FutureBuilder)/.test(readFileSync(file, 'utf8')));
  for (const screen of screens) {
    const relative = path.relative(root, screen);
    const id = relative.replace(/[^a-z0-9]/gi, '-');
    const source = readFileSync(screen, 'utf8');
    const states: { state: string; pattern: RegExp }[] = [
      { state: 'loading', pattern: /(loading|CircularProgressIndicator|isLoading|AsyncLoading)/i },
      { state: 'error', pattern: /(error|AsyncError|onError|hasError)/i },
      { state: 'empty', pattern: /(empty|isEmpty|noResults|لا توجد)/i },
      { state: 'data', pattern: /(data|AsyncData|builder)/i },
    ];
    for (const state of states) {
      // An empty state only exists where the screen renders a variable-length
      // collection; a screen over a fixed catalogue can never be empty.
      if (state.state === 'empty' && !/itemCount:/.test(source)) continue;
      gate.check(
        `FL-STATE-${state.state}-${id}`,
        CATEGORY,
        `${relative} handles the ${state.state} state`,
        { file: relative, state: state.state },
        state.pattern.test(source),
        `a ${state.state} branch`,
        state.pattern.test(source) ? 'present' : 'MISSING',
        'HIGH',
        1,
      );
    }
  }

  // Client configuration files.
  for (const name of ['development.json', 'staging.json', 'production.json']) {
    const file = path.join(root, 'config', name);
    const id = name.replace('.json', '');
    const exists = existsSync(file);
    gate.check(`FL-CONFIG-EXISTS-${id}`, CATEGORY, `config/${name} exists`, { file: `config/${name}` }, exists, 'present', exists ? 'present' : 'missing', 'HIGH', 1);
    if (!exists) continue;
    const raw = readFileSync(file, 'utf8');
    let parsed: any = null;
    let parseOk = true;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parseOk = false;
    }
    gate.check(`FL-CONFIG-JSON-${id}`, CATEGORY, `config/${name} is valid JSON`, { file: `config/${name}` }, parseOk, 'parses', parseOk ? 'parses' : 'invalid JSON', 'HIGH', 1);
    if (!parseOk) continue;
    gate.check(`FL-CONFIG-BASEURL-${id}`, CATEGORY, `config/${name} declares an API base url`, { file: `config/${name}` }, typeof parsed.QURAN_API_BASE_URL === 'string', 'QURAN_API_BASE_URL string', typeof parsed.QURAN_API_BASE_URL, 'HIGH', 1);
    gate.check(
      `FL-CONFIG-SECRET-${id}`,
      CATEGORY,
      `config/${name} carries no secret`,
      { file: `config/${name}` },
      !/(service_role|SERVICE_ROLE|eyJhbGciOi|password)/i.test(raw),
      'no secret material',
      'scanned',
      'CRITICAL',
      3,
    );
    gate.check(
      `FL-CONFIG-HTTPS-${id}`,
      CATEGORY,
      `config/${name} uses https for any non-local host`,
      { file: `config/${name}`, base_url: parsed.QURAN_API_BASE_URL },
      typeof parsed.QURAN_API_BASE_URL !== 'string' ||
        parsed.QURAN_API_BASE_URL === '' ||
        parsed.QURAN_API_BASE_URL.startsWith('https://') ||
        /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)/.test(parsed.QURAN_API_BASE_URL),
      'https, an explicitly local development host, or empty while nothing is deployed',
      parsed.QURAN_API_BASE_URL,
      'HIGH',
      1,
    );
  }

  // pubspec sanity.
  const pubspec = readFileSync(path.join(root, 'pubspec.yaml'), 'utf8');
  const pubspecChecks: { id: string; ok: boolean; description: string; expected: string }[] = [
    { id: 'NAME', ok: /^name:\s*\S+/m.test(pubspec), description: 'pubspec declares a package name', expected: 'a name field' },
    { id: 'SDK', ok: /sdk:\s*['"]?\^?\d/.test(pubspec) || /sdk:\s*['"]?>=/.test(pubspec), description: 'pubspec pins a Dart SDK constraint', expected: 'an sdk constraint' },
    { id: 'RIVERPOD', ok: /riverpod/.test(pubspec), description: 'pubspec declares the state management dependency the app uses', expected: 'riverpod' },
    { id: 'NO-SECRET', ok: !/(service_role|eyJhbGciOi)/.test(pubspec), description: 'pubspec carries no secret', expected: 'no secret material' },
    { id: 'LOCKFILE', ok: existsSync(path.join(root, 'pubspec.lock')), description: 'the dependency lockfile is committed', expected: 'pubspec.lock present' },
    { id: 'L10N', ok: existsSync(path.join(root, 'l10n.yaml')), description: 'localisation is configured', expected: 'l10n.yaml present' },
    { id: 'ANALYSIS', ok: existsSync(path.join(root, 'analysis_options.yaml')), description: 'static analysis is configured', expected: 'analysis_options.yaml present' },
  ];
  for (const check of pubspecChecks) {
    gate.check(`FL-PUBSPEC-${check.id}`, CATEGORY, check.description, { file: 'pubspec.yaml' }, check.ok, check.expected, check.ok ? 'satisfied' : 'MISSING', 'MEDIUM', 1);
  }

  // ---- the Flutter toolchain, driven for real --------------------------------
  const version = flutter(root, ['--version'], 300_000);
  if (!version.ok) {
    throw new Error(
      'the flutter category requires a Flutter SDK on PATH. Run it in the gate-flutter job (.github/workflows/quality-gate.yml), not on a host without the SDK.',
    );
  }
  gate.check('FL-SDK', CATEGORY, 'a Flutter SDK is available and reports its version', { command: 'flutter --version' }, /Flutter\s+\d+\.\d+/.test(version.stdout), 'a Flutter version banner', version.stdout.split('\n')[0]?.slice(0, 120) ?? '', 'HIGH', 1);

  const pubGet = flutter(root, ['pub', 'get'], 900_000);
  gate.check('FL-PUB-GET', CATEGORY, 'flutter pub get resolves every dependency', { command: 'flutter pub get' }, pubGet.ok, 'exit 0', pubGet.ok ? 'exit 0' : `exit ${pubGet.code}: ${pubGet.stderr.slice(-300)}`, 'CRITICAL', 1);

  const genL10n = flutter(root, ['gen-l10n'], 600_000);
  gate.check('FL-GEN-L10N', CATEGORY, 'the localisation bundle generates from the .arb files', { command: 'flutter gen-l10n' }, genL10n.ok, 'exit 0', genL10n.ok ? 'exit 0' : `exit ${genL10n.code}: ${genL10n.stderr.slice(-300)}`, 'HIGH', 1);

  const analyze = flutter(root, ['analyze'], 900_000);
  const issues = (analyze.stdout.match(/^\s*(info|warning|error)\s+•/gm) ?? []).length;
  gate.check('FL-ANALYZE', CATEGORY, 'flutter analyze reports no issue', { command: 'flutter analyze' }, analyze.ok && issues === 0, 'exit 0 with no issue', `exit ${analyze.code}, ${issues} issue(s)`, 'HIGH', 2);

  // One gate case per Dart test, taken from the machine-readable reporter.
  const dartTests = flutter(root, ['test', '--machine'], 1_800_000);
  const names = new Map<number, string>();
  const suites = new Map<number, string>();
  const testSuite = new Map<number, number>();
  let reported = 0;
  let dartFailures = 0;
  for (const line of dartTests.stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    let event: any;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (event.type === 'suite' && event.suite) {
      suites.set(event.suite.id, String(event.suite.path ?? ''));
    }
    if (event.type === 'testStart' && event.test) {
      names.set(event.test.id, String(event.test.name ?? ''));
      testSuite.set(event.test.id, event.test.suiteID);
    }
    if (event.type === 'testDone' && !event.hidden) {
      const name = names.get(event.testID) ?? `test-${event.testID}`;
      const suitePath = path.relative(root, suites.get(testSuite.get(event.testID) ?? -1) ?? '');
      const passed = event.result === 'success';
      if (!passed) dartFailures += 1;
      reported += 1;
      gate.record({
        test_id: `FL-DART-${suitePath.replace(/[^a-z0-9]/gi, '-')}-${name.slice(0, 60).replace(/[^a-z0-9]/gi, '-')}`,
        category: CATEGORY,
        description: `flutter test — ${suitePath}: ${name}`,
        input: { suite: suitePath, test: name },
        expected: 'success',
        actual: String(event.result),
        assertions: 1,
        status: passed ? 'PASS' : 'FAIL',
        severity: 'HIGH',
      });
    }
  }
  gate.check('FL-DART-SUITE', CATEGORY, 'the whole Dart test suite passes', { command: 'flutter test --machine' }, dartTests.ok && reported > 0 && dartFailures === 0, '> 0 tests, zero failures', `${reported} tests, ${dartFailures} failed, exit ${dartTests.code}`, 'CRITICAL', 2);

  const webBuild = flutter(root, ['build', 'web', '--release'], 1_800_000);
  gate.check('FL-BUILD-WEB', CATEGORY, 'flutter build web --release succeeds', { command: 'flutter build web --release' }, webBuild.ok, 'exit 0', webBuild.ok ? 'exit 0' : `exit ${webBuild.code}: ${webBuild.stderr.slice(-300)}`, 'HIGH', 1);

  const webDir = path.join(root, 'build', 'web');
  const webArtifacts: { id: string; file: string; description: string }[] = [
    { id: 'INDEX', file: 'index.html', description: 'the web build emits an app shell' },
    { id: 'MAIN', file: 'main.dart.js', description: 'the web build emits the compiled application' },
    { id: 'MANIFEST', file: 'manifest.json', description: 'the web build emits a web manifest' },
  ];
  for (const artifact of webArtifacts) {
    const file = path.join(webDir, artifact.file);
    gate.check(`FL-WEB-${artifact.id}`, CATEGORY, artifact.description, { file: `build/web/${artifact.file}` }, existsSync(file), 'present', existsSync(file) ? 'present' : 'MISSING', 'MEDIUM', 1);
  }
  const compiled = existsSync(path.join(webDir, 'main.dart.js')) ? readFileSync(path.join(webDir, 'main.dart.js'), 'utf8') : '';
  gate.check(
    'FL-WEB-NO-SECRET',
    CATEGORY,
    'the compiled web bundle contains no secret',
    { file: 'build/web/main.dart.js' },
    compiled.length > 0 && !/(eyJhbGciOi|service_role|SUPABASE_SERVICE_ROLE_KEY)/.test(compiled),
    'no secret material in the bundle',
    compiled.length > 0 ? 'scanned' : 'bundle missing',
    'CRITICAL',
    3,
  );
}
