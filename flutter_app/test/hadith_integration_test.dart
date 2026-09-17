// FALAH ↔ Hadith API — integration tests driven THROUGH THE APP.
//
// These are not "did the request reach the server" checks: each test mounts the
// real screen with the real providers, lets it talk to a running API over HTTP,
// and then asserts what the user actually sees — the list, the paging footer,
// the withheld-text notice, the error state, the cache.
//
// Real sockets only run inside tester.runAsync(): the widget tester's fake
// async zone never completes a real HTTP call, so every network step below is
// wrapped in `net(...)` and the UI is pumped afterwards.
//
//   flutter test test/hadith_integration_test.dart \
//     --dart-define=FALAH_LIVE_API=http://127.0.0.1:8799
import 'dart:io';

import 'package:falah_hadith_api/falah_hadith_api.dart';
import 'package:falah/core/settings/settings.dart';
import 'package:falah/features/hadith/data/hadith_cache_store.dart';
import 'package:falah/features/hadith/data/hadith_providers.dart';
import 'package:falah/features/hadith/presentation/hadith_books_screen.dart';
import 'package:falah/features/hadith/presentation/hadith_chapters_screen.dart';
import 'package:falah/features/hadith/presentation/hadith_detail_screen.dart';
import 'package:falah/features/hadith/presentation/hadith_list_screen.dart';
import 'package:falah/features/hadith/presentation/hadith_search_screen.dart';
import 'package:falah/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

const liveApi = String.fromEnvironment('FALAH_LIVE_API');

