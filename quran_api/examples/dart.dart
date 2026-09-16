// FALAH Quran API — plain Dart client (no Flutter needed).
// Usage: FALAH_API_BASE_URL=https://api.example.com dart run dart.dart
import 'dart:convert';
import 'dart:io';

class QuranApiException implements Exception {
  QuranApiException(this.code, this.message);
  final String code;
  final String message;
  @override
  String toString() => 'QuranApiException($code): $message';
}

class QuranApi {
  QuranApi(this.baseUrl, {this.token});

  final String baseUrl;
  final String? token;
  final HttpClient _client = HttpClient();

  Future<Map<String, dynamic>> _get(String path) async {
    final request = await _client.getUrl(Uri.parse('$baseUrl/api/v1$path'));
    request.headers.set('accept', 'application/json');
    if (token != null) request.headers.set('authorization', 'Bearer $token');
    final response = await request.close();
    final body = jsonDecode(await response.transform(utf8.decoder).join()) as Map<String, dynamic>;
    if (body['success'] != true) {
      final error = (body['error'] as Map).cast<String, dynamic>();
      throw QuranApiException(error['code'] as String, error['message'] as String);
    }
    return body;
  }

  Future<List<dynamic>> listSurahs() async => (await _get('/surahs?limit=114'))['data'] as List;

  Future<Map<String, dynamic>> getAyah(int surah, int ayah, {String? translation}) async {
    final query = translation == null ? '' : '?translation=$translation';
    return (await _get('/ayahs/by-key/$surah:$ayah$query'))['data'] as Map<String, dynamic>;
  }

  Future<List<dynamic>> search(String query, {int limit = 20}) async =>
      (await _get('/search?q=${Uri.encodeQueryComponent(query)}&limit=$limit'))['data'] as List;

  void close() => _client.close();
}

Future<void> main() async {
  final base = Platform.environment['FALAH_API_BASE_URL'];
  if (base == null || base.isEmpty) {
    stderr.writeln('set FALAH_API_BASE_URL');
    exit(2);
  }
  final api = QuranApi(base);
  try {
    final surahs = await api.listSurahs();
    print('surahs: ${surahs.length}');

    final ayah = await api.getAyah(2, 255, translation: 'en-saheeh');
    print('${ayah['ayah_key']}: ${ayah['text']}');
    print('hash: ${ayah['content_hash']}  source: ${(ayah['source'] as Map)['id']}');

    final hits = await api.search('الحمد لله', limit: 3);
    print('hits: ${hits.length}');
  } finally {
    api.close();
  }
}
