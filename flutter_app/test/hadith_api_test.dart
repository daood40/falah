// Dart client unit tests — parsing, error mapping, pagination, the licence gate.
// All payloads are synthetic TEST DATA; no scripture is used in tests.
import 'dart:convert';

import 'package:falah_hadith_api/falah_hadith_api.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// Arabic bodies must be sent as UTF-8 bytes: http.Response(String, …)
/// encodes as Latin-1 and would throw on any Arabic character.
http.Response _json(Object body, [int status = 200]) => http.Response.bytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

Map<String, dynamic> _detail({String? text, bool textAvailable = true, Object? extra}) => {
      'id': '11111111-1111-1111-1111-111111111111',
      'number': '1',
      'text': text,
      'text_available': textAvailable,
      'source': {'id': '33333333-3333-3333-3333-333333333333', 'name': 'TEST SOURCE'},
      'book': {'id': '22222222-2222-2222-2222-222222222222', 'name': 'قسم اختباري'},
      'chapter': {'id': '44444444-4444-4444-4444-444444444444', 'title': 'باب اختباري'},
      'location': {'volume': 1, 'page': 25, 'locator': 'ج1/ص25/#1'},
      'dataset': {'version': 'TEST-FIXTURE-V1', 'hash': 'a' * 64, 'dataset_hash': 'b' * 64},
      'verification': {'verified': false, 'status': 'pending'},
      'source_locked': true,
      if (extra != null) ...(extra as Map<String, dynamic>),
    };

Map<String, dynamic> _summary({String? text, bool textAvailable = true}) => {
      'id': '11111111-1111-1111-1111-111111111111',
      'number': '1',
      'text': text,
      'text_available': textAvailable,
      'book_id': '22222222-2222-2222-2222-222222222222',
      'chapter_id': '44444444-4444-4444-4444-444444444444',
      'source_id': '33333333-3333-3333-3333-333333333333',
      'volume': 1,
      'page': 25,
      'dataset_version': 'TEST-FIXTURE-V1',
      'content_hash': 'a' * 64,
      'verification_status': 'pending',
    };

HadithRepository _repo(MockClient client) =>
    HadithRepository(HadithApiClient(baseUrl: 'http://api.test', client: client));

