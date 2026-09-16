// End-to-end check of the Dart client against a RUNNING FALAH API.
//
//   flutter test test/hadith_api_live_test.dart \
//     --dart-define=FALAH_LIVE_API=http://127.0.0.1:8787
//
// Without that define the suite skips, so CI without a server stays green.
// It proves the Dart models parse what the server really sends — a contract
// check, not a mock.
import 'package:falah/features/hadith/data/hadith_api_client.dart';
import 'package:falah/features/hadith/data/hadith_repository.dart';
import 'package:flutter_test/flutter_test.dart';

const liveApi = String.fromEnvironment('FALAH_LIVE_API');

void main() {
  if (liveApi.isEmpty) {
    test('live API contract (skipped: FALAH_LIVE_API not set)', () {}, skip: true);
    return;
  }

  final repo = HadithRepository(HadithApiClient(baseUrl: liveApi));

  test('health reports a live database', () async {
    expect(await repo.healthy(), isTrue);
  });

  test('stats parse into real numbers', () async {
    final stats = await repo.stats();
    expect(stats['hadiths'], isA<int>());
    expect(stats['content_license_confirmed'], isA<bool>());
  });

  test('books, chapters and narrators parse', () async {
    final books = await repo.listBooks();
    expect(books.items, isNotEmpty);
    final chapters = await repo.listChapters(bookId: books.items.first.id);
    expect(chapters.items, isNotEmpty);
    expect((await repo.listNarrators()).items, isNotEmpty);
  });

  test('a hadith parses with its source metadata', () async {
    final page = await repo.listHadiths(limit: 1);
    expect(page.items, isNotEmpty);
    final hadith = await repo.getHadith(page.items.first.id);
    expect(hadith.contentHash.length, 64);
    expect(hadith.sourceLocked, isTrue);
    expect(hadith.source.edition, isNotNull);
    expect(hadith.verification.status, isNotEmpty);
  });

  test('the withheld-text contract holds end to end', () async {
    final page = await repo.listHadiths(limit: 1);
    final hadith = page.items.first;
    if (!hadith.textAvailable) {
      expect(hadith.rawText, isNull);
      expect(hadith.displayText, isNull);
    } else {
      expect(hadith.rawText, isNotNull);
    }
  });

  test('search and pagination parse', () async {
    final results = await repo.search('اختباري', limit: 2);
    expect(results.limit, 2);
    expect(results.total, greaterThanOrEqualTo(0));
  });

  test('a missing hadith surfaces as NOT_FOUND', () async {
    await expectLater(
      repo.getHadith('00000000-0000-0000-0000-000000000000'),
      throwsA(isA<ApiException>().having((e) => e.isNotFound, 'isNotFound', isTrue)),
    );
  });

  test('editions expose the real edition metadata', () async {
    final editions = await repo.listEditions();
    expect(editions, isNotEmpty);
    final jami = editions.where((e) => e.slug == 'jami-kamil-1437');
    if (jami.isNotEmpty) {
      expect(jami.first.hijriYear, 1437);
      expect(jami.first.volumeCount, 12);
    }
  });
}
