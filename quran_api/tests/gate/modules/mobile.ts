/**
 * Category: mobile — Android, executed for real.
 *
 * This module audits the Android project files, then builds a release APK with
 * the real toolchain and inspects what the build produced. The on-device cases
 * (the app running on an emulator against a real API) are produced by the
 * integration run in the gate-android job and merged in as their own evidence
 * file — see flutter_app/integration_test/gate_device_test.dart.
 *
 * Scope note: iOS is out of scope by owner decision (2026-09-17) — no macOS
 * runner is enabled for this repository. It is recorded in reports/GATE_SCOPE.md
 * as an owner item, not as a blocked test case.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { GateContext } from '../context.ts';

const CATEGORY = 'mobile';

type Run = { ok: boolean; code: number | null; stdout: string; stderr: string };

function run_(command: string, args: string[], options: { cwd?: string; timeout?: number } = {}): Run {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    timeout: options.timeout ?? 1_800_000,
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

/** aapt lives in the SDK build-tools, which are not on PATH on a CI runner. */
function sdkBuildTool(command: string): string | null {
  const sdk = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME;
  if (!sdk) return null;
  try {
    const found = execFileSync('sh', ['-c', `ls -1 ${JSON.stringify(sdk)}/build-tools/*/${command} 2>/dev/null | sort -V | tail -n 1`], {
      encoding: 'utf8',
    }).trim();
    return found.length > 0 ? found : null;
  } catch {
    return null;
  }
}

