/// Quality-gate device run.
///
/// This test executes on a real Android device/emulator against a real FALAH
/// Quran API. For every one of the 114 surahs it fetches the text through the
/// app's own client, cache and repository, and compares it with an expectation
/// computed on the host straight from the source dataset (assets/gate/
/// expected_surahs.json) — so the whole chain source → API → device is checked
/// on the device itself.
///
/// Every check prints one `GATE_RECORD {json}` line; the CI job turns those
/// lines into gate evidence. Nothing here modifies Quranic text.
library;

import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:falah/features/quran_api/data/api_client.dart';
import 'package:falah/features/quran_api/data/http_transport_io.dart';
import 'package:falah/features/quran_api/data/quran_api_data_source.dart';
import 'package:falah/features/quran_api/data/quran_api_repository.dart';
import 'package:falah/features/quran_api/domain/models.dart';
import 'package:falah/features/quran_api/offline/quran_cache.dart';

const String baseUrl = String.fromEnvironment(
  'GATE_API_BASE_URL',
  defaultValue: 'http://10.0.2.2:8787',
);
const String apiToken = String.fromEnvironment('GATE_API_TOKEN');
const String deviceProfile = String.fromEnvironment(
  'GATE_DEVICE_PROFILE',
  defaultValue: 'android-emulator',
);
const String buildVersion = String.fromEnvironment(
  'GATE_BUILD',
  defaultValue: 'unknown',
);
const String datasetVersion = String.fromEnvironment(
  'GATE_DATASET_VERSION',
  defaultValue: 'unknown',
);

void emit({
  required String id,
  required String description,
  required Object? input,
  required Object? expected,
  required Object? actual,
  required bool ok,
  int assertions = 1,
  String severity = 'HIGH',
}) {
  final record = <String, Object?>{
    'test_id': 'MB-DEV-${deviceProfile.toUpperCase()}-$id',
    'category': 'mobile',
    'description': '$description ($deviceProfile)',
    'input': input,
    'expected': expected,
    'actual': actual,
    'assertions': assertions,
    'status': ok ? 'PASS' : 'FAIL',
    'severity': severity,
    'timestamp': DateTime.now().toUtc().toIso8601String(),
    'build': buildVersion,
    'dataset_version': datasetVersion,
  };
  // ignore: avoid_print
  print('GATE_RECORD ${jsonEncode(record)}');
}

