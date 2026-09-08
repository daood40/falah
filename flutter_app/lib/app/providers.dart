// App-level Riverpod providers: repositories and derived async data.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/quran/data/quran_repository.dart';
import '../features/quran/domain/models.dart';

final quranRepositoryProvider = Provider<QuranRepository>(
  (ref) => QuranRepository(),
);

final surahListProvider = FutureProvider<List<Surah>>(
  (ref) => ref.watch(quranRepositoryProvider).listSurahs(),
);

final surahMetaProvider = FutureProvider.family<Surah?, int>(
  (ref, n) => ref.watch(quranRepositoryProvider).surahByNumber(n),
);

final surahAyahsProvider = FutureProvider.family<List<Ayah>, int>(
  (ref, n) => ref.watch(quranRepositoryProvider).getSurahAyahs(n),
);

final verseOfDayProvider = FutureProvider<QuranSearchResult>(
  (ref) => ref.watch(quranRepositoryProvider).verseOfDay(DateTime.now()),
);
