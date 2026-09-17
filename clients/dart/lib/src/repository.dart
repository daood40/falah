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

  // ---------------- editions, collections, volumes ----------------

  /// `GET /api/v1/editions` — the printings this service holds. A different
  /// printing is a different edition and a different dataset; they are never
  /// merged.
  Future<List<HadithEdition>> getEditions() async {
    final res = await _api.get('/api/v1/editions', query: {'limit': 100});
    return (res.data as List)
        .cast<Map<String, dynamic>>()
        .map(HadithEdition.fromJson)
        .toList(growable: false);
  }

  Future<HadithEdition> getEdition(String id) async {
    final res = await _api.get('/api/v1/editions/$id');
    return HadithEdition.fromJson(res.data as Map<String, dynamic>);
  }

  /// `GET /api/v1/collections` — the collections cited in the takhrij.
  Future<List<Collection>> getCollections() async {
    final res = await _api.get('/api/v1/collections');
    return (res.data as List)
        .cast<Map<String, dynamic>>()
        .map(Collection.fromJson)
        .toList(growable: false);
  }

  /// `GET /api/v1/collections/{name}/hadiths`
  Future<Paged<HadithSummary>> getCollectionHadiths(
    String name, {
    int page = 1,
    int limit = 20,
  }) async {
    final res = await _api.get(
      '/api/v1/collections/${Uri.encodeComponent(name)}/hadiths',
      query: {'page': page, 'limit': limit},
    );
    return Paged.fromResponse(res.data, res.meta, HadithSummary.fromJson);
  }

  /// `GET /api/v1/volumes` — the printed volumes with their page ranges.
  Future<List<Volume>> getVolumes() async {
    final res = await _api.get('/api/v1/volumes');
    return (res.data as List).cast<Map<String, dynamic>>().map(Volume.fromJson).toList(growable: false);
  }

  /// `GET /api/v1/volumes/{volume}/hadiths`
  Future<Paged<HadithSummary>> getVolumeHadiths(
    int volume, {
    int page = 1,
    int limit = 20,
    int? pageNumber,
  }) async {
    final res = await _api.get('/api/v1/volumes/$volume/hadiths', query: {
      'page': page,
      'limit': limit,
      if (pageNumber != null) 'page_number': pageNumber,
    });
    return Paged.fromResponse(res.data, res.meta, HadithSummary.fromJson);
  }

  // ---------------- cross-checks (machine, not human) ----------------

  /// `GET /api/v1/cross-checks/summary` — how the dataset compares with an
  /// independent corpus. Never treat this as human verification.
  /// `GET /api/v1/hadiths/{id}/cross-checks` — what an independent corpus says
  /// about this record. Machine evidence only; it never sets `verified`.
  Future<List<CrossCheck>> getCrossChecks(String hadithId) async {
    final res = await _api.get('/api/v1/hadiths/$hadithId/cross-checks');
    return (res.data as List)
        .cast<Map<String, dynamic>>()
        .map(CrossCheck.fromJson)
        .toList(growable: false);
  }

  /// `GET /api/v1/narrators/{id}/hadiths`
  Future<Paged<HadithSummary>> getNarratorHadiths(
    String narratorId, {
    int page = 1,
    int limit = 20,
  }) async {
    final res = await _api.get('/api/v1/narrators/$narratorId/hadiths', query: {
      'page': page,
      'limit': limit,
    });
    return Paged.fromResponse(res.data, res.meta, HadithSummary.fromJson);
  }

  Future<List<CrossCheckSummary>> getCrossCheckSummary() async {
    final res = await _api.get('/api/v1/cross-checks/summary');
    return (res.data as List)
        .cast<Map<String, dynamic>>()
        .map(CrossCheckSummary.fromJson)
        .toList(growable: false);
  }

  /// `GET /api/v1/cross-checks/review-queue` — the records a human still has
  /// to look at, worst match first.
  Future<Paged<ReviewQueueItem>> getCrossCheckReviewQueue({
    int page = 1,
    int limit = 20,
    String? verdict,
  }) async {
    final res = await _api.get('/api/v1/cross-checks/review-queue', query: {
      'page': page,
      'limit': limit,
      if (verdict != null) 'verdict': verdict,
    });
    return Paged.fromResponse(res.data, res.meta, ReviewQueueItem.fromJson);
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
