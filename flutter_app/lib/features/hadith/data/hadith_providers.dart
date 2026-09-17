/// Riverpod wiring for the hadith feature.
///
/// Falah reads the Hadith API and nothing else: no SQL, no second copy of the
/// corpus, no religious text in the app. Every setting that differs between
/// staging and production comes from the build environment, so moving between
/// them needs no code change.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:falah_hadith_api/falah_hadith_api.dart';

import '../../../core/settings/settings.dart';
import 'hadith_cache_store.dart';

/// Set at build time per flavour (§27):
///   flutter run   --dart-define=FALAH_API_BASE_URL=http://127.0.0.1:8799
///   flutter build --dart-define=FALAH_API_BASE_URL=https://api.staging.falah.app
///   flutter build --dart-define=FALAH_API_BASE_URL=https://api.falah.app
const String kFalahApiBaseUrl = String.fromEnvironment(
  'FALAH_API_BASE_URL',
  defaultValue: 'http://127.0.0.1:8787',
);

/// Request timeout, also environment-controlled: a slow mobile network needs a
/// different budget from a desktop test run.
const int kFalahApiTimeoutSeconds = int.fromEnvironment(
  'FALAH_API_TIMEOUT_SECONDS',
  defaultValue: 15,
);

/// How many items a list page asks for. The server caps it at 100.
const int kHadithPageSize = int.fromEnvironment('FALAH_API_PAGE_SIZE', defaultValue: 20);

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
  final client = HadithApiClient(
    baseUrl: kFalahApiBaseUrl,
    timeout: const Duration(seconds: kFalahApiTimeoutSeconds),
  );
  ref.onDispose(client.close);
  return client;
});

final hadithRepositoryProvider = Provider<HadithRepository>(
  (ref) => HadithRepository(ref.watch(hadithApiClientProvider)),
);

/// The cache, restored from disk at first use.
final hadithCacheStoreProvider = Provider<HadithCacheStore>((ref) {
  final store = HadithCacheStore(HadithCache(), ref.watch(prefsProvider));
  store.load();
  return store;
});

/// Riverpod retries a failed provider on its own, and while it retries the
/// state stays "loading" with the error attached — so a screen that branches on
/// `isLoading` would spin forever instead of telling the reader the server is
/// unreachable. Retrying is the reader's decision here, through the retry
/// button, so the automatic one is switched off everywhere in this feature.
Duration? _noAutoRetry(int retryCount, Object error) => null;

/// `GET /api/v1/version` — the dataset identity every cached record is judged
/// against. Reading it also drops a cache that belongs to an older dataset.
final apiVersionProvider = FutureProvider<ApiVersion>((ref) async {
  final version = await ref.watch(hadithRepositoryProvider).getVersion();
  await ref.watch(hadithCacheStoreProvider).syncDataset(version);
  return version;
}, retry: _noAutoRetry);

/// `GET /api/v1/health` — used by the service-unavailable screen to tell
/// "the server is down" from "this request failed".
final apiHealthProvider = FutureProvider<bool>(
  (ref) => ref.watch(hadithRepositoryProvider).healthy(),
  retry: _noAutoRetry,
);

final hadithBooksProvider = FutureProvider<List<HadithBook>>(
  (ref) async => (await ref.watch(hadithRepositoryProvider).getBooks(limit: 100)).items,
  retry: _noAutoRetry,
);

final hadithChaptersProvider = FutureProvider.family<List<HadithChapter>, String>(
  (ref, bookId) async =>
      (await ref.watch(hadithRepositoryProvider).getChapters(bookId, limit: 100)).items,
  retry: _noAutoRetry,
);

final hadithBookProvider = FutureProvider.family<HadithBook, String>(
  (ref, id) => ref.watch(hadithRepositoryProvider).getBook(id),
  retry: _noAutoRetry,
);

final hadithChapterProvider = FutureProvider.family<HadithChapter, String>(
  (ref, id) => ref.watch(hadithRepositoryProvider).getChapter(id),
  retry: _noAutoRetry,
);

/// One hadith, cache first. A cached copy is only used while it still matches
/// the dataset and its own checksum; otherwise the server is asked.
final hadithProvider = FutureProvider.family<Hadith, String>((ref, id) async {
  final store = ref.watch(hadithCacheStoreProvider);
  final cached = store.get(id);
  if (cached != null) return cached;
  final fresh = await ref
      .watch(hadithRepositoryProvider)
      .getHadith(id, include: const ['takhrij', 'gradings', 'verification', 'narrators']);
  await store.put(fresh);
  return fresh;
}, retry: _noAutoRetry);

