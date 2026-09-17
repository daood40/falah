/// Riverpod wiring for the hadith feature.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';


import 'package:falah_hadith_api/falah_hadith_api.dart';

/// Set at build time: flutter build --dart-define=FALAH_API_BASE_URL=https://…
const String kFalahApiBaseUrl = String.fromEnvironment(
  'FALAH_API_BASE_URL',
  defaultValue: 'http://127.0.0.1:8787',
);

final hadithApiClientProvider = Provider<HadithApiClient>((ref) {
  final client = HadithApiClient(baseUrl: kFalahApiBaseUrl);
  ref.onDispose(client.close);
  return client;
});

final hadithRepositoryProvider = Provider<HadithRepository>(
  (ref) => HadithRepository(ref.watch(hadithApiClientProvider)),
);

final hadithBooksProvider = FutureProvider<List<HadithBook>>(
  (ref) async => (await ref.watch(hadithRepositoryProvider).getBooks()).items,
);

final hadithChaptersProvider = FutureProvider.family<List<HadithChapter>, String>(
  (ref, bookId) async => (await ref.watch(hadithRepositoryProvider).getChapters(bookId)).items,
);

final bookHadithsProvider = FutureProvider.family<Paged<HadithSummary>, String>(
  (ref, bookId) => ref.watch(hadithRepositoryProvider).getBookHadiths(bookId),
);

final hadithProvider = FutureProvider.family<Hadith, String>(
  (ref, id) => ref.watch(hadithRepositoryProvider).getHadith(id),
);

final hadithSearchProvider = FutureProvider.family<Paged<HadithSummary>, String>(
  (ref, query) => ref.watch(hadithRepositoryProvider).searchHadiths(query),
);
