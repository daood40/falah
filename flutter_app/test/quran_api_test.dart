import 'dart:convert';

import 'package:falah/features/quran_api/data/api_client.dart';
import 'package:falah/features/quran_api/data/audio_api_data_source.dart';
import 'package:falah/features/quran_api/data/audio_repository.dart';
import 'package:falah/features/quran_api/data/quran_api_data_source.dart';
import 'package:falah/features/quran_api/data/quran_api_repository.dart';
import 'package:falah/features/quran_api/domain/models.dart';
import 'package:falah/features/quran_api/offline/quran_cache.dart';
import 'package:flutter_test/flutter_test.dart';

/// Records requests and replays canned API envelopes — no network in tests.
class FakeTransport implements HttpTransport {
  FakeTransport(this.responses);

  final Map<String, Object> responses;
  final List<Uri> requests = [];
  final List<Map<String, String>> headers = [];

  @override
  Future<HttpTransportResponse> send(
    String method,
    Uri url, {
    Map<String, String> headers = const {},
    String? body,
  }) async {
    requests.add(url);
    this.headers.add(headers);
    final key = url.path + (url.hasQuery ? '?${url.query}' : '');
    final match = responses.entries.firstWhere(
      (entry) => key.startsWith(entry.key),
      orElse: () => MapEntry(
        '',
        {
          'success': false,
          'error': {'code': 'NOT_FOUND', 'message': 'Resource not found'},
        },
      ),
    );
    final value = match.value;
    return HttpTransportResponse(
      value is Map && value['success'] == false ? 404 : 200,
      jsonEncode(value),
    );
  }
}

const basmala = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';

Map<String, dynamic> ayahJson({
  int surah = 1,
  int ayah = 1,
  String text = basmala,
  String? hash,
  bool verified = true,
}) => {
  'id': '00000000-0000-0000-0000-00000000000$ayah',
  'surah': {'number': surah, 'name_ar': 'الفاتحة', 'name_en': 'The Opener'},
  'ayah_number': ayah,
  'ayah_key': '$surah:$ayah',
  'global_ayah_number': ayah,
  'juz': 1,
  'hizb': 1,
  'rub': 1,
  'page': 1,
  'manzil': 1,
  'ruku': 1,
  'sajdah': false,
  'sajdah_type': null,
  'text': text,
  'text_uthmani': text,
  'text_simple': null,
  'edition': {
    'id': 'e1',
    'slug': 'quran-json-uthmani-hafs',
    'name': 'المصحف',
    'riwayah': 'hafs',
    'qiraah': 'asim',
  },
  'source': {'id': 'quran-json', 'name': 'quran-json', 'version': '3.1.2'},
  'verification': {'verified': verified, 'status': verified ? 'verified' : 'pending'},
  'dataset_version': '2026.09.16-1',
  'content_hash': hash ?? contentHashOf(text),
};

Map<String, dynamic> ok(Object data, [Map<String, dynamic> meta = const {}]) => {
  'success': true,
  'data': data,
  'meta': meta,
};