// ---------------- classifications ----------------
// Every way the edition organises itself is its own resource, so every one of
// them is its own provider. None of them carries hadith text.

/// `GET /api/v1/volumes` — the printed volumes with their page ranges.
final hadithVolumesProvider = FutureProvider<List<Volume>>(
  (ref) => ref.watch(hadithRepositoryProvider).getVolumes(),
  retry: _noAutoRetry,
);

/// `GET /api/v1/collections` — the collections this edition cites in takhrij.
final hadithCollectionsProvider = FutureProvider<List<Collection>>(
  (ref) => ref.watch(hadithRepositoryProvider).getCollections(),
  retry: _noAutoRetry,
);

/// `GET /api/v1/gradings` — the grading labels the author used, with counts.
final hadithGradingLabelsProvider = FutureProvider<List<Grading>>(
  (ref) => ref.watch(hadithRepositoryProvider).getGradingLabels(),
  retry: _noAutoRetry,
);

/// `GET /api/v1/editions` — the printings this service holds.
final hadithEditionsProvider = FutureProvider<List<HadithEdition>>(
  (ref) => ref.watch(hadithRepositoryProvider).getEditions(),
  retry: _noAutoRetry,
);

/// `GET /api/v1/sources` — where the text came from, with its licence state.
final hadithSourcesProvider = FutureProvider<List<HadithSource>>(
  (ref) => ref.watch(hadithRepositoryProvider).getSources(),
  retry: _noAutoRetry,
);

/// `GET /api/v1/datasets` — every dataset version, sealed or superseded.
final hadithDatasetsProvider = FutureProvider<List<DatasetVersion>>(
  (ref) => ref.watch(hadithRepositoryProvider).getDatasets(),
  retry: _noAutoRetry,
);

/// `GET /api/v1/stats` — the corpus in numbers.
final hadithStatsProvider = FutureProvider<HadithStats>(
  (ref) => ref.watch(hadithRepositoryProvider).getStats(),
  retry: _noAutoRetry,
);

/// `GET /api/v1/catalog` — books with their chapters, one tree.
final hadithCatalogProvider = FutureProvider<List<HadithBook>>(
  (ref) => ref.watch(hadithRepositoryProvider).getCatalog(withChapters: true),
  retry: _noAutoRetry,
);

/// `GET /api/v1/cross-checks/summary` — how the dataset compares with an
/// independent corpus. Machine evidence, never a ruling on a hadith.
final crossCheckSummaryProvider = FutureProvider<List<CrossCheckSummary>>(
  (ref) => ref.watch(hadithRepositoryProvider).getCrossCheckSummary(),
  retry: _noAutoRetry,
);

/// `GET /api/v1/hadiths/{id}/cross-checks` — the evidence for one record.
final hadithCrossChecksProvider = FutureProvider.family<List<CrossCheck>, String>(
  (ref, id) => ref.watch(hadithRepositoryProvider).getCrossChecks(id),
  retry: _noAutoRetry,
);

/// Narrators, paged, optionally filtered by name.
class NarratorQuery {
  const NarratorQuery({this.page = 1, this.name = ''});

  final int page;
  final String name;

  @override
  bool operator ==(Object other) =>
      other is NarratorQuery && other.page == page && other.name == name;

  @override
  int get hashCode => Object.hash(page, name);
}

final hadithNarratorsProvider = FutureProvider.family<Paged<Narrator>, NarratorQuery>(
  (ref, q) => ref.watch(hadithRepositoryProvider).getAllNarrators(
        page: q.page,
        limit: 50,
        name: q.name.isEmpty ? null : q.name,
      ),
  retry: _noAutoRetry,
);

/// The review queue: records an independent corpus did not corroborate.
/// Nothing here is changed by the app — it is a reading list for a human.
final reviewQueueProvider = FutureProvider.family<Paged<ReviewQueueItem>, int>(
  (ref, page) => ref.watch(hadithRepositoryProvider).getCrossCheckReviewQueue(page: page),
  retry: _noAutoRetry,
);

/// Which list a page request belongs to.
enum HadithListKind { all, book, chapter, search, volume, collection, grading, narrator }

