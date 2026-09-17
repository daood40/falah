/// Riverpod wiring for the hadith feature.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';


import 'package:falah_hadith_api/falah_hadith_api.dart';

/// Set at build time per flavour (§27):
///   flutter run   --dart-define=FALAH_API_BASE_URL=http://127.0.0.1:8787
///   flutter build --dart-define=FALAH_API_BASE_URL=https://api.staging.falah.app
///   flutter build --dart-define=FALAH_API_BASE_URL=https://api.falah.app
const String kFalahApiBaseUrl = String.fromEnvironment(
  'FALAH_API_BASE_URL',
  defaultValue: 'http://127.0.0.1:8787',
);

/// A release build pointed at localhost would ship an app that talks to the
/// phone itself. Caught here rather than in the store review.
bool isUsableApiBaseUrl(String url, {required bool releaseMode}) {
  if (url.isEmpty) return false;
  if (!releaseMode) return true;
  final uri = Uri.tryParse(url);
  if (uri == null || !uri.hasScheme) return false;
  if (uri.scheme != 'https') return false;
  return !const ['localhost', '127.0.0.1', '10.0.2.2', '0.0.0.0'].contains(uri.host);
}

final hadithApiClientProvider = Provider<HadithApiClient>((ref) {
  assert(
    isUsableApiBaseUrl(kFalahApiBaseUrl, releaseMode: const bool.fromEnvironment('dart.vm.product')),
    'FALAH_API_BASE_URL must be an https host in a release build, not "$kFalahApiBaseUrl". '
    'Pass --dart-define=FALAH_API_BASE_URL=https://…',
  );
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
