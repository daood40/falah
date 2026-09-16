/// Audio repository: playable files only.
///
/// A file is playable when its verification passed. Files whose licence does
/// not allow redistribution still stream (when the source permits it) but never
/// expose a download URL — that decision is made by the API, mirrored here.
library;

import '../domain/models.dart';
import '../domain/repositories.dart';
import 'audio_api_data_source.dart';

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
    final result = await _remote.getSurahAudio(reciter, surah, limit: 300);
    return result.items.where((file) => file.verified).toList(growable: false);
  }

  @override
  Future<List<QuranAudioFile>> getJuzAudio(String reciter, int juz) async {
    final result = await _remote.getJuzAudio(reciter, juz, limit: 300);
    return result.items.where((file) => file.verified).toList(growable: false);
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
