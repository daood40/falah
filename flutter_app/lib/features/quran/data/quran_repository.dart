/// Quran repository — bundled quran-json assets (same dataset as the PWA),
/// lazy per-surah loading with an in-memory cache, reference and normalized
/// Arabic search. Every ayah is served as a SOURCE_LOCK LockedText.
library;

import 'dart:convert';

import 'package:flutter/services.dart' show AssetBundle, rootBundle;

import '../../../core/arabic/arabic.dart';
import '../../../core/sourcelock/source_lock.dart';
import '../domain/models.dart';

class QuranRepository {
  QuranRepository({AssetBundle? bundle}) : _bundle = bundle ?? rootBundle;

  final AssetBundle _bundle;
  List<Surah>? _surahs;
  final Map<int, List<Ayah>> _chapters = {};

  Future<List<Surah>> listSurahs() async {
    if (_surahs != null) return _surahs!;
    final raw = await _bundle.loadString('assets/quran/index.json');
    final list = (jsonDecode(raw) as List)
        .cast<Map<String, dynamic>>()
        .map(Surah.fromJson)
        .toList(growable: false);
    _surahs = list;
    return list;
  }

  Future<Surah?> surahByNumber(int n) async =>
      (await listSurahs()).where((s) => s.number == n).firstOrNull;

  Future<List<Ayah>> getSurahAyahs(int surah) async {
    final cached = _chapters[surah];
    if (cached != null) return cached;
    final raw = await _bundle.loadString('assets/quran/en/$surah.json');
    final json = jsonDecode(raw) as Map<String, dynamic>;
    final verses = (json['verses'] as List).cast<Map<String, dynamic>>();
    final ayahs = verses
        .map(
          (v) => Ayah(
            surah: surah,
            ayah: v['id'] as int,
            locked: lockText(v['text'] as String, tanzilSource),
            translation: v['translation'] as String?,
          ),
        )
        .toList(growable: false);
    _chapters[surah] = ayahs;
    return ayahs;
  }

  Future<Ayah?> getAyah(int surah, int ayah) async {
    if (surah < 1 || surah > 114) return null;
    final ayahs = await getSurahAyahs(surah);
    return ayahs.where((a) => a.ayah == ayah).firstOrNull;
  }

  /// Reference search ("2:255") resolves directly; otherwise a normalized
  /// Arabic or English substring search over all surahs.
  Future<List<QuranSearchResult>> search(String query, {int limit = 20}) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return const [];

    final surahs = await listSurahs();

    final ref = parseAyahReference(trimmed);
    if (ref != null) {
      final ayah = await getAyah(ref.surah, ref.ayah);
      if (ayah == null) return const [];
      final name = surahs.firstWhere((s) => s.number == ref.surah).name;
      return [QuranSearchResult(ayah, name)];
    }

    final needle = normalizeArabic(trimmed);
    final needleLower = trimmed.toLowerCase();
    final results = <QuranSearchResult>[];

    // Surah-name match first: return that surah's opening ayahs.
    final nameMatch = surahs.where(
      (s) =>
          normalizeArabic(s.name).contains(needle) ||
          s.transliteration.toLowerCase().contains(needleLower),
    );
    for (final s in nameMatch.take(1)) {
      final ayahs = await getSurahAyahs(s.number);
      for (final a in ayahs.take(limit)) {
        results.add(QuranSearchResult(a, s.name));
      }
      if (results.isNotEmpty) return results;
    }

    for (final s in surahs) {
      final ayahs = await getSurahAyahs(s.number);
      for (final a in ayahs) {
        final hit =
            normalizeArabic(a.text).contains(needle) ||
            (a.translation?.toLowerCase().contains(needleLower) ?? false);
        if (hit) {
          results.add(QuranSearchResult(a, s.name));
          if (results.length >= limit) return results;
        }
      }
    }
    return results;
  }

  /// Deterministic verse of the day from the verified dataset.
  Future<QuranSearchResult> verseOfDay(DateTime now) async {
    final surahs = await listSurahs();
    final dayIndex = now.difference(DateTime.utc(2024)).inDays % surahs.length;
    final surah = surahs[dayIndex < 0 ? 0 : dayIndex];
    final ayahs = await getSurahAyahs(surah.number);
    final ayah = ayahs[now.day % ayahs.length];
    return QuranSearchResult(ayah, surah.name);
  }
}
