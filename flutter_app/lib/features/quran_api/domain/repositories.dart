/// Repository contracts consumed by the presentation layer (Clean Architecture).
library;

import 'models.dart';

abstract class QuranApiRepositoryContract {
  Future<List<QuranSurah>> listSurahs();
  Future<List<QuranAyah>> getSurah(int surah, {String? translation});
  Future<QuranAyah> getAyah(int surah, int ayah, {String? translation});
  Future<List<QuranAyah>> search(String query, {int? surah, String? language});
  Future<List<QuranJuz>> listJuzs();
  Future<List<QuranAyah>> getJuzAyahs(int juz);
  Future<List<QuranAyah>> getPageAyahs(int page);
  Future<List<QuranTranslation>> listTranslations({String? language});
}

abstract class ReciterRepositoryContract {
  Future<List<QuranReciter>> getReciters({String? search});
  Future<QuranReciter> getReciter(String idOrSlug);
  Future<List<QuranRiwayah>> getRiwayat(String idOrSlug);
  Future<List<QuranRecitation>> getRecitations(String idOrSlug);
}

abstract class AudioRepositoryContract {
  Future<List<QuranAudioFile>> getAyahAudio(String ayahId);
  Future<List<QuranAudioFile>> getSurahAudio(String reciter, int surah);
  Future<List<QuranAudioFile>> getJuzAudio(String reciter, int juz);
}
