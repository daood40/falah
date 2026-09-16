/// Riverpod wiring for the hadith feature.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/models.dart';
import 'hadith_api_client.dart';
import 'hadith_repository.dart';

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
  (ref) async => (await ref.watch(hadithRepositoryProvider).listBooks()).items,
);

final hadithChaptersProvider = FutureProvider.family<List<HadithChapter>, String>(
  (ref, bookId) async => (await ref.watch(hadithRepositoryProvider).listChapters(bookId: bookId)).items,
);

final bookHadithsProvider = FutureProvider.family<Paged<Hadith>, String>(
  (ref, bookId) => ref.watch(hadithRepositoryProvider).bookHadiths(bookId),
);

final hadithProvider = FutureProvider.family<Hadith, String>(
  (ref, id) => ref.watch(hadithRepositoryProvider).getHadith(id),
);

final hadithSearchProvider = FutureProvider.family<Paged<Hadith>, String>((ref, query) {
  if (query.trim().length < 2) {
    return const Paged<Hadith>(items: [], page: 1, limit: 20, total: 0);
  }
  return ref.watch(hadithRepositoryProvider).search(query.trim());
});
