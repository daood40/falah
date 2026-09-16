/// Remote data source for reciters, recitations and audio files.
library;

import '../domain/models.dart';
import 'api_client.dart';

class AudioApiDataSource {
  const AudioApiDataSource(this._client);

  final QuranApiClient _client;

  Future<Paginated<QuranReciter>> listReciters({
    String? search,
    int page = 1,
    int limit = 20,
  }) async {
    final envelope = await _client.get<List<QuranReciter>>(
      '/reciters',
      query: {'search': search, 'page': '$page', 'limit': '$limit'},
      parse: (data) => parseList(data, QuranReciter.fromJson),
    );
    return Paginated.fromEnvelope(envelope);
  }

  Future<QuranReciter> getReciter(String idOrSlug) async {
    final envelope = await _client.get<QuranReciter>(
      '/reciters/$idOrSlug',
      parse: (data) =>
          QuranReciter.fromJson((data as Map).cast<String, dynamic>()),
    );
    return envelope.data;
  }

  Future<List<QuranRiwayah>> getReciterRiwayat(String idOrSlug) async {
    final envelope = await _client.get<List<QuranRiwayah>>(
      '/reciters/$idOrSlug/riwayat',
      parse: (data) => parseList(data, QuranRiwayah.fromJson),
    );
    return envelope.data;
  }

  Future<List<QuranRecitation>> getRecitations(String idOrSlug) async {
    final envelope = await _client.get<List<QuranRecitation>>(
      '/reciters/$idOrSlug/recitations',
      parse: (data) => parseList(data, QuranRecitation.fromJson),
    );
    return envelope.data;
  }

  Future<Paginated<QuranAudioFile>> getSurahAudio(
    String reciter,
    int surah, {
    int page = 1,
    int limit = 100,
  }) async {
    final envelope = await _client.get<List<QuranAudioFile>>(
      '/reciters/$reciter/surahs/$surah',
      query: {'page': '$page', 'limit': '$limit'},
      parse: (data) => parseList(data, QuranAudioFile.fromJson),
    );
    return Paginated.fromEnvelope(envelope);
  }

  Future<Paginated<QuranAudioFile>> getJuzAudio(
    String reciter,
    int juz, {
    int page = 1,
    int limit = 100,
  }) async {
    final envelope = await _client.get<List<QuranAudioFile>>(
      '/reciters/$reciter/juzs/$juz',
      query: {'page': '$page', 'limit': '$limit'},
      parse: (data) => parseList(data, QuranAudioFile.fromJson),
    );
    return Paginated.fromEnvelope(envelope);
  }

  Future<Paginated<QuranAudioFile>> getFullQuranAudio(
    String reciter, {
    int page = 1,
    int limit = 100,
  }) async {
    final envelope = await _client.get<List<QuranAudioFile>>(
      '/reciters/$reciter/full-quran',
      query: {'page': '$page', 'limit': '$limit'},
      parse: (data) => parseList(data, QuranAudioFile.fromJson),
    );
    return Paginated.fromEnvelope(envelope);
  }

  Future<List<QuranAudioFile>> getAyahAudio(String ayahId) async {
    final envelope = await _client.get<List<QuranAudioFile>>(
      '/ayahs/$ayahId/audio',
      parse: (data) => parseList(data, QuranAudioFile.fromJson),
    );
    return envelope.data;
  }

  Future<Paginated<QuranAudioFile>> searchAudio({
    String? reciter,
    int? surah,
    String? riwayah,
    String? format,
    int page = 1,
    int limit = 20,
  }) async {
    final envelope = await _client.get<List<QuranAudioFile>>(
      '/audio/search',
      query: {
        'reciter': reciter,
        'surah': surah?.toString(),
        'riwayah': riwayah,
        'format': format,
        'page': '$page',
        'limit': '$limit',
      },
      parse: (data) => parseList(data, QuranAudioFile.fromJson),
    );
    return Paginated.fromEnvelope(envelope);
  }
}
