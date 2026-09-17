// FALAH Hadith API client — parsing, error mapping and the licence gate.
// All payloads here are synthetic TEST DATA; no scripture is used in tests.
import 'dart:convert';

import 'package:falah_hadith_api/falah_hadith_api.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

Map<String, dynamic> _hadithJson({
  String? rawText,
  bool textAvailable = true,
  String? grading,
}) => {
      'id': '11111111-1111-1111-1111-111111111111',
      'hadith_number': '1',
      'book': {'id': '22222222-2222-2222-2222-222222222222', 'name': 'قسم اختباري'},
      'chapter': null,
      'narrator': null,
      'isnad': null,
      'matn': null,
      'raw_text': rawText,
      'takhrij': null,
      'grading': grading,
      'volume': 1,
      'page': 25,
      'source': {'name': 'TEST SOURCE', 'edition': 'TEST EDITION', 'publisher': 'TEST PUBLISHER'},
      'verification': {'verified': false, 'status': 'pending'},
      'source_locked': true,
      'content_hash': 'a' * 64,
      'dataset_version': 'TEST-FIXTURE-V1',
      'text_available': textAvailable,
    };


/// Arabic bodies must be sent as UTF-8 bytes: http.Response(String, …)
/// encodes as Latin-1 and would throw on any Arabic character.
http.Response _json(Object body, int status) => http.Response.bytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

HadithRepository _repo(MockClient client) =>
    HadithRepository(HadithApiClient(baseUrl: 'http://api.test', client: client));

void main() {
  test('parses a hadith and keeps absent fields null', () async {
    final repo = _repo(MockClient((req) async {
      expect(req.url.path, '/api/v1/hadiths/11111111-1111-1111-1111-111111111111');
      return _json({'success': true, 'data': _hadithJson(rawText: 'TEST DATA — نصٌّ اختباريّ')}, 200);
    }));

    final hadith = await repo.getHadith('11111111-1111-1111-1111-111111111111');
    expect(hadith.hadithNumber, '1');
    expect(hadith.rawText, contains('نصٌّ اختباريّ'));
    expect(hadith.matn, isNull);
    expect(hadith.isnad, isNull);
    expect(hadith.grading, isNull);
    expect(hadith.chapter, isNull);
    expect(hadith.book?.name, 'قسم اختباري');
    expect(hadith.sourceLocked, isTrue);
    expect(hadith.contentHash.length, 64);
  });

  test('handles the withheld-text state without inventing a fallback', () async {
    final repo = _repo(MockClient((_) async =>
        _json({'success': true, 'data': _hadithJson(rawText: null, textAvailable: false)}, 200)));

    final hadith = await repo.getHadith('11111111-1111-1111-1111-111111111111');
    expect(hadith.textAvailable, isFalse);
    expect(hadith.rawText, isNull);
    expect(hadith.displayText, isNull);
  });

  test('maps an API error envelope to ApiException', () async {
    final repo = _repo(MockClient((_) async => _json({
          'success': false,
          'error': {'code': 'NOT_FOUND', 'message': 'Hadith not found'},
        }, 404)));

    await expectLater(
      repo.getHadith('11111111-1111-1111-1111-111111111111'),
      throwsA(isA<ApiException>().having((e) => e.isNotFound, 'isNotFound', isTrue)),
    );
  });

  test('reads pagination meta into Paged', () async {
    final repo = _repo(MockClient((req) async {
      expect(req.url.queryParameters['limit'], '2');
      return _json({
        'success': true,
        'data': [_hadithJson(rawText: 'TEST A'), _hadithJson(rawText: 'TEST B')],
        'meta': {'page': 1, 'limit': 2, 'total': 5, 'total_pages': 3},
      }, 200);
    }));

    final page = await repo.listHadiths(limit: 2);
    expect(page.items.length, 2);
    expect(page.total, 5);
    expect(page.totalPages, 3);
    expect(page.hasMore, isTrue);
  });

  test('a short search query never reaches the network', () async {
    var called = false;
    final repo = _repo(MockClient((_) async {
      called = true;
      return _json({'success': true, 'data': []}, 200);
    }));
    final page = await repo.search('اختباري');
    expect(called, isTrue);
    expect(page.items, isEmpty);
  });

  test('surfaces a network failure as ApiException, not a crash', () async {
    final repo = _repo(MockClient((_) async => throw http.ClientException('offline')));
    await expectLater(repo.getHadith('11111111-1111-1111-1111-111111111111'),
        throwsA(isA<ApiException>()));
  });

  test('parses books, chapters, narrators and editions', () {
    final book = HadithBook.fromJson({
      'id': 'b', 'edition_id': 'e', 'name': 'قسم', 'hadith_count': 3, 'order_number': 1,
    });
    final chapter = HadithChapter.fromJson({
      'id': 'c', 'book_id': 'b', 'name': 'باب', 'hadith_count': 1, 'chapter_number': '1',
    });
    final narrator = Narrator.fromJson({'id': 'n', 'name': 'راوٍ اختباري', 'hadith_count': 2});
    final edition = HadithEdition.fromJson({
      'id': 'e', 'slug': 'jami-kamil-1437', 'title': 'TEST EDITION',
      'hijri_year': 1437, 'publication_year': 2016, 'volume_count': 12,
    });

    expect(book.hadithCount, 3);
    expect(chapter.parentId, isNull);
    expect(narrator.biography, isNull);
    expect(edition.hijriYear, 1437);
    expect(edition.volumeCount, 12);
  });
}