void main() {
  test('parses the standard detail response and keeps absent fields null', () async {
    final repo = _repo(MockClient((req) async {
      expect(req.url.path, '/api/v1/hadiths/11111111-1111-1111-1111-111111111111');
      return _json({'success': true, 'data': _detail(text: 'TEST DATA — نصٌّ اختباريّ')});
    }));

    final hadith = await repo.getHadith('11111111-1111-1111-1111-111111111111');
    expect(hadith.number, '1');
    expect(hadith.text, contains('نصٌّ اختباريّ'));
    expect(hadith.book?.name, 'قسم اختباري');
    expect(hadith.chapter?.name, 'باب اختباري');
    expect(hadith.location.volume, 1);
    expect(hadith.location.locator, 'ج1/ص25/#1');
    expect(hadith.dataset.hash.length, 64);
    expect(hadith.sourceLocked, isTrue);
    expect(hadith.narrators, isEmpty); // nothing until include: asks for it
  });

  test('handles the withheld-text state without inventing a fallback', () async {
    final repo = _repo(MockClient(
      (_) async => _json({'success': true, 'data': _detail(text: null, textAvailable: false)}),
    ));
    final hadith = await repo.getHadith('11111111-1111-1111-1111-111111111111');
    expect(hadith.textAvailable, isFalse);
    expect(hadith.text, isNull);
    expect(hadith.displayText, isNull);
  });

  test('sends include= and parses every optional block', () async {
    final repo = _repo(MockClient((req) async {
      expect(req.url.queryParameters['include'], 'narrators,takhrij,gradings,verification');
      return _json({
        'success': true,
        'data': _detail(text: 'TEST DATA', extra: {
          'narrators': [
            {'id': 'n1', 'name': 'راوٍ اختباري', 'kunya': null, 'position': 1},
          ],
          'takhrij': {
            'hadith_id': '11111111-1111-1111-1111-111111111111',
            'takhrij_text': 'متفق عليه: TEST',
            'text_available': true,
            'sources': ['البخاري', 'مسلم'],
            'references': [
              {'source': 'البخاري', 'volume': 1, 'page': 25, 'reference_text': 'TEST'},
            ],
            'dataset_version': 'TEST-FIXTURE-V1',
          },
          'gradings': [
            {'grading_text': 'متفق عليه', 'source': 'TEST GRADER', 'reference': 'ج1/ص25/#1'},
          ],
          'verification': {
            'source_match': true,
            'cross_check': 'SUPPORTED',
            'cross_check_detail': {'similarity': 0.94, 'collection': 'صحيح البخاري'},
            'human_review': false,
            'verified': false,
            'status': 'pending',
          },
        }),
      });
    }));

    final hadith = await repo.getHadith(
      '11111111-1111-1111-1111-111111111111',
      include: ['narrators', 'takhrij', 'gradings', 'verification'],
    );
    expect(hadith.narrators.single.name, 'راوٍ اختباري');
    expect(hadith.takhrij!.sources, ['البخاري', 'مسلم']);
    expect(hadith.gradings.single.text, 'متفق عليه');
    expect(hadith.verification.sourceMatch, isTrue);
    expect(hadith.verification.crossCheck, 'SUPPORTED');
    expect(hadith.verification.crossCheckSimilarity, closeTo(0.94, 0.001));
    expect(hadith.verification.verified, isFalse);
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

  test('reads pagination meta, including current_page', () async {
    final repo = _repo(MockClient((req) async {
      expect(req.url.queryParameters['limit'], '2');
      return _json({
        'success': true,
        'data': [_summary(text: 'TEST A'), _summary(text: 'TEST B')],
        'meta': {'page': 1, 'current_page': 1, 'limit': 2, 'total': 5, 'total_pages': 3},
      });
    }));

    final page = await repo.getHadiths(limit: 2);
    expect(page.items.length, 2);
    expect(page.currentPage, 1);
    expect(page.total, 5);
    expect(page.totalPages, 3);
    expect(page.hasMore, isTrue);
    expect(page.items.first.contentHash.length, 64);
  });

  test('a short search query never reaches the network', () async {
    var called = false;
    final repo = _repo(MockClient((_) async {
      called = true;
      return _json({'success': true, 'data': []});
    }));
    final page = await repo.searchHadiths('ا');
    expect(called, isFalse);
    expect(page.items, isEmpty);
  });

  test('random and daily parse the detail shape', () async {
    final repo = _repo(MockClient((req) async {
      expect(['/api/v1/hadiths/random', '/api/v1/hadiths/daily'], contains(req.url.path));
      return _json({'success': true, 'data': _detail(text: 'TEST DATA')});
    }));
    expect((await repo.getRandomHadith()).number, '1');
    expect((await repo.getDailyHadith(date: DateTime.utc(2026, 1, 1))).number, '1');
  });

  test('surfaces a network failure as ApiException, not a crash', () async {
    final repo = _repo(MockClient((_) async => throw http.ClientException('offline')));
    await expectLater(
      repo.getHadith('11111111-1111-1111-1111-111111111111'),
      throwsA(isA<ApiException>()),
    );
  });

  test('parses version, datasets, books, chapters and sources', () {
    final version = ApiVersion.fromJson({
      'api_version': 'v1', 'dataset_version': 'TEST-FIXTURE-V1',
      'dataset_hash': 'c' * 64, 'record_count': 7, 'status': 'sealed',
      'content_license_confirmed': false,
    });
    expect(version.recordCount, 7);
    expect(version.contentLicenseConfirmed, isFalse);

    final dataset = DatasetVersion.fromJson(
        {'version': 'TEST-FIXTURE-V1', 'status': 'sealed', 'record_count': 7, 'dataset_hash': 'c' * 64});
    expect(dataset.status, 'sealed');

    final book = HadithBook.fromJson(
        {'id': 'b', 'edition_id': 'e', 'name': 'قسم', 'hadith_count': 3, 'chapter_count': 2});
    expect(book.chapterCount, 2);

    final chapter = HadithChapter.fromJson(
        {'id': 'c', 'book_id': 'b', 'title': 'باب', 'hadith_count': 1, 'number': '1', 'page_start': 5});
    expect(chapter.pageStart, 5);

    final source = HadithSource.fromJson(
        {'id': 's', 'name': 'TEST SOURCE', 'license_status': 'unconfirmed', 'hadith_count': 9});
    expect(source.licenseStatus, 'unconfirmed');
  });
}