class HadithListQuery {
  const HadithListQuery(this.kind, [this.value = '']);

  final HadithListKind kind;

  /// A book id, a chapter id or a search term, depending on [kind].
  final String value;

  @override
  bool operator ==(Object other) =>
      other is HadithListQuery && other.kind == kind && other.value == value;

  @override
  int get hashCode => Object.hash(kind, value);
}

/// A page of the slim list shape, plus everything the UI needs to page through
/// it. `items` accumulates; `total` and `hasMore` come from the server's meta.
class HadithListState {
  const HadithListState({
    this.items = const [],
    this.page = 0,
    this.total = 0,
    this.hasMore = true,
    this.loadingMore = false,
    this.error,
  });

  final List<HadithSummary> items;
  final int page;
  final int total;
  final bool hasMore;
  final bool loadingMore;
  final ApiException? error;

  HadithListState copyWith({
    List<HadithSummary>? items,
    int? page,
    int? total,
    bool? hasMore,
    bool? loadingMore,
    ApiException? error,
    bool clearError = false,
  }) =>
      HadithListState(
        items: items ?? this.items,
        page: page ?? this.page,
        total: total ?? this.total,
        hasMore: hasMore ?? this.hasMore,
        loadingMore: loadingMore ?? this.loadingMore,
        error: clearError ? null : (error ?? this.error),
      );
}

/// Paging is explicit: the first page is fetched once, later pages only when
/// the list is scrolled to its end. Nothing is prefetched behind the user.
class HadithListNotifier extends AsyncNotifier<HadithListState> {
  HadithListNotifier(this.query);

  final HadithListQuery query;

  Future<Paged<HadithSummary>> _fetch(int page) {
    final repo = ref.read(hadithRepositoryProvider);
    switch (query.kind) {
      case HadithListKind.all:
        return repo.getHadiths(page: page, limit: kHadithPageSize);
      case HadithListKind.book:
        return repo.getBookHadiths(query.value, page: page, limit: kHadithPageSize);
      case HadithListKind.chapter:
        return repo.getChapterHadiths(query.value, page: page, limit: kHadithPageSize);
      case HadithListKind.search:
        return repo.searchHadiths(query.value, page: page, limit: kHadithPageSize);
      case HadithListKind.volume:
        return repo.getVolumeHadiths(int.parse(query.value), page: page, limit: kHadithPageSize);
      case HadithListKind.collection:
        return repo.getCollectionHadiths(query.value, page: page, limit: kHadithPageSize);
      case HadithListKind.grading:
        return repo.getHadiths(grading: query.value, page: page, limit: kHadithPageSize);
      case HadithListKind.narrator:
        return repo.getNarratorHadiths(query.value, page: page, limit: kHadithPageSize);
    }
  }

  @override
  Future<HadithListState> build() async {
    if (query.kind == HadithListKind.search && query.value.trim().length < 2) {
      return const HadithListState(hasMore: false);
    }
    final first = await _fetch(1);
    return HadithListState(
      items: first.items,
      page: 1,
      total: first.total,
      hasMore: first.items.length < first.total,
    );
  }

  /// Loads the next page. Errors are attached to the state instead of
  /// replacing the list: a failed "load more" must not lose what is on screen.
  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.loadingMore) return;
    state = AsyncData(current.copyWith(loadingMore: true, clearError: true));
    try {
      final next = await _fetch(current.page + 1);
      final items = [...current.items, ...next.items];
      state = AsyncData(
        current.copyWith(
          items: items,
          page: current.page + 1,
          total: next.total,
          hasMore: items.length < next.total && next.items.isNotEmpty,
          loadingMore: false,
          clearError: true,
        ),
      );
    } on ApiException catch (e) {
      state = AsyncData(current.copyWith(loadingMore: false, error: e));
    }
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(build);
  }
}

final hadithListProvider =
    AsyncNotifierProvider.family<HadithListNotifier, HadithListState, HadithListQuery>(
  HadithListNotifier.new,
  retry: _noAutoRetry,
);

/// The term the search screen is currently showing results for. Empty until
/// the user submits, so opening the screen fires no request.
class HadithSearchTerm extends Notifier<String> {
  @override
  String build() => '';

  void set(String term) => state = term.trim();
}

final hadithSearchTermProvider =
    NotifierProvider<HadithSearchTerm, String>(HadithSearchTerm.new);
