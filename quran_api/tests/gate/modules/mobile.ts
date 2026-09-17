/**
 * Category: mobile — Android and iOS. Neither toolchain exists in this
 * environment (no Android SDK, no macOS/Xcode, and no Flutter SDK), so every
 * device-level case is recorded BLOCKED and never counted as a pass. The
 * Android project files that are in the repository are audited for real.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { GateContext } from '../context.ts';

const CATEGORY = 'mobile';

export async function run(ctx: GateContext): Promise<void> {
  const { gate } = ctx;
  const root = path.join(import.meta.dirname, '..', '..', '..', '..', 'flutter_app');
  const android = path.join(root, 'android');

  // --- Android project files that exist here and can be checked for real ----
  const manifestPath = path.join(android, 'app', 'src', 'main', 'AndroidManifest.xml');
  const manifest = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : '';
  const gradlePath = path.join(android, 'app', 'build.gradle.kts');
  const gradle = existsSync(gradlePath) ? readFileSync(gradlePath, 'utf8') : '';

  const androidChecks: { id: string; description: string; ok: boolean; expected: string; actual: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' }[] = [
    { id: 'PROJECT', description: 'the Android project exists in the repository', ok: existsSync(android), expected: 'android/ present', actual: existsSync(android) ? 'present' : 'missing', severity: 'HIGH' },
    { id: 'MANIFEST', description: 'the Android manifest exists', ok: manifest.length > 0, expected: 'AndroidManifest.xml present', actual: manifest.length > 0 ? 'present' : 'missing', severity: 'HIGH' },
    { id: 'GRADLE', description: 'the app gradle build file exists', ok: gradle.length > 0, expected: 'build.gradle.kts present', actual: gradle.length > 0 ? 'present' : 'missing', severity: 'HIGH' },
    { id: 'INTERNET-PERMISSION', description: 'the manifest requests only the permissions the app needs', ok: !/android\.permission\.(READ_CONTACTS|ACCESS_FINE_LOCATION|CAMERA|RECORD_AUDIO|READ_SMS)/.test(manifest), expected: 'no unnecessary sensitive permission', actual: 'scanned', severity: 'CRITICAL' },
    { id: 'NO-CLEARTEXT', description: 'the manifest does not enable cleartext traffic globally', ok: !/usesCleartextTraffic="true"/.test(manifest), expected: 'cleartext traffic not enabled', actual: /usesCleartextTraffic="true"/.test(manifest) ? 'enabled' : 'not enabled', severity: 'CRITICAL' },
    { id: 'NO-BACKUP-SECRET', description: 'the manifest does not allow unrestricted backup of app data', ok: !/allowBackup="true"/.test(manifest) || /fullBackupContent/.test(manifest), expected: 'backup disabled or scoped', actual: 'scanned', severity: 'MEDIUM' },
    { id: 'NO-DEBUGGABLE', description: 'the manifest is not marked debuggable', ok: !/android:debuggable="true"/.test(manifest), expected: 'not debuggable', actual: 'scanned', severity: 'HIGH' },
    { id: 'NO-SECRET-MANIFEST', description: 'the manifest embeds no key or token', ok: !/(eyJhbGciOi|service_role|AIza[0-9A-Za-z_-]{20})/.test(manifest), expected: 'no secret material', actual: 'scanned', severity: 'CRITICAL' },
    { id: 'NO-SECRET-GRADLE', description: 'the gradle build embeds no signing password or key', ok: !/(storePassword\s*=\s*"|keyPassword\s*=\s*"|eyJhbGciOi)/.test(gradle), expected: 'no credential in the build file', actual: 'scanned', severity: 'CRITICAL' },
    { id: 'APPLICATION-ID', description: 'the gradle build declares an application id', ok: /applicationId/.test(gradle), expected: 'applicationId declared', actual: /applicationId/.test(gradle) ? 'declared' : 'MISSING', severity: 'MEDIUM' },
    { id: 'NO-KEYSTORE-COMMITTED', description: 'no keystore file is committed to the repository', ok: !existsSync(path.join(android, 'app', 'release.keystore')) && !existsSync(path.join(android, 'key.properties')), expected: 'no keystore or key.properties in git', actual: 'scanned', severity: 'CRITICAL' },
    { id: 'LOCAL-PROPERTIES-IGNORED', description: 'android/local.properties is not a source of truth for secrets', ok: !/(password|token|key\s*=\s*eyJ)/i.test(existsSync(path.join(android, 'local.properties')) ? readFileSync(path.join(android, 'local.properties'), 'utf8') : ''), expected: 'no credential in local.properties', actual: 'scanned', severity: 'HIGH' },
  ];
  for (const check of androidChecks) {
    gate.check(`MB-ANDROID-${check.id}`, CATEGORY, check.description, { file: 'flutter_app/android' }, check.ok, check.expected, check.actual, check.severity, 1);
  }

  const iosPresent = existsSync(path.join(root, 'ios'));
  gate.blocked(
    'MB-IOS-PROJECT',
    CATEGORY,
    'iOS project generation and audit',
    iosPresent
      ? 'An iOS project exists but no macOS host or Xcode is available in this environment.'
      : 'No iOS project has been generated yet; generating and building one requires a macOS host with Xcode, which this environment does not have.',
  );

  // --- Everything that needs a device, an emulator or a platform SDK --------
  const androidProfiles = [
    'Android 9 (API 28) phone',
    'Android 11 (API 30) phone',
    'Android 13 (API 33) phone',
    'Android 14 (API 34) phone',
    'Android 14 tablet',
    'Android 13 low-memory device',
    'Android 12 (API 31) phone',
    'Android 10 (API 29) phone',
    'Android 15 (API 35) phone',
    'Android 14 foldable',
  ];
  const iosProfiles = ['iOS 16 iPhone', 'iOS 17 iPhone', 'iOS 17 iPad', 'iOS 18 iPhone', 'iOS 18 iPad', 'iOS 16 iPhone SE (small screen)'];
  const deviceChecks = [
    'the app installs and launches',
    'the first screen renders right-to-left',
    'every visible string comes from the localisation bundle',
    'the surah list loads from the API',
    'a surah reader renders the full text of the surah',
    'the Quran text on screen matches the API response byte for byte',
    'the loading state renders while data is in flight',
    'the error state renders when the API is unreachable',
    'the empty state renders when a list has no items',
    'offline mode serves the cached surah',
    'a tampered cache entry is rejected and refetched',
    'search returns results and renders them',
    'audio playback is absent while the audio licence is unconfirmed',
    'no secret is present in the installed bundle',
    'the app makes no request to a non-configured host',
    'rotating the device preserves the reading position',
    'system font scaling does not clip the text',
    'dark mode renders with the declared tokens',
    'back navigation never leaves a blank screen',
    'the app survives a process death and restore',
  ];
  for (const profile of [...androidProfiles, ...iosProfiles]) {
    const isIos = iosProfiles.includes(profile);
    for (const [index, check] of deviceChecks.entries()) {
      gate.blocked(
        `MB-${isIos ? 'IOS' : 'ANDROID'}-${profile.replace(/[^a-z0-9]/gi, '-')}-${String(index + 1).padStart(2, '0')}`,
        CATEGORY,
        `${check} (${profile})`,
        isIos
          ? 'No macOS host, no Xcode and no iOS simulator in this environment.'
          : 'No Android SDK, emulator or device in this environment (the SDK download host is outside the egress policy), and no Flutter SDK to build with.',
      );
    }
  }

  const buildMatrix = [
    'flutter build apk --release',
    'flutter build appbundle --release',
    'flutter build apk --debug',
    'gradle assembleRelease',
    'gradle lint',
    'apk signature verification',
    'apk size budget',
    'apk permission diff against the manifest',
    'flutter build ipa',
    'xcodebuild archive',
    'iOS code signing',
    'App Store validation',
  ];
  for (const [index, build] of buildMatrix.entries()) {
    gate.blocked(
      `MB-BUILD-${String(index + 1).padStart(2, '0')}`,
      CATEGORY,
      build,
      'The required SDK is not installed in this environment (no Flutter SDK, no Android SDK, no macOS/Xcode). CI provisions these; this gate runs where they are absent.',
    );
  }
}
