/// Audio repository: playable files only.
///
/// A file is playable when its verification passed. Files whose licence does
/// not allow redistribution still stream (when the source permits it) but never
/// expose a download URL — that decision is made by the API, mirrored here.
library;

import '../domain/models.dart';
import '../domain/repositories.dart';
import 'audio_api_data_source.dart';
import 'quran_api_data_source.dart' show kMaxApiPageLimit;

class AudioRepository implements AudioRepositoryContract {
  const AudioRepository(this._remote);

  final AudioApiDataSource _remote;

  @override
  Future<List<QuranAudioFile>> getAyahAudio(String ayahId) async {
    final files = await _remote.getAyahAudio(ayahId);
    return files.where((file) => file.verified).toList(growable: false);
  }

  @override
  Future<List<QuranAudioFile>> getSurahAudio(String reciter, int surah) async {
    final files = await _collect(
      (page) => _remote.getSurahAudio(
        reciter,
        surah,
        page: page,
        limit: kMaxApiPageLimit,
      ),
    );
    return files.where((file) => file.verified).toList(growable: false);
  }

  @override
  Future<List<QuranAudioFile>> getJuzAudio(String reciter, int juz) async {
    final files = await _collect(
      (page) => _remote.getJuzAudio(
        reciter,
        juz,
        page: page,
        limit: kMaxApiPageLimit,
      ),
    );
    return files.where((file) => file.verified).toList(growable: false);
  }

  /// A surah or juz holds more files than one page carries, so every page is
  /// read before the list is filtered.
  Future<List<QuranAudioFile>> _collect(
    Future<Paginated<QuranAudioFile>> Function(int page) fetch,
  ) async {
    var current = await fetch(1);
    final all = [...current.items];
    while (current.hasMore) {
      current = await fetch(current.page + 1);
      all.addAll(current.items);
    }
    return all;
  }

  /// Files that may be stored on the device for offline listening.
  Future<List<QuranAudioFile>> downloadableSurahAudio(
    String reciter,
    int surah,
  ) async {
    final files = await getSurahAudio(reciter, surah);
    return files.where((file) => file.downloadable).toList(growable: false);
  }
}
