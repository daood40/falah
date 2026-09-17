/// The official Falah client for the Hadith API.
///
/// Falah talks to this and to nothing else: no SQL, no Supabase tables, no
/// second copy of the corpus. Every method maps to one documented endpoint.
library;

import 'client.dart';
import 'models.dart';

class HadithRepository {
  HadithRepository(this._api);

  final HadithApiClient _api;

  // ---------------- hadiths ----------------

  /// `GET /api/v1/hadiths/{id}` — the standard detail response.
  ///
  /// [include] asks for the heavy blocks: `narrators`, `references`,
  /// `takhrij`, `gradings`, `verification`. Nothing heavy is fetched otherwise.
  Future<Hadith> getHadith(String id, {List<String> include = const []}) async {
    final res = await _api.get('/api/v1/hadiths/$id', query: {
      if (include.isNotEmpty) 'include': include.join(','),
    });
    return Hadith.fromJson(res.data as Map<String, dynamic>);
  }

  /// `GET /api/v1/hadiths` — a page of the slim shape.
  Future<Paged<HadithSummary>> getHadiths({
    int page = 1,
    int limit = 20,
    String? bookId,
    String? chapterId,
    String? sourceId,
    String? narratorId,
    String? grading,
    int? volume,
    int? pageNumber,
    String? verificationStatus,
  }) async {
    final res = await _api.get('/api/v1/hadiths', query: {
      'page': page,
      'limit': limit,
      if (bookId != null) 'book_id': bookId,
      if (chapterId != null) 'chapter_id': chapterId,
      if (sourceId != null) 'source_id': sourceId,
      if (narratorId != null) 'narrator_id': narratorId,
      if (grading != null) 'grading': grading,
      if (volume != null) 'volume': volume,
      if (pageNumber != null) 'page_number': pageNumber,
      if (verificationStatus != null) 'verification_status': verificationStatus,
    });
    return Paged.fromResponse(res.data, res.meta, HadithSummary.fromJson);
  }

  /// `GET /api/v1/search` — Arabic search, insensitive to diacritics and hamza.
  Future<Paged<HadithSummary>> searchHadiths(
    String query, {
    int page = 1,
    int limit = 20,
    String? bookId,
    String? chapterId,
    String? sourceId,
    String? grading,
  }) async {
    if (query.trim().length < 2) {
      return const Paged<HadithSummary>(items: [], page: 1, limit: 20, total: 0);
    }
    final res = await _api.get('/api/v1/search', query: {
      'q': query.trim(),
      'page': page,
      'limit': limit,
      if (bookId != null) 'book_id': bookId,
      if (chapterId != null) 'chapter_id': chapterId,
      if (sourceId != null) 'source_id': sourceId,
      if (grading != null) 'grading': grading,
    });
    return Paged.fromResponse(res.data, res.meta, HadithSummary.fromJson);
  }

  /// `GET /api/v1/hadiths/random` — an existing record, never a generated one.
  Future<Hadith> getRandomHadith({String? bookId, String? grading, List<String> include = const []}) async {
    final res = await _api.get('/api/v1/hadiths/random', query: {
      if (bookId != null) 'book_id': bookId,
      if (grading != null) 'grading': grading,
      if (include.isNotEmpty) 'include': include.join(','),
    });
    return Hadith.fromJson(res.data as Map<String, dynamic>);
  }

