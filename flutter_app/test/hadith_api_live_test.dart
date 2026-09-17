// FALAH ↔ Hadith API integration test (§32).
//
// Runs the real path: Falah repository → Dart client → HTTP → API → database.
// No mocks. Skipped unless a live server is pointed at:
//
//   flutter test test/hadith_api_live_test.dart \
//     --dart-define=FALAH_LIVE_API=http://127.0.0.1:8787
import 'package:falah_hadith_api/falah_hadith_api.dart';
import 'package:flutter_test/flutter_test.dart';

const liveApi = String.fromEnvironment('FALAH_LIVE_API');

void main() {
  if (liveApi.isEmpty) {
    test('live API contract (skipped: FALAH_LIVE_API not set)', () {}, skip: true);
    return;
  }

  final repo = HadithRepository(HadithApiClient(baseUrl: liveApi));

  test('1. health — API, database and dataset are live', () async {
    expect(await repo.healthy(), isTrue);
  });

  test('2. version — dataset identity a client can cache against', () async {
    final version = await repo.getVersion();
    expect(version.apiVersion, 'v1');
    expect(version.datasetVersion, isNotEmpty);
    expect(version.datasetHash, isNotNull);
    expect(version.recordCount, greaterThan(0));
  });

  test('3. stats — real counts, no secrets', () async {
    final stats = await repo.getStats();
    expect(stats.hadiths, greaterThan(0));
    expect(stats.books, greaterThan(0));
    expect(stats.chapters, greaterThan(0));
    expect(stats.narrators, greaterThan(0));
    expect(stats.raw.keys, isNot(contains('database_url')));
  });

  test('4. getHadiths — paginated slim list', () async {
    final page = await repo.getHadiths(limit: 5);
    expect(page.items, isNotEmpty);
    expect(page.items.length, lessThanOrEqualTo(5));
    expect(page.currentPage, 1);
    expect(page.total, greaterThan(0));
    expect(page.items.first.contentHash.length, 64);
  });

  test('5. getHadith — the standard detail response', () async {
    final first = (await repo.getHadiths(limit: 1)).items.first;
    final hadith = await repo.getHadith(first.id);
    expect(hadith.id, first.id);
    expect(hadith.dataset.hash.length, 64);
    expect(hadith.sourceLocked, isTrue);
    expect(hadith.source, isNotNull);
    expect(hadith.location.locator, isNotNull);
    // withheld text stays null — the client never substitutes anything
    if (!hadith.textAvailable) expect(hadith.displayText, isNull);
  });

  test('6. include — heavy blocks only when asked for', () async {
    final first = (await repo.getHadiths(limit: 1)).items.first;
    final plain = await repo.getHadith(first.id);
    expect(plain.narrators, isEmpty);
    expect(plain.gradings, isEmpty);

    final full = await repo.getHadith(first.id, include: [
      'narrators', 'references', 'takhrij', 'gradings', 'verification',
    ]);
    expect(full.gradings, isNotEmpty);
    expect(full.takhrij, isNotNull);
    expect(full.verification.crossCheck, isNotNull);
  });

  test('7. search — Arabic, diacritic-insensitive, paginated', () async {
    final hits = await repo.searchHadiths('الصلاة', limit: 3);
    expect(hits.total, greaterThan(0));
    expect(hits.items.length, lessThanOrEqualTo(3));
    final short = await repo.searchHadiths('ا');
    expect(short.items, isEmpty); // guarded client-side, never sent
  });

  test('8. random — an existing record, never generated', () async {
    final hadith = await repo.getRandomHadith();
    final fetched = await repo.getHadith(hadith.id);
    expect(fetched.id, hadith.id);
  });

  test('9. daily — deterministic for a given day', () async {
    final a = await repo.getDailyHadith(date: DateTime.utc(2026, 1, 1));
    final b = await repo.getDailyHadith(date: DateTime.utc(2026, 1, 1));
    expect(a.id, b.id);
  });

  test('10. books and catalogue', () async {
    final books = await repo.getBooks(limit: 5);
    expect(books.items, isNotEmpty);
    final book = await repo.getBook(books.items.first.id);
    expect(book.id, books.items.first.id);
    final catalog = await repo.getCatalog();
    expect(catalog, isNotEmpty);
  });

  test('11. chapters of a book, and one chapter', () async {
    final book = (await repo.getBooks(limit: 1)).items.first;
    final chapters = await repo.getChapters(book.id);
    expect(chapters.items, isNotEmpty);
    final chapter = await repo.getChapter(chapters.items.first.id);
    expect(chapter.bookId, book.id);
    expect(chapter.title, isNotEmpty);
  });

  test('12. narrators, references, takhrij, gradings, verification', () async {
    final first = (await repo.getHadiths(limit: 1)).items.first;

    final narrators = await repo.getNarrators(first.id);
    expect(narrators, isA<List<Narrator>>());

    final references = await repo.getReferences(first.id);
    expect(references, isA<List<HadithReference>>());

    final takhrij = await repo.getTakhrij(first.id);
    expect(takhrij.hadithId, first.id);
    expect(takhrij.sources, isA<List<String>>());

    final gradings = await repo.getGradings(first.id);
    expect(gradings, isA<List<Grading>>());

    final verification = await repo.getVerification(first.id);
    expect(verification.sourceMatch, isNotNull);
    expect(verification.humanReview, isFalse);
    expect(verification.verified, isFalse); // no human sample yet
  });

  test('13. sources — where the text came from and its licence', () async {
    final sources = await repo.getSources();
    expect(sources, isNotEmpty);
    final source = await repo.getSource(sources.first.id);
    expect(source.licenseStatus, isNotEmpty);
  });

  test('14. filters combine', () async {
    final book = (await repo.getBooks(limit: 1)).items.first;
    final byBook = await repo.getHadiths(bookId: book.id, limit: 5);
    expect(byBook.items, isNotEmpty);
    for (final h in byBook.items) {
      expect(h.bookId, book.id);
    }
  });

  test('15. pagination is stable across pages', () async {
    final first = await repo.getHadiths(page: 1, limit: 5);
    final second = await repo.getHadiths(page: 2, limit: 5);
    expect(second.currentPage, 2);
    expect(second.total, first.total);
    final ids = {...first.items.map((h) => h.id), ...second.items.map((h) => h.id)};
    expect(ids.length, first.items.length + second.items.length);
  });

  test('16. a missing record surfaces as NOT_FOUND, not a crash', () async {
    await expectLater(
      repo.getHadith('00000000-0000-0000-0000-000000000000'),
      throwsA(isA<ApiException>().having((e) => e.isNotFound, 'isNotFound', isTrue)),
    );
  });
}
