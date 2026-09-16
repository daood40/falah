/// Offline Quran cache.
///
/// Storage is a port ([CacheStorage]) so the cache works with any backend —
/// files, SQLite, Isar or Hive — without the domain depending on one. The
/// bundled implementations are an in-memory store (tests) and a simple
/// key/value store the app can back with files or SQLite.
///
/// Integrity rule: an entry is served only if the stored text still hashes to
/// the stored `content_hash`, and only if the cached dataset version matches
/// the one the API reports. Anything else is dropped and refetched.
library;

import 'dart:convert';

import 'package:crypto/crypto.dart';

import '../domain/models.dart';

abstract class CacheStorage {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
  Future<List<String>> keys();
}

class InMemoryCacheStorage implements CacheStorage {
  final Map<String, String> _values = {};

  @override
  Future<String?> read(String key) async => _values[key];

  @override
  Future<void> write(String key, String value) async => _values[key] = value;

  @override
  Future<void> delete(String key) async => _values.remove(key);

  @override
  Future<List<String>> keys() async => _values.keys.toList(growable: false);
}

/// Same hashing rule as the server: SHA-256 over the text with whitespace
/// collapsed. Used to verify, never to modify.
String contentHashOf(String text) =>
    sha256.convert(utf8.encode(text.replaceAll(RegExp(r'\s+'), ' ').trim())).toString();

/// Reported when stored data fails its integrity check, so the UI can show an
/// error instead of silently serving or dropping a corrupted dataset.
typedef IntegrityFailureCallback =
    void Function(String key, String reason);

class QuranOfflineCache {
  QuranOfflineCache({
    required CacheStorage storage,
    this.datasetVersion,
    this.onIntegrityFailure,
  }) : _storage = storage;

  final CacheStorage _storage;

  /// Called when a cached entry is dropped because its checksum did not match.
  final IntegrityFailureCallback? onIntegrityFailure;

  /// When set, entries stored under a different dataset version are ignored.
  final String? datasetVersion;

  static const _surahsKey = 'quran:surahs';
  String _surahKey(int surah) => 'quran:surah:$surah';
  static const _manifestKey = 'quran:manifest';

  Future<void> writeSurahs(List<QuranSurah> surahs) async {
    await _storage.write(
      _surahsKey,
      jsonEncode({
        'dataset_version': datasetVersion,
        'items': surahs
            .map(
              (s) => {
                'id': s.id,
                'surah_number': s.number,
                'name_ar': s.nameAr,
                'name_en': s.nameEn,
                'name_transliteration': s.transliteration,
                'revelation_place': s.revelationPlace,
                'revelation_order': s.revelationOrder,
                'ayah_count': s.ayahCount,
                'bismillah': s.bismillah,
                'source_id': s.sourceId,
                'verified': s.verified,
                'dataset_version': s.datasetVersion,
              },
            )
            .toList(),
      }),
    );
  }

  Future<List<QuranSurah>?> readSurahs() async {
    final raw = await _storage.read(_surahsKey);
    if (raw == null) return null;
    final json = (jsonDecode(raw) as Map).cast<String, dynamic>();
    if (!_versionMatches(json['dataset_version'] as String?)) return null;
    return (json['items'] as List)
        .cast<Map<String, dynamic>>()
        .map(QuranSurah.fromJson)
        .toList(growable: false);
  }

  Future<void> writeSurahAyahs(int surah, List<QuranAyah> ayahs) async {
    await _storage.write(
      _surahKey(surah),
      jsonEncode({
        'dataset_version': datasetVersion,
        'items': ayahs.map((a) => a.toCacheJson()).toList(),
      }),
    );
  }

  /// Returns null when nothing is cached, the dataset version moved on, or any
  /// cached ayah fails its checksum.
  Future<List<QuranAyah>?> readSurahAyahs(int surah) async {
    final raw = await _storage.read(_surahKey(surah));
    if (raw == null) return null;
    final json = (jsonDecode(raw) as Map).cast<String, dynamic>();
    if (!_versionMatches(json['dataset_version'] as String?)) return null;
    final ayahs = (json['items'] as List)
        .cast<Map<String, dynamic>>()
        .map(QuranAyah.fromJson)
        .toList(growable: false);
    for (final ayah in ayahs) {
      if (contentHashOf(ayah.text) != ayah.contentHash) {
        await _storage.delete(_surahKey(surah));
        onIntegrityFailure?.call(
          _surahKey(surah),
          'checksum mismatch at ${ayah.surahNumber}:${ayah.ayahNumber}',
        );
        return null;
      }
    }
    return ayahs;
  }

  Future<QuranAyah?> readAyah(int surah, int ayah) async {
    final ayahs = await readSurahAyahs(surah);
    if (ayahs == null) return null;
    for (final item in ayahs) {
      if (item.ayahNumber == ayah) return item;
    }
    return null;
  }

  Future<void> writeManifest(QuranDownloadManifest manifest) => _storage.write(
    _manifestKey,
    jsonEncode({
      'dataset_version': manifest.datasetVersion,
      'checksum': manifest.checksum,
      'record_count': manifest.recordCount,
      'size': manifest.sizeBytes,
      'downloadable': manifest.downloadable,
      'license_note': manifest.licenseNote,
      'edition': {'slug': manifest.editionSlug},
      'language': manifest.language,
    }),
  );

  Future<QuranDownloadManifest?> readManifest() async {
    final raw = await _storage.read(_manifestKey);
    if (raw == null) return null;
    return QuranDownloadManifest.fromJson(
      (jsonDecode(raw) as Map).cast<String, dynamic>(),
    );
  }

  /// True when the cached dataset is the one the API currently publishes.
  Future<bool> isUpToDate(String remoteDatasetVersion) async {
    final manifest = await readManifest();
    return manifest?.datasetVersion == remoteDatasetVersion;
  }

  /// Verifies a downloaded dataset against the manifest checksum before it is
  /// used. A mismatch reports the failure and refuses the dataset — the caller
  /// keeps the previous cache (rollback) instead of switching to bad data.
  Future<bool> acceptDownload({
    required String payload,
    required QuranDownloadManifest manifest,
  }) async {
    final actual = contentHashOf(payload);
    if (actual != manifest.checksum) {
      onIntegrityFailure?.call(
        'quran:download',
        'dataset checksum mismatch: expected ${manifest.checksum}, got $actual',
      );
      return false;
    }
    await writeManifest(manifest);
    return true;
  }

  Future<void> clear() async {
    for (final key in await _storage.keys()) {
      if (key.startsWith('quran:')) await _storage.delete(key);
    }
  }

  bool _versionMatches(String? stored) =>
      datasetVersion == null || stored == null || stored == datasetVersion;
}