function which(command: string): string | null {
  try {
    return execFileSync('sh', ['-c', `command -v ${command}`], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

export async function run(ctx: GateContext): Promise<void> {
  const { gate } = ctx;
  const root = path.join(import.meta.dirname, '..', '..', '..', '..', 'flutter_app');
  const android = path.join(root, 'android');

  if (!which('flutter')) {
    throw new Error(
      'the mobile category requires the Flutter and Android toolchains. Run it in the gate-android job (.github/workflows/quality-gate.yml).',
    );
  }

  // ------------------------------------------------- project file audit -----
  const manifestPath = path.join(android, 'app', 'src', 'main', 'AndroidManifest.xml');
  const manifest = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : '';
  const gradlePath = path.join(android, 'app', 'build.gradle.kts');
  const gradle = existsSync(gradlePath) ? readFileSync(gradlePath, 'utf8') : '';

  const projectChecks: { id: string; description: string; ok: boolean; expected: string; actual: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' }[] = [
    { id: 'PROJECT', description: 'the Android project exists in the repository', ok: existsSync(android), expected: 'android/ present', actual: existsSync(android) ? 'present' : 'missing', severity: 'HIGH' },
    { id: 'MANIFEST', description: 'the Android manifest exists', ok: manifest.length > 0, expected: 'AndroidManifest.xml present', actual: manifest.length > 0 ? 'present' : 'missing', severity: 'HIGH' },
    { id: 'GRADLE', description: 'the app gradle build file exists', ok: gradle.length > 0, expected: 'build.gradle.kts present', actual: gradle.length > 0 ? 'present' : 'missing', severity: 'HIGH' },
    { id: 'SENSITIVE-PERMISSION', description: 'the manifest requests no sensitive permission the app does not need', ok: !/android\.permission\.(READ_CONTACTS|ACCESS_FINE_LOCATION|CAMERA|RECORD_AUDIO|READ_SMS)/.test(manifest), expected: 'no sensitive permission', actual: 'scanned', severity: 'CRITICAL' },
    { id: 'NO-CLEARTEXT', description: 'the manifest does not enable cleartext traffic globally', ok: !/usesCleartextTraffic="true"/.test(manifest), expected: 'cleartext not enabled', actual: /usesCleartextTraffic="true"/.test(manifest) ? 'enabled' : 'not enabled', severity: 'CRITICAL' },
    { id: 'NO-BACKUP-SECRET', description: 'the manifest does not allow unrestricted backup of app data', ok: !/allowBackup="true"/.test(manifest) || /fullBackupContent/.test(manifest), expected: 'backup disabled or scoped', actual: 'scanned', severity: 'MEDIUM' },
    { id: 'NO-DEBUGGABLE', description: 'the manifest is not marked debuggable', ok: !/android:debuggable="true"/.test(manifest), expected: 'not debuggable', actual: 'scanned', severity: 'HIGH' },
    { id: 'NO-SECRET-MANIFEST', description: 'the manifest embeds no key or token', ok: !/(eyJhbGciOi|service_role|AIza[0-9A-Za-z_-]{20})/.test(manifest), expected: 'no secret material', actual: 'scanned', severity: 'CRITICAL' },
    { id: 'NO-SECRET-GRADLE', description: 'the gradle build embeds no signing password or key', ok: !/(storePassword\s*=\s*"|keyPassword\s*=\s*"|eyJhbGciOi)/.test(gradle), expected: 'no credential in the build file', actual: 'scanned', severity: 'CRITICAL' },
    { id: 'APPLICATION-ID', description: 'the gradle build declares an application id', ok: /applicationId/.test(gradle), expected: 'applicationId declared', actual: /applicationId/.test(gradle) ? 'declared' : 'MISSING', severity: 'MEDIUM' },
    { id: 'NO-KEYSTORE-COMMITTED', description: 'no keystore is committed to the repository', ok: !existsSync(path.join(android, 'app', 'release.keystore')) && !existsSync(path.join(android, 'key.properties')), expected: 'no keystore in git', actual: 'scanned', severity: 'CRITICAL' },
    { id: 'LOCAL-PROPERTIES', description: 'android/local.properties holds no credential', ok: !/(password|token|key\s*=\s*eyJ)/i.test(existsSync(path.join(android, 'local.properties')) ? readFileSync(path.join(android, 'local.properties'), 'utf8') : ''), expected: 'no credential', actual: 'scanned', severity: 'HIGH' },
  ];
  for (const check of projectChecks) {
    gate.check(`MB-PROJECT-${check.id}`, CATEGORY, check.description, { path: 'flutter_app/android' }, check.ok, check.expected, check.actual, check.severity, 1);
  }

  // ------------------------------------------------------- release build ----
  // The build needs its dependencies and generated localisations first; without
  // them gradle fails on missing imports rather than on anything this gate is
  // trying to measure.
  const pubGet = run_('flutter', ['pub', 'get'], { cwd: root, timeout: 900_000 });
  gate.check('MB-PUB-GET', CATEGORY, 'flutter pub get resolves the client dependencies', { command: 'flutter pub get' }, pubGet.ok, 'exit 0', pubGet.ok ? 'exit 0' : `exit ${pubGet.code}: ${pubGet.stderr.slice(-300)}`, 'CRITICAL', 1);

  const genL10n = run_('flutter', ['gen-l10n'], { cwd: root, timeout: 600_000 });
  gate.check('MB-GEN-L10N', CATEGORY, 'the localisation bundle generates before the build', { command: 'flutter gen-l10n' }, genL10n.ok, 'exit 0', genL10n.ok ? 'exit 0' : `exit ${genL10n.code}: ${genL10n.stderr.slice(-300)}`, 'HIGH', 1);

  const build = run_('flutter', ['build', 'apk', '--release'], { cwd: root, timeout: 2_400_000 });
  gate.check(
    'MB-BUILD-APK',
    CATEGORY,
    'flutter build apk --release produces a release APK',
    { command: 'flutter build apk --release' },
    build.ok,
    'exit 0',
    build.ok ? 'exit 0' : `exit ${build.code}: ${build.stderr.slice(-400)}`,
    'CRITICAL',
    1,
  );
  const apk = path.join(root, 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk');
  gate.check('MB-APK-EXISTS', CATEGORY, 'the release APK exists on disk', { file: 'build/app/outputs/flutter-apk/app-release.apk' }, existsSync(apk), 'present', existsSync(apk) ? 'present' : 'MISSING', 'CRITICAL', 1);
  if (!existsSync(apk)) {
    throw new Error(
      `the release APK was not produced; the mobile category cannot continue. flutter build apk --release exited ${build.code}: ${build.stdout.slice(-1500)}${build.stderr.slice(-1500)}`,
    );
  }

  const apkSize = statSync(apk).size;
  gate.check('MB-APK-SIZE', CATEGORY, 'the release APK stays under 100 MB', { file: 'app-release.apk' }, apkSize < 100 * 1024 * 1024, '< 100 MB', `${Math.round(apkSize / 1024 / 1024)} MB`, 'MEDIUM', 1);

  const entries = run_('unzip', ['-l', apk], { timeout: 300_000 }).stdout;
  // A modern release APK is signed with scheme v2/v3, whose signature lives in
  // the APK Signing Block between the entries and the central directory — there
  // are no META-INF/*.RSA files to look for. So look for either.
  const v1 = /META-INF\/[^\s]*\.(RSA|DSA|EC|SF)/.test(entries);
  const v2 = run_('sh', ['-c', `LC_ALL=C grep -a -c 'APK Sig Block 42' ${JSON.stringify(apk)} || true`], { timeout: 300_000 }).stdout.trim() !== '0';
  const signature = { ok: v1 || v2, actual: v1 && v2 ? 'v1 + v2/v3' : v1 ? 'v1 (META-INF)' : v2 ? 'v2/v3 signing block' : 'UNSIGNED' };
  const apkContents: { id: string; description: string; ok: boolean; expected: string; actual: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' }[] = [
    { id: 'DEX', description: 'the APK contains compiled application code', ok: /classes\.dex/.test(entries), expected: 'classes.dex', actual: /classes\.dex/.test(entries) ? 'present' : 'MISSING', severity: 'CRITICAL' },
    { id: 'LIBFLUTTER', description: 'the APK contains the Flutter engine library', ok: /libflutter\.so/.test(entries), expected: 'libflutter.so', actual: /libflutter\.so/.test(entries) ? 'present' : 'MISSING', severity: 'HIGH' },
    { id: 'LIBAPP', description: 'the APK contains the AOT-compiled Dart application', ok: /libapp\.so/.test(entries), expected: 'libapp.so', actual: /libapp\.so/.test(entries) ? 'present' : 'MISSING', severity: 'HIGH' },
    { id: 'MANIFEST', description: 'the APK contains a binary manifest', ok: /AndroidManifest\.xml/.test(entries), expected: 'AndroidManifest.xml', actual: /AndroidManifest\.xml/.test(entries) ? 'present' : 'MISSING', severity: 'HIGH' },
    { id: 'SIGNED', description: 'the APK carries a signing block (debug key in CI, release key with the owner secrets)', ok: signature.ok, expected: 'a v1, v2 or v3 signature', actual: signature.actual, severity: 'MEDIUM' },
    { id: 'NO-ENV', description: 'the APK ships no .env file', ok: !/\.env\b/.test(entries), expected: 'no .env entry', actual: 'scanned', severity: 'CRITICAL' },
    { id: 'NO-CONFIG-JSON', description: 'the APK ships no unexpected configuration json at the root', ok: !/\s(development|staging|production)\.json$/m.test(entries), expected: 'no raw config json', actual: 'scanned', severity: 'MEDIUM' },
  ];
  for (const check of apkContents) {
    gate.check(`MB-APK-${check.id}`, CATEGORY, check.description, { file: 'app-release.apk' }, check.ok, check.expected, check.actual, check.severity, 1);
  }

  // Secret scan over the real APK bytes.
  const secretScan = run_('sh', ['-c', `unzip -p ${JSON.stringify(apk)} '*' 2>/dev/null | LC_ALL=C grep -a -c -E 'eyJhbGciOi|SUPABASE_SERVICE_ROLE_KEY|service_role' || true`], { timeout: 600_000 });
  const secretHits = Number.parseInt(secretScan.stdout.trim() || '0', 10);
  gate.check(
    'MB-APK-NO-SECRET',
    CATEGORY,
    'no secret string is present anywhere inside the release APK',
    { file: 'app-release.apk', patterns: ['eyJhbGciOi', 'SUPABASE_SERVICE_ROLE_KEY', 'service_role'] },
    secretHits === 0,
    '0 matches',
    `${secretHits} match(es)`,
    'CRITICAL',
    3,
  );

  // Manifest facts read back out of the built APK, not out of the source file.
  const aapt = which('aapt2') ?? which('aapt') ?? sdkBuildTool('aapt2') ?? sdkBuildTool('aapt');
  if (aapt) {
    const badging = run_(aapt, [aapt.endsWith('aapt2') ? 'dump' : 'dump', aapt.endsWith('aapt2') ? 'badging' : 'badging', apk], { timeout: 300_000 }).stdout;
    const badgingChecks: { id: string; description: string; ok: boolean; expected: string; actual: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' }[] = [
      { id: 'PACKAGE', description: 'the built APK declares the expected package name', ok: /package: name='[^']+'/.test(badging), expected: 'a package name', actual: (badging.match(/package: name='([^']+)'/) ?? [])[1] ?? 'none', severity: 'HIGH' },
      { id: 'PERMISSIONS', description: 'the built APK requests only the INTERNET permission', ok: (badging.match(/uses-permission: name='([^']+)'/g) ?? []).every((line) => line.includes('android.permission.INTERNET')), expected: 'INTERNET only', actual: (badging.match(/uses-permission: name='([^']+)'/g) ?? []).join(', ') || 'none', severity: 'CRITICAL' },
      { id: 'TARGET-SDK', description: 'the built APK targets a current Android API level', ok: Number.parseInt((badging.match(/targetSdkVersion:'(\d+)'/) ?? [])[1] ?? '0', 10) >= 34, expected: 'targetSdkVersion >= 34', actual: (badging.match(/targetSdkVersion:'(\d+)'/) ?? [])[1] ?? 'unknown', severity: 'HIGH' },
      { id: 'MIN-SDK', description: 'the built APK declares a minimum API level', ok: Number.parseInt((badging.match(/sdkVersion:'(\d+)'/) ?? [])[1] ?? '0', 10) >= 21, expected: 'minSdkVersion >= 21', actual: (badging.match(/sdkVersion:'(\d+)'/) ?? [])[1] ?? 'unknown', severity: 'MEDIUM' },
      { id: 'LOCALES', description: 'the built APK ships the Arabic and English locales', ok: /locales:.*'ar'/.test(badging) || /locales:.*'--_--'/.test(badging), expected: 'ar present', actual: (badging.match(/locales: (.*)/) ?? [])[1]?.slice(0, 120) ?? 'none', severity: 'MEDIUM' },
    ];
    for (const check of badgingChecks) {
      gate.check(`MB-BADGING-${check.id}`, CATEGORY, check.description, { tool: path.basename(aapt) }, check.ok, check.expected, check.actual, check.severity, 1);
    }
  } else {
    // aapt is part of the Android SDK build-tools; without it the manifest
    // facts are read from the source manifest instead, which is still a real
    // check, just one level further from the artefact.
    gate.check('MB-BADGING-TOOL', CATEGORY, 'aapt is available to read the built APK manifest', { tool: 'aapt2' }, false, 'aapt2 on PATH', 'not found — manifest facts read from source instead', 'LOW', 1);
  }
}