void main() {
  group('API client', () {
    test('unwraps the envelope and sends the access token', () async {
      final transport = FakeTransport({
        '/api/v1/ayahs/by-key/1:1': ok(ayahJson()),
      });
      final client = QuranApiClient(
        baseUrl: 'https://api.test',
        transport: transport,
        tokenProvider: () => 'token-123',
      );
      final ayah = await QuranApiDataSource(client).getAyah(1, 1);

      expect(ayah.text, basmala);
      expect(ayah.ayahKey, '1:1');
      expect(ayah.edition?.riwayah, 'hafs');
      expect(ayah.verified, isTrue);
      expect(transport.headers.single['authorization'], 'Bearer token-123');
    });

    test('turns an error envelope into a typed exception', () async {
      final client = QuranApiClient(
        baseUrl: 'https://api.test',
        transport: FakeTransport(const {}),
      );
      await expectLater(
        QuranApiDataSource(client).getAyah(1, 999),
        throwsA(
          isA<QuranApiException>().having((e) => e.isNotFound, 'isNotFound', true),
        ),
      );
    });

    test('exposes the licence gate to the UI', () async {
      final transport = FakeTransport({
        '/api/v1/surahs': {
          'success': false,
          'error': {
            'code': 'LICENSE_RESTRICTED',
            'message': 'Public data is disabled',
          },
        },
      });
      final client = QuranApiClient(baseUrl: 'https://api.test', transport: transport);
      await expectLater(
        QuranApiDataSource(client).listSurahs(),
        throwsA(
          isA<QuranApiException>()
              .having((e) => e.isLicenseRestricted, 'licenceGate', true),
        ),
      );
    });

    test('never rewrites the served text (SOURCE_LOCK)', () async {
      final transport = FakeTransport({'/api/v1/ayahs/by-key/1:1': ok(ayahJson())});
      final client = QuranApiClient(baseUrl: 'https://api.test', transport: transport);
      final ayah = await QuranApiDataSource(client).getAyah(1, 1);
      expect(ayah.text.codeUnits, basmala.codeUnits);
      expect(contentHashOf(ayah.text), ayah.contentHash);
    });
  });

  group('offline cache', () {
    test('serves cached ayahs and re-verifies their checksum', () async {
      final cache = QuranOfflineCache(storage: InMemoryCacheStorage());
      final ayahs = [QuranAyah.fromJson(ayahJson())];
      await cache.writeSurahAyahs(1, ayahs);

      final read = await cache.readSurahAyahs(1);
      expect(read, isNotNull);
      expect(read!.single.text, basmala);
    });

    test('drops a tampered cache entry instead of serving it', () async {
      final storage = InMemoryCacheStorage();
      final cache = QuranOfflineCache(storage: storage);
      await cache.writeSurahAyahs(1, [
        QuranAyah.fromJson(ayahJson(text: 'نص محرّف', hash: contentHashOf(basmala))),
      ]);
      expect(await cache.readSurahAyahs(1), isNull);
      expect(await storage.read('quran:surah:1'), isNull);
    });

    test('ignores entries from a superseded dataset version', () async {
      final storage = InMemoryCacheStorage();
      await QuranOfflineCache(storage: storage, datasetVersion: 'v1')
          .writeSurahAyahs(1, [QuranAyah.fromJson(ayahJson())]);
      final newer = QuranOfflineCache(storage: storage, datasetVersion: 'v2');
      expect(await newer.readSurahAyahs(1), isNull);
    });
  });

  group('repository', () {
    test('reads from cache without hitting the network', () async {
      final transport = FakeTransport({
        '/api/v1/surahs/1/ayahs': ok([ayahJson()], {'page': 1, 'limit': 300, 'total': 1, 'total_pages': 1}),
      });
      final client = QuranApiClient(baseUrl: 'https://api.test', transport: transport);
      final cache = QuranOfflineCache(storage: InMemoryCacheStorage());
      final repo = QuranApiRepository(
        remote: QuranApiDataSource(client),
        cache: cache,
      );

      final first = await repo.getSurah(1);
      final second = await repo.getSurah(1);

      expect(first.single.text, basmala);
      expect(second.single.text, basmala);
      expect(transport.requests, hasLength(1));
    });

    test('follows pagination until every ayah is collected', () async {
      var call = 0;
      final transport = _PagedTransport(() => call++);
      final repo = QuranApiRepository(
        remote: QuranApiDataSource(
          QuranApiClient(baseUrl: 'https://api.test', transport: transport),
        ),
      );
      final ayahs = await repo.getSurah(1);
      expect(ayahs, hasLength(2));
      expect(ayahs.map((a) => a.ayahNumber), [1, 2]);
    });
  });

  group('audio repository', () {
    test('keeps only verified files and hides undownloadable ones', () async {
      final transport = FakeTransport({
        '/api/v1/reciters/test/surahs/1': ok([
          {
            'id': 'a1',
            'recitation_id': 'r1',
            'sequence_number': 1,
            'audio_url': 'https://cdn.test/1.mp3',
            'stream_url': 'https://cdn.test/stream/1.mp3',
            'download_url': null,
            'downloadable': false,
            'status': 'streaming_only',
            'verified': true,
          },
          {
            'id': 'a2',
            'recitation_id': 'r1',
            'sequence_number': 2,
            'audio_url': 'https://cdn.test/2.mp3',
            'downloadable': false,
            'status': 'restricted',
            'verified': false,
          },
        ], {'total': 2}),
      });
      final repo = AudioRepository(
        AudioApiDataSource(
          QuranApiClient(baseUrl: 'https://api.test', transport: transport),
        ),
      );
      final files = await repo.getSurahAudio('test', 1);
      expect(files, hasLength(1));
      expect(files.single.playbackUrl, 'https://cdn.test/stream/1.mp3');
      expect(await repo.downloadableSurahAudio('test', 1), isEmpty);
    });
  });
}

/// Two pages of one ayah each, to exercise the pagination walk.
class _PagedTransport implements HttpTransport {
  _PagedTransport(this.next);
  final int Function() next;

  @override
  Future<HttpTransportResponse> send(
    String method,
    Uri url, {
    Map<String, String> headers = const {},
    String? body,
  }) async {
    final page = next() + 1;
    return HttpTransportResponse(
      200,
      jsonEncode(
        ok([ayahJson(ayah: page)], {
          'page': page,
          'limit': 1,
          'total': 2,
          'total_pages': 2,
        }),
      ),
    );
  }
}
