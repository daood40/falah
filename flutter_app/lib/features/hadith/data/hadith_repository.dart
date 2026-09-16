/// Repository over the FALAH Hadith API (Clean Architecture data layer).
library;

import '../domain/models.dart';
import 'hadith_api_client.dart';

class HadithRepository {
  HadithRepository(this._api);

  final HadithApiClient _api;

  Paged<T> _paged<T>(ApiResponse res, T Function(Map<String, dynamic>) map) {
    final items = (res.data as List? ?? const [])
        .cast<Map<String, dynamic>>()
        .map(map)
        .toList(growable: false);
    return Paged<T>(
      items: items,
      page: res.meta['page'] as int? ?? 1,
      limit: res.meta['limit'] as int? ?? items.length,
      total: res.meta['total'] as int? ?? items.length,
    );
  }

  Future<Hadith> getHadith(String id) async {
    final res = await _api.get('/api/v1/hadiths/$id');
    return Hadith.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<Hadith>> getHadithByNumber(String number, {String? editionId}) async {
    final res = await _api.get('/api/v1/hadiths/by-number/$number', query: {
      if (editionId != null) 'edition_id': editionId,
    });
    return (res.data as List).cast<Map<String, dynamic>>().map(Hadith.fromJson).toList(growable: false);
  }

  Future<Paged<Hadith>> listHadiths({
    int page = 1,
    int limit = 20,
    String? bookId,
    String? chapterId,
    String? narratorId,
    int? volume,
  }) async {
    final res = await _api.get('/api/v1/hadiths', query: {
      'page': page,
      'limit': limit,
      if (bookId != null) 'book_id': bookId,
      if (chapterId != null) 'chapter_id': chapterId,
      if (narratorId != null) 'narrator_id': narratorId,
      if (volume != null) 'volume': volume,
    });
    return _paged(res, Hadith.fromJson);
  }

  Future<Paged<Hadith>> search(String query, {int page = 1, int limit = 20}) async {
    final res = await _api.get('/api/v1/search', query: {'q': query, 'page': page, 'limit': limit});
    return _paged(res, Hadith.fromJson);
  }

  Future<Paged<HadithBook>> listBooks({String? editionId, int page = 1, int limit = 50}) async {
    final res = await _api.get('/api/v1/books', query: {
      'page': page,
      'limit': limit,
      if (editionId != null) 'edition_id': editionId,
    });
    return _paged(res, HadithBook.fromJson);
  }

  Future<Paged<HadithChapter>> listChapters({String? bookId, int page = 1, int limit = 50}) async {
    final res = await _api.get('/api/v1/chapters', query: {
      'page': page,
      'limit': limit,
      if (bookId != null) 'book_id': bookId,
    });
    return _paged(res, HadithChapter.fromJson);
  }

  Future<Paged<Hadith>> bookHadiths(String bookId, {int page = 1, int limit = 20}) async {
    final res = await _api.get('/api/v1/books/$bookId/hadiths', query: {'page': page, 'limit': limit});
    return _paged(res, Hadith.fromJson);
  }

  Future<Paged<Hadith>> chapterHadiths(String chapterId, {int page = 1, int limit = 20}) async {
    final res = await _api.get('/api/v1/chapters/$chapterId/hadiths', query: {'page': page, 'limit': limit});
    return _paged(res, Hadith.fromJson);
  }

  Future<Paged<Narrator>> listNarrators({int page = 1, int limit = 50, String? name}) async {
    final res = await _api.get('/api/v1/narrators', query: {
      'page': page,
      'limit': limit,
      if (name != null) 'name': name,
    });
    return _paged(res, Narrator.fromJson);
  }

  Future<List<HadithEdition>> listEditions() async {
    final res = await _api.get('/api/v1/editions', query: {'limit': 100});
    return (res.data as List).cast<Map<String, dynamic>>().map(HadithEdition.fromJson).toList(growable: false);
  }

  Future<Map<String, dynamic>> stats() async {
    final res = await _api.get('/api/v1/stats');
    return res.data as Map<String, dynamic>;
  }

  Future<bool> healthy() async {
    try {
      final res = await _api.get('/api/v1/health');
      return (res.data as Map<String, dynamic>)['database'] == 'up';
    } on ApiException {
      return false;
    }
  }
}