String sha256Of(String value) => sha256.convert(utf8.encode(value)).toString();

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late QuranApiRepository repository;
  late QuranApiClient client;
  late InMemoryCacheStorage storage;
  late QuranOfflineCache cache;
  late Map<String, dynamic> expectations;
  var integrityFailures = 0;

  setUpAll(() async {
    final raw = await rootBundle.loadString('assets/gate/expected_surahs.json');
    expectations = jsonDecode(raw) as Map<String, dynamic>;
    client = QuranApiClient(
      baseUrl: baseUrl,
      transport: IoHttpTransport(),
      tokenProvider: apiToken.isEmpty ? null : () => apiToken,
    );
    storage = InMemoryCacheStorage();
    cache = QuranOfflineCache(
      storage: storage,
      datasetVersion: expectations['dataset_version'] as String?,
      onIntegrityFailure: (_, __) => integrityFailures += 1,
    );
    repository = QuranApiRepository(
      remote: QuranApiDataSource(client),
      cache: cache,
      edition: expectations['edition'] as String?,
    );
  });

  testWidgets('the device reaches the API and reads its version', (_) async {
    var ok = false;
    String actual = 'no response';
    try {
      final surahs = await repository.listSurahs();
      ok = surahs.length == 114;
      actual = '${surahs.length} surahs';
    } catch (error) {
      actual = 'error: $error';
    }
    emit(
      id: 'API-REACHABLE',
      description: 'the device reaches the API and lists all 114 surahs',
      input: {'base_url': baseUrl},
      expected: '114 surahs',
      actual: actual,
      ok: ok,
      severity: 'CRITICAL',
      assertions: 2,
    );
    expect(ok, isTrue, reason: actual);
  });

  testWidgets('every surah reaches the device byte-identical to the source', (
    _,
  ) async {
    final surahs = expectations['surahs'] as List<dynamic>;
    var failures = 0;
    for (final entry in surahs) {
      final item = entry as Map<String, dynamic>;
      final number = item['surah_number'] as int;
      final expectedCount = item['ayah_count'] as int;
      final expectedDigest = item['text_sha256'] as String;
      var ok = false;
      var actual = 'not fetched';
      try {
        final ayahs = await repository.getSurah(number);
        final digest = sha256Of(ayahs.map((QuranAyah a) => a.text).join());
        ok = ayahs.length == expectedCount && digest == expectedDigest;
        actual = '${ayahs.length} ayahs, sha256 $digest';
      } catch (error) {
        actual = 'error: $error';
      }
      if (!ok) failures += 1;
      emit(
        id: 'SURAH-${number.toString().padLeft(3, '0')}',
        description:
            'surah $number arrives on the device with $expectedCount ayahs and the source digest',
        input: {'surah': number, 'base_url': baseUrl},
        expected: '$expectedCount ayahs, sha256 $expectedDigest',
        actual: actual,
        ok: ok,
        severity: 'CRITICAL',
        assertions: 2,
      );
    }
    expect(failures, 0, reason: '$failures surah(s) differed on the device');
  });

  testWidgets('every juz reaches the device with the expected ayah count', (
    _,
  ) async {
    final juzs = expectations['juzs'] as List<dynamic>;
    for (final entry in juzs) {
      final item = entry as Map<String, dynamic>;
      final number = item['juz_number'] as int;
      final expectedCount = item['ayah_count'] as int;
      var ok = false;
      var actual = 'not fetched';
      try {
        final ayahs = await repository.getJuzAyahs(number);
        ok = ayahs.length == expectedCount;
        actual = '${ayahs.length} ayahs';
      } catch (error) {
        actual = 'error: $error';
      }
      emit(
        id: 'JUZ-${number.toString().padLeft(2, '0')}',
        description: 'juz $number arrives on the device with $expectedCount ayahs',
        input: {'juz': number},
        expected: '$expectedCount ayahs',
        actual: actual,
        ok: ok,
        severity: 'HIGH',
      );
    }
  });

  testWidgets('the offline cache serves and protects the text on the device', (
    _,
  ) async {
    // 1. A second read of a surah is served from the cache.
    final warm = await repository.getSurah(1);
    final cachedRead = await cache.readSurahAyahs(1);
    emit(
      id: 'CACHE-WRITE',
      description: 'reading a surah populates the on-device cache',
      input: {'surah': 1},
      expected: '${warm.length} cached ayahs',
      actual: '${cachedRead?.length ?? 0} cached ayahs',
      ok: (cachedRead?.length ?? 0) == warm.length,
      severity: 'HIGH',
    );

    // 2. Cached text is identical to what the API returned.
    final identical =
        cachedRead != null &&
        sha256Of(cachedRead.map((a) => a.text).join()) ==
            sha256Of(warm.map((a) => a.text).join());
    emit(
      id: 'CACHE-IDENTICAL',
      description: 'the cached copy is byte-identical to the API response',
      input: {'surah': 1},
      expected: 'identical digests',
      actual: identical ? 'identical' : 'different',
      ok: identical,
      severity: 'CRITICAL',
    );

    // 3. A tampered cache entry is detected and dropped, never shown.
    final keys = await storage.keys();
    final surahKey = keys.firstWhere(
      (key) => key.contains('surah') && key.contains('1'),
      orElse: () => '',
    );
    var tamperDetected = false;
    var tamperActual = 'cache key not found';
    if (surahKey.isNotEmpty) {
      final original = await storage.read(surahKey);
      if (original != null) {
        final before = integrityFailures;
        await storage.write(surahKey, original.replaceFirst('"text":"', '"text":"X'));
        final afterTamper = await cache.readSurahAyahs(1);
        tamperDetected =
            integrityFailures > before || afterTamper == null || afterTamper.isEmpty;
        tamperActual = tamperDetected
            ? 'rejected (integrity failures: ${integrityFailures - before})'
            : 'served tampered text';
        await storage.write(surahKey, original);
      }
    }
    emit(
      id: 'CACHE-TAMPER',
      description: 'a tampered cache entry is rejected on the device, never shown',
      input: {'surah': 1, 'mutation': 'one character inserted into the cached text'},
      expected: 'rejected',
      actual: tamperActual,
      ok: tamperDetected,
      severity: 'CRITICAL',
      assertions: 2,
    );

    // 4. After the cache is cleared the device refetches from the API.
    for (final key in await storage.keys()) {
      await storage.delete(key);
    }
    final refetched = await repository.getSurah(1);
    emit(
      id: 'CACHE-REFETCH',
      description: 'after the cache is cleared the device refetches from the API',
      input: {'surah': 1},
      expected: '${warm.length} ayahs',
      actual: '${refetched.length} ayahs',
      ok: refetched.length == warm.length,
      severity: 'HIGH',
    );
  });

  testWidgets('error paths behave on the device', (_) async {
    // A surah that does not exist must raise a not-found, not a crash.
    var notFound = false;
    var actual = 'no error';
    try {
      await repository.getSurah(999);
    } on QuranApiException catch (error) {
      notFound = error.isNotFound || error.statusCode == 404 || error.statusCode == 422;
      actual = 'QuranApiException(${error.code}, ${error.statusCode})';
    } catch (error) {
      actual = 'unexpected: $error';
    }
    emit(
      id: 'ERROR-NOTFOUND',
      description: 'an unknown surah raises a typed not-found on the device',
      input: {'surah': 999},
      expected: 'a typed not-found error',
      actual: actual,
      ok: notFound,
      severity: 'HIGH',
    );

    // An unreachable host must surface as an error, never as invented text.
    final deadClient = QuranApiClient(
      baseUrl: 'http://127.0.0.1:1',
      transport: IoHttpTransport(timeout: const Duration(seconds: 2)),
    );
    final deadRepository = QuranApiRepository(
      remote: QuranApiDataSource(deadClient),
    );
    var offlineHandled = false;
    var offlineActual = 'returned data from an unreachable host';
    try {
      await deadRepository.getSurah(1);
    } catch (error) {
      offlineHandled = true;
      offlineActual = 'error surfaced: ${error.runtimeType}';
    }
    emit(
      id: 'ERROR-OFFLINE',
      description: 'an unreachable API surfaces an error instead of invented text',
      input: {'base_url': 'http://127.0.0.1:1'},
      expected: 'an error',
      actual: offlineActual,
      ok: offlineHandled,
      severity: 'CRITICAL',
    );
  });

  testWidgets('search and single-ayah reads work on the device', (_) async {
    final probes = expectations['ayah_probes'] as List<dynamic>;
    for (final entry in probes) {
      final item = entry as Map<String, dynamic>;
      final surah = item['surah'] as int;
      final ayah = item['ayah'] as int;
      final expectedDigest = item['text_sha256'] as String;
      var ok = false;
      var actual = 'not fetched';
      try {
        final result = await repository.getAyah(surah, ayah);
        final digest = sha256Of(result.text);
        ok = digest == expectedDigest;
        actual = 'sha256 $digest';
      } catch (error) {
        actual = 'error: $error';
      }
      emit(
        id: 'AYAH-$surah-$ayah',
        description: 'ayah $surah:$ayah arrives on the device with the source digest',
        input: {'surah': surah, 'ayah': ayah},
        expected: 'sha256 $expectedDigest',
        actual: actual,
        ok: ok,
        severity: 'CRITICAL',
      );
    }

    final queries = expectations['search_probes'] as List<dynamic>;
    for (final entry in queries) {
      final item = entry as Map<String, dynamic>;
      final query = item['q'] as String;
      final minimum = item['min_results'] as int;
      var ok = false;
      var actual = 'not run';
      try {
        final hits = await repository.search(query);
        ok = hits.length >= minimum;
        actual = '${hits.length} hits';
      } catch (error) {
        actual = 'error: $error';
      }
      emit(
        id: 'SEARCH-${query.hashCode.abs()}',
        description: 'search for a real word returns at least $minimum hits on the device',
        input: {'q': query},
        expected: '>= $minimum hits',
        actual: actual,
        ok: ok,
        severity: 'HIGH',
      );
    }
  });
}
