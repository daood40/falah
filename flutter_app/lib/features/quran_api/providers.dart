/// Riverpod wiring for the Quran API layer.
///
/// Configuration comes from `--dart-define-from-file=config/<env>.json`
/// (see `config/README.md`). When `QURAN_API_BASE_URL` is empty the app keeps
/// using the bundled offline repository and makes no network call, so a build
/// can never fall back to a developer machine or a guessed host.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'data/api_client.dart';
import 'data/audio_api_data_source.dart';
import 'data/audio_repository.dart';
import 'data/http_transport_io.dart';
import 'data/quran_api_data_source.dart';
import 'data/quran_api_repository.dart';
import 'data/reciter_repository.dart';
import 'domain/models.dart';
import 'offline/quran_cache.dart';

const quranApiBaseUrl = String.fromEnvironment('QURAN_API_BASE_URL');
const quranApiEdition = String.fromEnvironment('QURAN_API_EDITION');
const falahEnv = String.fromEnvironment('FALAH_ENV', defaultValue: 'development');

/// True only when a base URL was configured for this build.
final quranApiEnabledProvider = Provider<bool>((_) => quranApiBaseUrl.isNotEmpty);

/// Outside development the API must be reached over HTTPS; a plain-HTTP base
/// URL in a staging/production build is a configuration error, not a fallback.
bool isApiBaseUrlValid() {
  if (quranApiBaseUrl.isEmpty) return false;
  if (falahEnv == 'development') return true;
  return quranApiBaseUrl.startsWith('https://');
}

/// Supabase access token provider — overridden by the auth layer once a user
/// is signed in. Anonymous by default.
final quranApiTokenProvider = Provider<TokenProvider>((_) => () => null);

final httpTransportProvider = Provider<HttpTransport>((ref) {
  final transport = IoHttpTransport();
  ref.onDispose(transport.close);
  return transport;
});

final quranApiClientProvider = Provider<QuranApiClient>(
  (ref) => QuranApiClient(
    baseUrl: quranApiBaseUrl,
    transport: ref.watch(httpTransportProvider),
    tokenProvider: ref.watch(quranApiTokenProvider),
  ),
);

final quranCacheStorageProvider = Provider<CacheStorage>(
  (_) => InMemoryCacheStorage(),
);

final quranOfflineCacheProvider = Provider<QuranOfflineCache>(
  (ref) => QuranOfflineCache(storage: ref.watch(quranCacheStorageProvider)),
);

final quranApiDataSourceProvider = Provider<QuranApiDataSource>(
  (ref) => QuranApiDataSource(ref.watch(quranApiClientProvider)),
);

final audioApiDataSourceProvider = Provider<AudioApiDataSource>(
  (ref) => AudioApiDataSource(ref.watch(quranApiClientProvider)),
);

final quranApiRepositoryProvider = Provider<QuranApiRepository>(
  (ref) => QuranApiRepository(
    remote: ref.watch(quranApiDataSourceProvider),
    cache: ref.watch(quranOfflineCacheProvider),
    edition: quranApiEdition.isEmpty ? null : quranApiEdition,
  ),
);

final reciterRepositoryProvider = Provider<ReciterRepository>(
  (ref) => ReciterRepository(ref.watch(audioApiDataSourceProvider)),
);

final audioRepositoryProvider = Provider<AudioRepository>(
  (ref) => AudioRepository(ref.watch(audioApiDataSourceProvider)),
);

final apiSurahListProvider = FutureProvider<List<QuranSurah>>(
  (ref) => ref.watch(quranApiRepositoryProvider).listSurahs(),
);

final apiSurahAyahsProvider = FutureProvider.family<List<QuranAyah>, int>(
  (ref, surah) => ref.watch(quranApiRepositoryProvider).getSurah(surah),
);

final apiRecitersProvider = FutureProvider<List<QuranReciter>>(
  (ref) => ref.watch(reciterRepositoryProvider).getReciters(),
);
