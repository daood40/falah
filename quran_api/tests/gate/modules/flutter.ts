/**
 * Category: flutter — the Flutter client. The Dart test suite needs a Flutter
 * SDK, which is not installed in this environment, so those runs are recorded
 * BLOCKED (never PASS). Everything that can be checked without the SDK is
 * checked for real: every Dart source file is read and audited against the
 * repository's own rules, and every client config is validated.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { GateContext } from '../context.ts';

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

  // The Dart test suite itself cannot run here.
  const testFiles = walk(path.join(root, 'test'));
  for (const file of testFiles) {
    const relative = path.relative(root, file);
    gate.blocked(
      `FL-DARTTEST-${relative.replace(/[^a-z0-9]/gi, '-')}`,
      CATEGORY,
      `flutter test ${relative}`,
      'No Flutter SDK in this environment (flutter/dart are not installed and the SDK download host is outside the egress policy). Run on a machine with Flutter, or in CI where the SDK is provisioned.',
    );
  }
  gate.blocked('FL-BUILD-WEB', CATEGORY, 'flutter build web', 'No Flutter SDK in this environment.');
  gate.blocked('FL-BUILD-APK', CATEGORY, 'flutter build apk', 'No Flutter SDK and no Android SDK in this environment.');
  gate.blocked('FL-ANALYZE', CATEGORY, 'flutter analyze', 'No Flutter SDK in this environment.');
}
