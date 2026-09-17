/**
 * Category: web — the PWA that ships from this repository. The existing vitest
 * suite is executed for real and every one of its tests is recorded as a case;
 * the static surface (service worker, manifest, robots, icons, sources) is
 * audited file by file.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { GateContext } from '../context.ts';

const CATEGORY = 'web';

function walk(dir: string, extensions: string[], out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, extensions, out);
    else if (extensions.some((extension) => full.endsWith(extension))) out.push(full);
  }
  return out;
}

export async function run(ctx: GateContext): Promise<void> {
  const { gate } = ctx;
  const root = path.join(import.meta.dirname, '..', '..', '..', '..');

  // 1. Run the PWA's own test suite and record every test it reports.
  let report: any = null;
  let runError = '';
  try {
    const output = execFileSync(
      'npx',
      ['vitest', 'run', '--reporter=json', '--silent'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300_000 },
    );
    const start = output.indexOf('{');
    report = JSON.parse(output.slice(start));
  } catch (error: any) {
    const output = String(error.stdout ?? '');
    const start = output.indexOf('{');
    if (start >= 0) {
      try {
        report = JSON.parse(output.slice(start));
      } catch {
        runError = String(error.message).slice(0, 200);
      }
    } else {
      runError = String(error.message).slice(0, 200);
    }
  }

  if (!report) {
    gate.blocked('WEB-SUITE', CATEGORY, 'PWA vitest suite', `the suite could not be executed here: ${runError}`);
  } else {
    for (const file of report.testResults ?? []) {
      for (const assertion of file.assertionResults ?? []) {
        const id = `WEB-TEST-${path.basename(file.name ?? 'suite')}-${(assertion.fullName ?? assertion.title ?? '').slice(0, 60)}`.replace(/[^a-z0-9-]/gi, '-');
        const status = assertion.status === 'passed' ? 'PASS' : assertion.status === 'pending' || assertion.status === 'skipped' ? 'SKIPPED' : 'FAIL';
        gate.record({
          test_id: id,
          category: CATEGORY,
          description: `PWA suite: ${assertion.fullName ?? assertion.title}`,
          input: { file: path.relative(root, file.name ?? ''), test: assertion.title },
          expected: 'passed',
          actual: assertion.status,
          assertions: 1,
          status,
          severity: 'HIGH',
          message: (assertion.failureMessages ?? []).join(' | ').slice(0, 200) || undefined,
        });
      }
    }
    gate.check(
      'WEB-SUITE-TOTAL',
      CATEGORY,
      'the PWA suite ran and every test passed',
      { command: 'npx vitest run' },
      (report.numFailedTests ?? 0) === 0 && (report.numTotalTests ?? 0) > 0,
      '0 failures, > 0 tests',
      `${report.numPassedTests ?? 0} passed, ${report.numFailedTests ?? 0} failed of ${report.numTotalTests ?? 0}`,
      'CRITICAL',
      1,
    );
  }

  // 2. Static audit of every PWA source file.
  const sources = walk(path.join(root, 'src'), ['.ts', '.tsx']);
  for (const file of sources) {
    const relative = path.relative(root, file);
    const id = relative.replace(/[^a-z0-9]/gi, '-');
    const source = readFileSync(file, 'utf8');
    gate.check(
      `WEB-SECRET-${id}`,
      CATEGORY,
      `${relative} contains no embedded secret`,
      { file: relative },
      !/(SUPABASE_SERVICE_ROLE_KEY|service_role|eyJhbGciOi|sk_live_|-----BEGIN [A-Z ]*PRIVATE KEY)/.test(source),
      'no secret material',
      'scanned',
      'CRITICAL',
      5,
    );
    gate.check(
      `WEB-TODO-${id}`,
      CATEGORY,
      `${relative} carries no unfinished TODO or FIXME marker`,
      { file: relative },
      !/(TODO|FIXME)\b/.test(source),
      'no TODO/FIXME',
      'scanned',
      'LOW',
      1,
    );
    gate.check(
      `WEB-HTTP-${id}`,
      CATEGORY,
      `${relative} hardcodes no insecure remote endpoint`,
      { file: relative },
      !/'http:\/\/(?!localhost|127\.0\.0\.1)/.test(source),
      'no plain-http remote url',
      'scanned',
      'HIGH',
      1,
    );
  }

  // 3. Privacy posture: nothing about this project may be indexable while it is
  // private.
  const staticChecks: { id: string; file: string; test: (content: string) => boolean; description: string; expected: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' }[] = [
    { id: 'ROBOTS-DISALLOW', file: 'public/robots.txt', test: (content) => /Disallow:\s*\//.test(content), description: 'robots.txt disallows every crawler while the project is private', expected: 'Disallow: /', severity: 'CRITICAL' },
    { id: 'ROBOTS-ALL-AGENTS', file: 'public/robots.txt', test: (content) => /User-agent:\s*\*/.test(content), description: 'robots.txt applies to every user agent', expected: 'User-agent: *', severity: 'HIGH' },
    { id: 'INDEX-NOINDEX', file: 'index.html', test: (content) => /noindex/.test(content), description: 'the app shell declares noindex', expected: 'a noindex meta tag', severity: 'CRITICAL' },
    { id: 'INDEX-LANG', file: 'index.html', test: (content) => /lang="ar"/.test(content), description: 'the app shell declares Arabic as its language', expected: 'lang="ar"', severity: 'MEDIUM' },
    { id: 'INDEX-DIR', file: 'index.html', test: (content) => /dir="rtl"/.test(content), description: 'the app shell declares right-to-left direction', expected: 'dir="rtl"', severity: 'MEDIUM' },
    { id: 'INDEX-NOSECRET', file: 'index.html', test: (content) => !/(service_role|eyJhbGciOi)/.test(content), description: 'the app shell embeds no secret', expected: 'no secret material', severity: 'CRITICAL' },
    { id: 'MANIFEST-NAME', file: 'public/manifest.webmanifest', test: (content) => JSON.parse(content).name?.length > 0, description: 'the web manifest declares a name', expected: 'a name', severity: 'MEDIUM' },
    { id: 'MANIFEST-ICONS', file: 'public/manifest.webmanifest', test: (content) => (JSON.parse(content).icons ?? []).length >= 2, description: 'the web manifest declares at least two icons', expected: '>= 2 icons', severity: 'LOW' },
    { id: 'MANIFEST-DISPLAY', file: 'public/manifest.webmanifest', test: (content) => typeof JSON.parse(content).display === 'string', description: 'the web manifest declares a display mode', expected: 'a display mode', severity: 'LOW' },
    { id: 'MANIFEST-START', file: 'public/manifest.webmanifest', test: (content) => typeof JSON.parse(content).start_url === 'string', description: 'the web manifest declares a start url', expected: 'a start_url', severity: 'LOW' },
    { id: 'SW-CACHE', file: 'public/sw.js', test: (content) => /caches\./.test(content), description: 'the service worker uses the Cache Storage API', expected: 'caches usage', severity: 'MEDIUM' },
    { id: 'SW-VERSION', file: 'public/sw.js', test: (content) => /CACHE|VERSION/.test(content), description: 'the service worker names a versioned cache', expected: 'a cache version constant', severity: 'MEDIUM' },
    { id: 'SW-NOSECRET', file: 'public/sw.js', test: (content) => !/(service_role|eyJhbGciOi)/.test(content), description: 'the service worker embeds no secret', expected: 'no secret material', severity: 'CRITICAL' },
    { id: 'PRIVACY-PAGE', file: 'public/privacy.html', test: (content) => content.length > 200, description: 'a privacy page ships with the app', expected: 'a non-trivial privacy page', severity: 'LOW' },
  ];
  for (const check of staticChecks) {
    const file = path.join(root, check.file);
    if (!existsSync(file)) {
      gate.check(`WEB-${check.id}`, CATEGORY, check.description, { file: check.file }, false, check.expected, 'file missing', check.severity, 1);
      continue;
    }
    const content = readFileSync(file, 'utf8');
    let ok = false;
    let actual = 'checked';
    try {
      ok = check.test(content);
    } catch (error) {
      actual = `check threw: ${(error as Error).message}`;
    }
    gate.check(`WEB-${check.id}`, CATEGORY, check.description, { file: check.file }, ok, check.expected, ok ? 'satisfied' : actual, check.severity, 1);
  }

  // 4. Icons and assets that the manifest promises must exist.
  const manifestPath = path.join(root, 'public', 'manifest.webmanifest');
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const [index, icon] of (manifest.icons ?? []).entries()) {
      const target = path.join(root, 'public', String(icon.src).replace(/^\//, ''));
      gate.check(
        `WEB-ICON-${index + 1}`,
        CATEGORY,
        `manifest icon ${icon.src} exists on disk`,
        { icon: icon.src },
        existsSync(target),
        'the file exists',
        existsSync(target) ? 'present' : 'MISSING',
        'MEDIUM',
        1,
      );
    }
  }

  // 5. Package scripts the release process depends on.
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  for (const script of ['dev', 'build', 'test', 'lint', 'typecheck']) {
    gate.check(
      `WEB-SCRIPT-${script}`,
      CATEGORY,
      `package.json declares the ${script} script`,
      { script },
      typeof pkg.scripts?.[script] === 'string',
      'declared',
      pkg.scripts?.[script] ?? 'MISSING',
      'MEDIUM',
      1,
    );
  }
  gate.check(
    'WEB-PKG-PRIVATE',
    CATEGORY,
    'the web package is marked private so it cannot be published by accident',
    { field: 'private' },
    pkg.private === true,
    true,
    pkg.private,
    'HIGH',
    1,
  );
}
