/// Remote data source for Quran text and structure (`/api/v1`).
library;

import '../domain/models.dart';
import 'api_client.dart';

class QuranApiDataSource {
  const QuranApiDataSource(this._client);

  final QuranApiClient _client;

  Future<List<QuranSurah>> listSurahs({String? edition}) async {
    final envelope = await _client.get<List<QuranSurah>>(
      '/surahs',
      query: {'edition': edition, 'limit': '114'},
      parse: (data) => parseList(data, QuranSurah.fromJson),
    );
    return envelope.data;
  }

  Future<QuranSurah> getSurah(int surah, {String? edition}) async {
    final envelope = await _client.get<QuranSurah>(
      '/surahs/$surah',
      query: {'edition': edition},
      parse: (data) => QuranSurah.fromJson((data as Map).cast<String, dynamic>()),
    );
    return envelope.data;
  }

  Future<Paginated<QuranAyah>> getSurahAyahs(
    int surah, {
    String? edition,
    String? translation,
    int page = 1,
    int limit = 100,
  }) async {
    final envelope = await _client.get<List<QuranAyah>>(
      '/surahs/$surah/ayahs',
      query: {
        'edition': edition,
        'translation': translation,
        'page': '$page',
        'limit': '$limit',
      },
      parse: (data) => parseList(data, QuranAyah.fromJson),
    );
    return Paginated.fromEnvelope(envelope);
  }

  Future<QuranAyah> getAyah(
    int surah,
    int ayah, {
    String? edition,
    String? translation,
  }) async {
    final envelope = await _client.get<QuranAyah>(
      '/ayahs/by-key/$surah:$ayah',
      query: {'edition': edition, 'translation': translation},
      parse: (data) => QuranAyah.fromJson((data as Map).cast<String, dynamic>()),
    );
    return envelope.data;
  }

  Future<QuranAyah> getAyahById(String id, {String? translation}) async {
    final envelope = await _client.get<QuranAyah>(
      '/ayahs/$id',
      query: {'translation': translation},
      parse: (data) => QuranAyah.fromJson((data as Map).cast<String, dynamic>()),
    );
    return envelope.data;
  }

  Future<Paginated<QuranAyah>> search(
    String query, {
    int? surah,
    int? juz,
    int? hizb,
    String? language,
    String? edition,
    bool exact = false,
    int page = 1,
    int limit = 20,
  }) async {
    final envelope = await _client.get<List<QuranAyah>>(
      '/search',
      query: {
        'q': query,
        'surah': surah?.toString(),
        'juz': juz?.toString(),
        'hizb': hizb?.toString(),
        'language': language,
        'edition': edition,
        'exact': exact ? 'true' : null,
        'page': '$page',
        'limit': '$limit',
      },
      parse: (data) => parseList(data, QuranAyah.fromJson),
    );
    return Paginated.fromEnvelope(envelope);
  }

  Future<List<QuranJuz>> listJuzs({String? edition}) async {
    final envelope = await _client.get<List<QuranJuz>>(
      '/juzs',
      query: {'edition': edition},
      parse: (data) => parseList(data, QuranDivision.fromJson),
    );
    return envelope.data;
  }

  Future<Paginated<QuranAyah>> getJuzAyahs(
    int juz, {
    String? edition,
    String? translation,
    int page = 1,
    int limit = 100,
  }) async {
    final envelope = await _client.get<List<QuranAyah>>(
      '/juzs/$juz/ayahs',
      query: {
        'edition': edition,
        'translation': translation,
        'page': '$page',
        'limit': '$limit',
      },
      parse: (data) => parseList(data, QuranAyah.fromJson),
    );
    return Paginated.fromEnvelope(envelope);
  }

  Future<List<QuranHizb>> listHizbs({String? edition}) async {
    final envelope = await _client.get<List<QuranHizb>>(
      '/hizbs',
      query: {'edition': edition},
      parse: (data) => parseList(data, QuranDivision.fromJson),
    );
    return envelope.data;
  }

  Future<Paginated<QuranAyah>> getHizbAyahs(
    int hizb, {
    int? quarter,
    String? edition,
    int page = 1,
    int limit = 100,
  }) async {
    final envelope = await _client.get<List<QuranAyah>>(
      '/hizbs/$hizb/ayahs',
      query: {
        'quarter': quarter?.toString(),
        'edition': edition,
        'page': '$page',
        'limit': '$limit',
      },
      parse: (data) => parseList(data, QuranAyah.fromJson),
    );
    return Paginated.fromEnvelope(envelope);
  }

  Future<QuranPage> getPage(int page, {String? edition}) async {
    final envelope = await _client.get<QuranPage>(
      '/pages/$page',
      query: {'edition': edition},
      parse: (data) =>
          QuranDivision.fromJson((data as Map).cast<String, dynamic>()),
    );
    return envelope.data;
  }

  Future<Paginated<QuranAyah>> getPageAyahs(
    int page, {
    String? edition,
    String? translation,
    int limit = 100,
  }) async {
    final envelope = await _client.get<List<QuranAyah>>(
      '/pages/$page/ayahs',
      query: {'edition': edition, 'translation': translation, 'limit': '$limit'},
      parse: (data) => parseList(data, QuranAyah.fromJson),
    );
    return Paginated.fromEnvelope(envelope);
  }

  Future<List<QuranManzil>> listManzils({String? edition}) async {
    final envelope = await _client.get<List<QuranManzil>>(
      '/manzils',
      query: {'edition': edition},
      parse: (data) => parseList(data, QuranDivision.fromJson),
    );
    return envelope.data;
  }

  Future<List<QuranTranslation>> listTranslations({String? language}) async {
    final envelope = await _client.get<List<QuranTranslation>>(
      '/translations',
      query: {'language': language},
      parse: (data) => parseList(data, QuranTranslation.fromJson),
    );
    return envelope.data;
  }

  Future<List<QuranQiraah>> listQiraat() async {
    final envelope = await _client.get<List<QuranQiraah>>(
      '/qiraat',
      parse: (data) => parseList(data, QuranQiraah.fromJson),
    );
    return envelope.data;
  }

  Future<List<QuranRiwayah>> listRiwayat({String? qiraah}) async {
    final envelope = await _client.get<List<QuranRiwayah>>(
      '/riwayat',
      query: {'qiraah': qiraah},
      parse: (data) => parseList(data, QuranRiwayah.fromJson),
    );
    return envelope.data;
  }

  Future<QuranDownloadManifest> downloadManifest({
    String? edition,
    String? translation,
  }) async {
    final envelope = await _client.get<QuranDownloadManifest>(
      '/downloads/quran',
      query: {'edition': edition, 'translation': translation},
      parse: (data) =>
          QuranDownloadManifest.fromJson((data as Map).cast<String, dynamic>()),
    );
    return envelope.data;
  }
}