  /// `GET /api/v1/hadiths/daily` — deterministic: same day + same dataset,
  /// same record. Nothing is generated.
  Future<Hadith> getDailyHadith({DateTime? date, List<String> include = const []}) async {
    final res = await _api.get('/api/v1/hadiths/daily', query: {
      if (date != null) 'date': date.toIso8601String().substring(0, 10),
      if (include.isNotEmpty) 'include': include.join(','),
    });
    return Hadith.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<HadithSummary>> getHadithByNumber(String number, {String? editionId}) async {
    final res = await _api.get('/api/v1/hadiths/by-number/$number', query: {
      if (editionId != null) 'edition_id': editionId,
    });
    return (res.data as List)
        .cast<Map<String, dynamic>>()
        .map(HadithSummary.fromJson)
        .toList(growable: false);
  }

  // ---------------- per-hadith detail ----------------

  Future<List<Narrator>> getNarrators(String hadithId) async {
    final res = await _api.get('/api/v1/hadiths/$hadithId/narrators');
    return (res.data as List).cast<Map<String, dynamic>>().map(Narrator.fromJson).toList(growable: false);
  }

  Future<List<HadithReference>> getReferences(String hadithId) async {
    final res = await _api.get('/api/v1/hadiths/$hadithId/references');
    return (res.data as List)
        .cast<Map<String, dynamic>>()
        .map(HadithReference.fromJson)
        .toList(growable: false);
  }

  Future<Takhrij> getTakhrij(String hadithId) async {
    final res = await _api.get('/api/v1/hadiths/$hadithId/takhrij');
    return Takhrij.fromJson(res.data as Map<String, dynamic>);
  }

  /// Several gradings are normal; none is mandatory.
  Future<List<Grading>> getGradings(String hadithId) async {
    final res = await _api.get('/api/v1/hadiths/$hadithId/gradings');
    return (res.data as List).cast<Map<String, dynamic>>().map(Grading.fromJson).toList(growable: false);
  }

  /// Source match, cross-check and human review, kept apart.
  Future<Verification> getVerification(String hadithId) async {
    final res = await _api.get('/api/v1/hadiths/$hadithId/verification');
    return Verification.fromJson(res.data as Map<String, dynamic>);
  }

  // ---------------- catalogue ----------------

  Future<Paged<HadithBook>> getBooks({String? editionId, int page = 1, int limit = 100}) async {
    final res = await _api.get('/api/v1/books', query: {
      'page': page,
      'limit': limit,
      if (editionId != null) 'edition_id': editionId,
    });
    return Paged.fromResponse(res.data, res.meta, HadithBook.fromJson);
  }

  Future<HadithBook> getBook(String id) async {
    final res = await _api.get('/api/v1/books/$id');
    return HadithBook.fromJson(res.data as Map<String, dynamic>);
  }

  Future<Paged<HadithChapter>> getChapters(String bookId, {int page = 1, int limit = 100}) async {
    final res = await _api.get('/api/v1/books/$bookId/chapters', query: {'page': page, 'limit': limit});
    return Paged.fromResponse(res.data, res.meta, HadithChapter.fromJson);
  }

  Future<HadithChapter> getChapter(String id) async {
    final res = await _api.get('/api/v1/chapters/$id');
    return HadithChapter.fromJson(res.data as Map<String, dynamic>);
  }

  Future<Paged<HadithSummary>> getBookHadiths(String bookId, {int page = 1, int limit = 20}) async {
    final res = await _api.get('/api/v1/books/$bookId/hadiths', query: {'page': page, 'limit': limit});
    return Paged.fromResponse(res.data, res.meta, HadithSummary.fromJson);
  }

  Future<Paged<HadithSummary>> getChapterHadiths(String chapterId, {int page = 1, int limit = 20}) async {
    final res = await _api.get('/api/v1/chapters/$chapterId/hadiths', query: {'page': page, 'limit': limit});
    return Paged.fromResponse(res.data, res.meta, HadithSummary.fromJson);
  }

  /// The whole book → chapter tree, for building navigation without any text.
  Future<List<HadithBook>> getCatalog({bool withChapters = false}) async {
    final res = await _api.get('/api/v1/catalog', query: {if (withChapters) 'chapters': 'true'});
    return (res.data as List).cast<Map<String, dynamic>>().map(HadithBook.fromJson).toList(growable: false);
  }

  // ---------------- sources, narrators, gradings ----------------

  Future<List<HadithSource>> getSources() async {
    final res = await _api.get('/api/v1/sources', query: {'limit': 100});
    return (res.data as List).cast<Map<String, dynamic>>().map(HadithSource.fromJson).toList(growable: false);
  }

  Future<HadithSource> getSource(String id) async {
    final res = await _api.get('/api/v1/sources/$id');
    return HadithSource.fromJson(res.data as Map<String, dynamic>);
  }

  Future<Paged<Narrator>> getAllNarrators({int page = 1, int limit = 50, String? name}) async {
    final res = await _api.get('/api/v1/narrators', query: {
      'page': page,
      'limit': limit,
      if (name != null) 'name': name,
    });
    return Paged.fromResponse(res.data, res.meta, Narrator.fromJson);
  }

  /// The grading labels the edition uses, with counts.
  Future<List<Grading>> getGradingLabels() async {
    final res = await _api.get('/api/v1/gradings');
    return (res.data as List).cast<Map<String, dynamic>>().map(Grading.fromJson).toList(growable: false);
  }

  // ---------------- dataset and system ----------------

  /// Which dataset this client is holding — use `datasetHash` as a cache key.
  Future<ApiVersion> getVersion() async {
    final res = await _api.get('/api/v1/version');
    return ApiVersion.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<DatasetVersion>> getDatasets() async {
    final res = await _api.get('/api/v1/datasets');
    return (res.data as List)
        .cast<Map<String, dynamic>>()
        .map(DatasetVersion.fromJson)
        .toList(growable: false);
  }

  Future<HadithStats> getStats() async {
    final res = await _api.get('/api/v1/stats');
    return HadithStats.fromJson(res.data as Map<String, dynamic>);
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