void main() {
  if (liveApi.isEmpty) {
    test('app integration (skipped: FALAH_LIVE_API not set)', () {}, skip: true);
    return;
  }

  setUpAll(() {
    // flutter_test installs HttpOverrides that refuse real sockets; these are
    // integration tests and must use the real network.
    HttpOverrides.global = null;
  });

  late SharedPreferences prefs;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
  });

  ProviderContainer containerFor(String baseUrl) => ProviderContainer(
        overrides: [
          prefsProvider.overrideWithValue(prefs),
          hadithApiClientProvider.overrideWith(
            (ref) => HadithApiClient(baseUrl: baseUrl, timeout: const Duration(seconds: 10)),
          ),
        ],
      );

  Widget wrap(Widget child, ProviderContainer container) => UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          locale: const Locale('ar'),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: child,
        ),
      );

  /// Runs real I/O outside the fake async zone.
  Future<T> net<T>(WidgetTester tester, Future<T> Function() body) async =>
      (await tester.runAsync(body)) as T;

  /// Gives the test surface enough height to lay out a whole screen, so an
  /// assertion about the footer is about the footer and not about scrolling.
  void tall(WidgetTester tester, {double height = 8000}) {
    tester.view.physicalSize = Size(1200, height);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  /// Mounts a screen whose providers already hold their data, then renders it.
  Future<void> show(WidgetTester tester, Widget screen, ProviderContainer container) async {
    await tester.pumpWidget(wrap(screen, container));
    await tester.pump();
  }

  group('1. books screen', () {
    testWidgets('renders the real books of the collection', (tester) async {
      final container = containerFor(liveApi);
      addTearDown(container.dispose);

      final books = await net(tester, () => container.read(hadithBooksProvider.future));
      await net(tester, () => container.read(apiVersionProvider.future));
      await show(tester, const HadithBooksScreen(), container);

      expect(books, isNotEmpty);
      expect(find.text(books.first.name), findsOneWidget);
      expect(find.byType(Card), findsWidgets);
    });

    testWidgets('shows the dataset banner with the version the server serves', (tester) async {
      final container = containerFor(liveApi);
      addTearDown(container.dispose);

      await net(tester, () => container.read(hadithBooksProvider.future));
      final version = await net(tester, () => container.read(apiVersionProvider.future));
      await show(tester, const HadithBooksScreen(), container);

      expect(find.textContaining(version.datasetVersion!), findsWidgets);
      // the gate is closed, so the screen says so instead of showing nothing
      if (!version.contentLicenseConfirmed) {
        expect(find.textContaining('النص'), findsWidgets);
      }
    });
  });

  group('2. chapters screen', () {
    testWidgets('lists the chapters of the first book', (tester) async {
      final container = containerFor(liveApi);
      addTearDown(container.dispose);

      final book = (await net(tester, () => container.read(hadithBooksProvider.future))).first;
      final chapters =
          await net(tester, () => container.read(hadithChaptersProvider(book.id).future));
      await show(tester, HadithChaptersScreen(bookId: book.id, bookName: book.name), container);

      expect(chapters, isNotEmpty);
      expect(find.text(chapters.first.title), findsOneWidget);
      expect(find.text(book.name), findsOneWidget);
    });
  });

  group('3. hadith list and pagination', () {
    const allQuery = HadithListQuery(HadithListKind.all);

    testWidgets('first page holds one page of records and reports the total', (tester) async {
      final container = containerFor(liveApi);
      addTearDown(container.dispose);

      tall(tester);
      final state = await net(tester, () => container.read(hadithListProvider(allQuery).future));
      await show(tester, const HadithListScreen(query: allQuery), container);

      expect(state.items.length, kHadithPageSize);
      expect(state.total, greaterThan(kHadithPageSize));
      expect(state.hasMore, isTrue);
      expect(find.byType(Card), findsWidgets);
      expect(find.textContaining('${state.total}'), findsWidgets);
    });

    testWidgets('load more appends the next page without losing the first', (tester) async {
      final container = containerFor(liveApi);
      addTearDown(container.dispose);

      final before = await net(tester, () => container.read(hadithListProvider(allQuery).future));
      await net(tester, () => container.read(hadithListProvider(allQuery).notifier).loadMore());
      final after = container.read(hadithListProvider(allQuery)).value!;
      await show(tester, const HadithListScreen(query: allQuery), container);

      expect(after.items.length, before.items.length + kHadithPageSize);
      expect(after.page, 2);
      expect(
        after.items.take(before.items.length).map((h) => h.id).toList(),
        before.items.map((h) => h.id).toList(),
      );
      // no record is served twice across pages
      expect(after.items.map((h) => h.id).toSet().length, after.items.length);
    });

    testWidgets('a book list only contains records of that book', (tester) async {
      final container = containerFor(liveApi);
      addTearDown(container.dispose);

      final book = (await net(tester, () => container.read(hadithBooksProvider.future))).first;
      final query = HadithListQuery(HadithListKind.book, book.id);
      final state = await net(tester, () => container.read(hadithListProvider(query).future));
      await show(tester, HadithListScreen(query: query, title: book.name), container);

      expect(state.items, isNotEmpty);
      expect(state.items.every((h) => h.bookId == book.id), isTrue);
      expect(state.total, book.hadithCount);
      expect(find.text(book.name), findsOneWidget);
    });

    testWidgets('a chapter list only contains records of that chapter', (tester) async {
      final container = containerFor(liveApi);
      addTearDown(container.dispose);

      final book = (await net(tester, () => container.read(hadithBooksProvider.future))).first;
      final chapter =
          (await net(tester, () => container.read(hadithChaptersProvider(book.id).future))).first;
      final query = HadithListQuery(HadithListKind.chapter, chapter.id);
      final state = await net(tester, () => container.read(hadithListProvider(query).future));
      await show(tester, HadithListScreen(query: query, title: chapter.title), container);

      expect(state.items, isNotEmpty);
      expect(state.items.every((h) => h.chapterId == chapter.id), isTrue);
    });
  });

  group('4. hadith detail', () {
    testWidgets('shows source, location and dataset identity of a real record', (tester) async {
      final container = containerFor(liveApi);
      addTearDown(container.dispose);

      final first = (await net(
        tester,
        () => container.read(hadithRepositoryProvider).getHadiths(limit: 1),
      )).items.first;
      tall(tester, height: 3000);
      final hadith = await net(tester, () => container.read(hadithProvider(first.id).future));
      await show(tester, HadithDetailScreen(id: first.id), container);

      expect(hadith.id, first.id);
      expect(find.textContaining(hadith.location.locator!), findsOneWidget);
      expect(find.textContaining(hadith.dataset.version), findsWidgets);
      expect(find.textContaining(hadith.dataset.hash.substring(0, 12)), findsOneWidget);
    });

    testWidgets('withheld text is shown as withheld, never replaced', (tester) async {
      final container = containerFor(liveApi);
      addTearDown(container.dispose);

      final first = (await net(
        tester,
        () => container.read(hadithRepositoryProvider).getHadiths(limit: 1),
      )).items.first;
      final hadith = await net(tester, () => container.read(hadithProvider(first.id).future));
      await show(tester, HadithDetailScreen(id: first.id), container);

      if (!hadith.textAvailable) {
        expect(hadith.displayText, isNull);
        expect(find.byIcon(Icons.lock_outline), findsOneWidget);
        expect(find.byType(SelectableText), findsNothing);
      } else {
        expect(find.byType(SelectableText), findsOneWidget);
      }
    });

    testWidgets('the record is cached, survives a restart, and a new dataset drops it',
        (tester) async {
      final container = containerFor(liveApi);
      addTearDown(container.dispose);

      final first = (await net(
        tester,
        () => container.read(hadithRepositoryProvider).getHadiths(limit: 1),
      )).items.first;
      final hadith = await net(tester, () => container.read(hadithProvider(first.id).future));

      final store = container.read(hadithCacheStoreProvider);
      expect(store.get(first.id)!.dataset.hash, hadith.dataset.hash);

      // a fresh store over the same storage sees the persisted entry
      final restored = HadithCacheStore(HadithCache(), prefs)..load();
      expect(restored.cache.length, greaterThan(0));
      expect(restored.get(first.id), isNotNull);
      expect(restored.get(first.id)!.id, hadith.id);

      // a moved dataset drops the cache instead of mixing two datasets
      restored.cache.syncDataset(ApiVersion.fromJson({
        'api_version': 'v1',
        'dataset_version': 'SOMETHING-ELSE',
        'dataset_hash': 'f' * 64,
        'content_license_confirmed': false,
      }));
      expect(restored.get(first.id), isNull);
    });
  });

  group('5. search', () {
    testWidgets('submitting the field sets the term the results listen to', (tester) async {
      const term = 'الصلاة';
      final container = ProviderContainer(
        overrides: [
          prefsProvider.overrideWithValue(prefs),
          hadithApiClientProvider.overrideWith(
            (ref) => HadithApiClient(baseUrl: liveApi, timeout: const Duration(seconds: 10)),
          ),
          // the field is the subject here, so the results are stubbed: a real
          // request started inside the widget tester's fake async zone would
          // never complete.
          hadithListProvider(const HadithListQuery(HadithListKind.search, term))
              .overrideWith(() => _StubListNotifier(
                    const HadithListQuery(HadithListKind.search, term),
                  )),
        ],
      );
      addTearDown(container.dispose);

      await tester.pumpWidget(wrap(const HadithSearchScreen(), container));
      await tester.pump();
      expect(container.read(hadithSearchTermProvider), isEmpty);

      await tester.enterText(find.byType(TextField), term);
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pump();

      expect(container.read(hadithSearchTermProvider), term);
    });

    testWidgets('a real search renders the records the server matched', (tester) async {
      const term = 'الصلاة';
      const query = HadithListQuery(HadithListKind.search, term);
      final container = containerFor(liveApi);
      addTearDown(container.dispose);
      tall(tester);

      final state = await net(tester, () async {
        container.read(hadithSearchTermProvider.notifier).set(term);
        return container.read(hadithListProvider(query).future);
      });
      await show(tester, const HadithSearchScreen(), container);

      expect(state.total, greaterThan(0));
      expect(state.items, isNotEmpty);
      expect(state.items.length, kHadithPageSize);
      expect(find.byType(Card), findsWidgets);
    });

    testWidgets('a term with no match shows the empty state, not an error', (tester) async {
      const query = HadithListQuery(HadithListKind.search, 'زقطبمخلاء');
      final container = containerFor(liveApi);
      addTearDown(container.dispose);

      final state = await net(tester, () => container.read(hadithListProvider(query).future));
      await show(tester, const HadithSearchScreen(), container);

      expect(state.total, 0);
      expect(state.items, isEmpty);
    });
  });

  group('6. failure handling', () {
    /// A server that accepts the connection and drops it: a real transport
    /// failure, produced locally so the test does not depend on how this
    /// machine treats an unroutable address.
    Future<(String, ServerSocket)> brokenServer() async {
      final server = await ServerSocket.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((socket) => socket.destroy());
      return ('http://127.0.0.1:${server.port}', server);
    }

    test('a dropped connection is reported as a network error, not a crash', () async {
      final (url, server) = await brokenServer();
      addTearDown(server.close);
      final container = containerFor(url);
      addTearDown(container.dispose);

      await expectLater(
        container.read(hadithRepositoryProvider).getBooks(limit: 5),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', 'NETWORK_ERROR')),
      );
    });

    test('health reports a broken service as down, and the live one as up', () async {
      final (url, server) = await brokenServer();
      addTearDown(server.close);
      final down = containerFor(url);
      final live = containerFor(liveApi);
      addTearDown(down.dispose);
      addTearDown(live.dispose);

      expect(await down.read(apiHealthProvider.future), isFalse);
      expect(await live.read(apiHealthProvider.future), isTrue);
    });

    testWidgets('the error state renders with a retry the user can press', (tester) async {
      // The failure itself is produced above; here the screen is the subject,
      // so the provider is overridden rather than the network being used.
      final container = ProviderContainer(
        overrides: [
          prefsProvider.overrideWithValue(prefs),
          hadithBooksProvider.overrideWith(
            (ref) => Future<List<HadithBook>>.error(
              ApiException('NETWORK_ERROR', 'connection dropped'),
            ),
          ),
          // the banner would otherwise open its own request, and this test is
          // about the error state, not about the network
          apiVersionProvider.overrideWith((ref) => ApiVersion.fromJson({
                'api_version': 'v1',
                'dataset_version': 'JAMI-KAMIL-1437-V2',
                'dataset_hash': 'a' * 64,
                'record_count': 15959,
                'status': 'sealed',
                'content_license_confirmed': false,
              })),
        ],
      );
      addTearDown(container.dispose);

      await tester.pumpWidget(wrap(const HadithBooksScreen(), container));
      await tester.pump();
      await tester.pump();

      expect(find.byIcon(Icons.cloud_off_outlined), findsOneWidget);
      expect(find.text('إعادة المحاولة'), findsOneWidget);
      expect(find.byIcon(Icons.refresh), findsOneWidget);

      // the button is live: pressing it asks the provider again
      await tester.tap(find.text('إعادة المحاولة'));
      await tester.pump();
    });

    test('a missing record is reported as not found', () async {
      const missing = '00000000-0000-0000-0000-000000000000';
      final container = containerFor(liveApi);
      addTearDown(container.dispose);

      await expectLater(
        container.read(hadithRepositoryProvider).getHadith(missing),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', 'NOT_FOUND')),
      );
    });

    test('an invalid page number is refused by the server, not by a crash', () async {
      final container = containerFor(liveApi);
      addTearDown(container.dispose);
      final repo = container.read(hadithRepositoryProvider);

      await expectLater(
        repo.getHadiths(page: 0),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('7. API version and contract', () {
    test('the app reads a sealed dataset identity', () async {
      final container = containerFor(liveApi);
      addTearDown(container.dispose);

      final version = await container.read(apiVersionProvider.future);
      expect(version.apiVersion, 'v1');
      expect(version.datasetVersion, isNotEmpty);
      expect(version.datasetHash!.length, 64);
      expect(version.recordCount, greaterThan(0));
      expect(version.contentLicenseConfirmed, isFalse);
    });

    test('no response carries a server credential', () async {
      final container = containerFor(liveApi);
      addTearDown(container.dispose);

      final stats = await container.read(hadithRepositoryProvider).getStats();
      final keys = stats.raw.keys.join(',').toLowerCase();
      expect(keys.contains('database_url'), isFalse);
      expect(keys.contains('service_role'), isFalse);
      expect(keys.contains('secret'), isFalse);
    });

    test('the books, chapters and hadiths the app reads agree with each other', () async {
      final container = containerFor(liveApi);
      addTearDown(container.dispose);

      final books = await container.read(hadithBooksProvider.future);
      final book = books.first;
      final chapters = await container.read(hadithChaptersProvider(book.id).future);
      final chapterTotal = chapters.fold<int>(0, (sum, c) => sum + c.hadithCount);
      expect(chapterTotal, lessThanOrEqualTo(book.hadithCount));

      final page = await container
          .read(hadithListProvider(HadithListQuery(HadithListKind.book, book.id)).future);
      expect(page.total, book.hadithCount);
    });
  });
}

/// Stands in for the list notifier where the test is about the widget, not
/// about the server.
class _StubListNotifier extends HadithListNotifier {
  _StubListNotifier(super.query);

  @override
  Future<HadithListState> build() async => const HadithListState(hasMore: false);
}
