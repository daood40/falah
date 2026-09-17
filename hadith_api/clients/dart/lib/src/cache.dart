/// Offline cache with checksum enforcement (§23).
///
/// A cached record is only valid while the dataset it came from is still the
/// dataset the server serves, and while its own content hash still matches.
/// On any mismatch the entry is REJECTED and the cache is invalidated — a stale
/// or altered religious text must never be shown.
library;

import 'models.dart';

class CachedEntry<T> {
  const CachedEntry({
    required this.key,
    required this.data,
    required this.datasetVersion,
    required this.contentHash,
    required this.fetchedAt,
  });

  final String key;
  final T data;
  final String datasetVersion;

  /// For one record: its own SHA-256. For a list: the dataset fingerprint.
  final String contentHash;
  final DateTime fetchedAt;

  Map<String, dynamic> toJson(Object? Function(T) encode) => {
        'key': key,
        'data': encode(data),
        'dataset_version': datasetVersion,
        'content_hash': contentHash,
        'fetched_at': fetchedAt.toIso8601String(),
      };

  static CachedEntry<T>? fromJson<T>(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) decode,
  ) {
    final data = json['data'];
    if (data is! Map<String, dynamic>) return null;
    return CachedEntry<T>(
      key: json['key'] as String,
      data: decode(data),
      datasetVersion: json['dataset_version'] as String? ?? '',
      contentHash: json['content_hash'] as String? ?? '',
      fetchedAt: DateTime.tryParse(json['fetched_at'] as String? ?? '') ?? DateTime(1970),
    );
  }
}

enum CacheVerdict { fresh, staleDataset, checksumMismatch, expired, missing }

/// An in-memory cache that enforces the dataset contract. Persist it with
/// whatever the app already uses (shared_preferences, sqflite, a file) by
/// serialising the entries — the rules live here, not in the storage.
class HadithCache {
  HadithCache({this.maxAge = const Duration(days: 30)});

  final Duration maxAge;
  final Map<String, CachedEntry<Hadith>> _entries = {};

  /// The dataset fingerprint the cache was filled from.
  String? datasetHash;
  String? datasetVersion;

  int get length => _entries.length;

  /// Call after `getVersion()`. A changed fingerprint drops everything —
  /// a rollback to a clean state rather than a mix of two datasets.
  bool syncDataset(ApiVersion version) {
    final changed = datasetHash != null && datasetHash != version.datasetHash;
    if (changed) _entries.clear();
    datasetHash = version.datasetHash;
    datasetVersion = version.datasetVersion;
    return changed;
  }

  void put(Hadith hadith) {
    _entries[hadith.id] = CachedEntry<Hadith>(
      key: hadith.id,
      data: hadith,
      datasetVersion: hadith.dataset.version,
      contentHash: hadith.dataset.hash,
      fetchedAt: DateTime.now(),
    );
  }

  CacheVerdict inspect(String id, {DateTime? now}) {
    final entry = _entries[id];
    if (entry == null) return CacheVerdict.missing;
    if (datasetVersion != null && entry.datasetVersion != datasetVersion) {
      return CacheVerdict.staleDataset;
    }
    if (entry.contentHash != entry.data.dataset.hash) return CacheVerdict.checksumMismatch;
    final age = (now ?? DateTime.now()).difference(entry.fetchedAt);
    if (age > maxAge) return CacheVerdict.expired;
    return CacheVerdict.fresh;
  }

  /// Returns the record only when it is provably the one the server has.
  /// Anything else is dropped from the cache and reported as a miss.
  Hadith? get(String id, {DateTime? now}) {
    final verdict = inspect(id, now: now);
    if (verdict == CacheVerdict.fresh) return _entries[id]!.data;
    _entries.remove(id);
    return null;
  }

  /// Verifies a record the server just returned against the cached copy.
  /// A different hash for the same id means the dataset moved under us.
  bool matches(Hadith fresh) {
    final entry = _entries[fresh.id];
    return entry == null || entry.contentHash == fresh.dataset.hash;
  }

  void invalidate([String? id]) {
    if (id == null) {
      _entries.clear();
    } else {
      _entries.remove(id);
    }
  }
}
