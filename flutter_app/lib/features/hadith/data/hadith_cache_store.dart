/// Persistence for the API client's cache.
///
/// The RULES live in the client package (`HadithCache`): a record is served
/// from the cache only while it belongs to the dataset the server still serves
/// and its own checksum still matches. This file only stores and restores that
/// cache, so an offline start shows the same records the server would, or
/// nothing at all — never a stale or altered text.
library;

import 'dart:convert';

import 'package:falah_hadith_api/falah_hadith_api.dart';
import 'package:shared_preferences/shared_preferences.dart';

class HadithCacheStore {
  HadithCacheStore(this.cache, this._prefs);

  static const String storageKey = 'hadith_cache_v1';

  final HadithCache cache;
  final SharedPreferences _prefs;

  /// Loads a previous snapshot. A corrupt or unreadable snapshot is dropped:
  /// an empty cache is always safe, a half-parsed one is not.
  void load() {
    final raw = _prefs.getString(storageKey);
    if (raw == null || raw.isEmpty) return;
    try {
      final json = jsonDecode(raw);
      if (json is Map<String, dynamic>) cache.loadJson(json);
    } catch (_) {
      cache.invalidate();
      _prefs.remove(storageKey);
    }
  }

  Future<void> save() => _prefs.setString(storageKey, jsonEncode(cache.toJson()));

  /// Called after every `/version` read. A changed fingerprint means the
  /// dataset moved, so the stored snapshot is dropped with it.
  Future<void> syncDataset(ApiVersion version) async {
    final changed = cache.syncDataset(version);
    await save();
    if (changed) {
      // the in-memory cache already cleared itself; make the disk agree
      await _prefs.setString(storageKey, jsonEncode(cache.toJson()));
    }
  }

  Future<void> put(Hadith hadith) async {
    cache.put(hadith);
    await save();
  }

  Hadith? get(String id) => cache.get(id);

  Future<void> clear() async {
    cache.invalidate();
    await _prefs.remove(storageKey);
  }
}
