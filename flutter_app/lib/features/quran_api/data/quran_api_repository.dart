/// Quran repository over the FALAH API with an offline-first cache.
///
/// Read path: cache → API → cache write. Every cached ayah is re-checked
/// against its `content_hash` before it is served, so a corrupted or tampered
/// cache entry is dropped instead of being shown (SOURCE_LOCK).
library;

import '../domain/models.dart';
import '../domain/repositories.dart';
import '../offline/quran_cache.dart';
import 'api_client.dart';
import 'quran_api_data_source.dart';

class QuranApiRepository implements QuranApiRepositoryContract {
  QuranApiRepository({
    required QuranApiDataSource remote,
    QuranOfflineCache? cache,
    this.edition,
  }) : _remote = remote,
       _cache = cache;

  final QuranApiDataSource _remote;
  final QuranOfflineCache? _cache;
  final String? edition;

  @override
  Future<List<QuranSurah>> listSurahs() async {
    final cached = await _cache?.readSurahs();
    if (cached != null && cached.isNotEmpty) return cached;
    final surahs = await _remote.listSurahs(edition: edition);
    await _cache?.writeSurahs(surahs);
    return surahs;
  }

  @override
  Future<List<QuranAyah>> getSurah(int surah, {String? translation}) async {
    if (translation == null) {
      final cached = await _cache?.readSurahAyahs(surah);
      if (cached != null && cached.isNotEmpty) return cached;
    }
    final result = await _remote.getSurahAyahs(
      surah,
      edition: edition,
      translation: translation,
      limit: kMaxApiPageLimit,
    );
    final ayahs = await _collect(result, (page) => _remote.getSurahAyahs(
          surah,
          edition: edition,
          translation: translation,
          page: page,
          limit: kMaxApiPageLimit,
        ));
    if (translation == null) await _cache?.writeSurahAyahs(surah, ayahs);
    return ayahs;
  }

  @override
  Future<QuranAyah> getAyah(int surah, int ayah, {String? translation}) async {
    final cached = await _cache?.readAyah(surah, ayah);
    if (cached != null && translation == null) return cached;
    return _remote.getAyah(surah, ayah, edition: edition, translation: translation);
  }

  @override
  Future<List<QuranAyah>> search(
    String query, {
    int? surah,
    String? language,
  }) async {
    final result = await _remote.search(
      query,
      surah: surah,
      language: language,
      edition: edition,
      limit: 50,
    );
    return result.items;
  }

  @override
  Future<List<QuranJuz>> listJuzs() => _remote.listJuzs(edition: edition);

  @override
  Future<List<QuranAyah>> getJuzAyahs(int juz) async {
    final first = await _remote.getJuzAyahs(juz, edition: edition, limit: kMaxApiPageLimit);
    return _collect(first, (page) =>
        _remote.getJuzAyahs(juz, edition: edition, page: page, limit: kMaxApiPageLimit));
  }

  @override
  Future<List<QuranHizb>> listHizbs() => _remote.listHizbs(edition: edition);

  @override
  Future<List<QuranRub>> listRubs() => _remote.listRubs(edition: edition);

  @override
  Future<List<QuranPage>> listPages() => _remote.listPages(edition: edition);

  @override
  Future<List<QuranManzil>> listManzils() =>
      _remote.listManzils(edition: edition);

  @override
  Future<List<QuranRuku>> listRukus({int? surah}) =>
      _remote.listRukus(surah: surah, edition: edition);

  @override
  Future<List<QuranAyah>> getRukuAyahs(int ruku) async {
    final first = await _remote.getRukuAyahs(
      ruku,
      edition: edition,
      limit: kMaxApiPageLimit,
    );
    return _collect(
      first,
      (page) => _remote.getRukuAyahs(
        ruku,
        edition: edition,
        page: page,
        limit: kMaxApiPageLimit,
      ),
    );
  }

  @override
  Future<List<QuranSajdah>> listSajdahs() =>
      _remote.listSajdahs(edition: edition);

  @override
  Future<List<QuranAyah>> getPageAyahs(int page) async {
    final result = await _remote.getPageAyahs(page, edition: edition);
    return result.items;
  }

  @override
  Future<List<QuranTranslation>> listTranslations({String? language}) =>
      _remote.listTranslations(language: language);

  /// Walks the API pagination until every ayah of the range is collected.
  Future<List<QuranAyah>> _collect(
    Paginated<QuranAyah> first,
    Future<Paginated<QuranAyah>> Function(int page) next,
  ) async {
    final all = [...first.items];
    var current = first;
    while (current.hasMore) {
      current = await next(current.page + 1);
      all.addAll(current.items);
    }
    return all;
  }
}

/// Wraps API failures so the UI can show the four states without leaking codes.
class QuranRepositoryFailure implements Exception {
  const QuranRepositoryFailure(this.reason, {this.cause});
  final String reason;
  final QuranApiException? cause;
}
