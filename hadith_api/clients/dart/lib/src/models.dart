/// Typed models for the FALAH Hadith API.
///
/// SOURCE_LOCK: every field is exactly what the API returned. A field the
/// source does not carry is null — the client never substitutes anything, and
/// text fields stay null while the server withholds them.
library;

T? _as<T>(Object? v) => v is T ? v : null;

/// A `{id, name}` pointer to another resource.
class Ref {
  const Ref({required this.id, required this.name});

  final String id;
  final String name;

  static Ref? fromJson(Object? json, {String nameKey = 'name'}) {
    if (json is! Map<String, dynamic>) return null;
    final id = json['id'];
    if (id is! String) return null;
    return Ref(id: id, name: _as<String>(json[nameKey]) ?? '');
  }
}

/// Where a record sits in the printed edition.
class HadithLocation {
  const HadithLocation({this.volume, this.page, this.locator});

  final int? volume;
  final int? page;

  /// Position in the print (`ج1/ص107/#1`). Never a hadith number.
  final String? locator;

  factory HadithLocation.fromJson(Map<String, dynamic>? json) => HadithLocation(
        volume: _as<int>(json?['volume']),
        page: _as<int>(json?['page']),
        locator: _as<String>(json?['locator']),
      );
}

/// Which dataset a record came from, and its fingerprints.
class DatasetRef {
  const DatasetRef({required this.version, required this.hash, this.datasetHash});

  final String version;

  /// SHA-256 of this record's text.
  final String hash;

  /// SHA-256 of the whole dataset — use it as a cache key.
  final String? datasetHash;

  factory DatasetRef.fromJson(Map<String, dynamic>? json) => DatasetRef(
        version: _as<String>(json?['version']) ?? '',
        hash: _as<String>(json?['hash']) ?? '',
        datasetHash: _as<String>(json?['dataset_hash']),
      );
}

class Verification {
  const Verification({
    required this.verified,
    required this.status,
    this.sourceMatch,
    this.crossCheck,
    this.crossCheckSimilarity,
    this.crossCheckCollection,
    this.humanReview,
  });

  /// Only a recorded human check can make this true.
  final bool verified;
  final String status;

  /// The stored text still matches the file it was imported from.
  final bool? sourceMatch;

  /// SUPPORTED · PARTIAL · NOT_FOUND · UNKNOWN — from an independent corpus.
  final String? crossCheck;
  final double? crossCheckSimilarity;
  final String? crossCheckCollection;

  /// A human compared this record against the printed edition.
  final bool? humanReview;

  factory Verification.fromJson(Map<String, dynamic>? json) {
    final detail = _as<Map<String, dynamic>>(json?['cross_check_detail']);
    return Verification(
      verified: _as<bool>(json?['verified']) ?? false,
      status: _as<String>(json?['status']) ?? 'pending',
      sourceMatch: _as<bool>(json?['source_match']),
      crossCheck: _as<String>(json?['cross_check']),
      crossCheckSimilarity: (detail?['similarity'] as num?)?.toDouble(),
      crossCheckCollection: _as<String>(detail?['collection']),
      humanReview: _as<bool>(json?['human_review']),
    );
  }
}

class Narrator {
  const Narrator({
    required this.id,
    required this.name,
    this.kunya,
    this.laqab,
    this.position,
    this.role,
    this.sourceReference,
    this.hadithCount,
  });

  final String id;
  final String name;
  final String? kunya;
  final String? laqab;
  final int? position;
  final String? role;

  /// How the name was obtained — it is copied, never inferred.
  final String? sourceReference;
  final int? hadithCount;

  factory Narrator.fromJson(Map<String, dynamic> json) => Narrator(
        id: json['id'] as String,
        name: json['name'] as String,
        kunya: _as<String>(json['kunya']),
        laqab: _as<String>(json['laqab']),
        position: _as<int>(json['position']),
        role: _as<String>(json['role']),
        sourceReference: _as<String>(json['source_reference']),
        hadithCount: _as<int>(json['hadith_count']),
      );
}

class HadithReference {
  const HadithReference({
    this.source,
    this.book,
    this.edition,
    this.volume,
    this.page,
    this.locator,
    this.referenceNumber,
    this.referenceText,
  });

  final String? source;
  final String? book;
  final String? edition;
  final int? volume;
  final int? page;
  final String? locator;
  final String? referenceNumber;

  /// Null while the server withholds text.
  final String? referenceText;

  factory HadithReference.fromJson(Map<String, dynamic> json) => HadithReference(
        source: _as<String>(json['source']),
        book: _as<String>(json['book']),
        edition: _as<String>(json['edition']),
        volume: _as<int>(json['volume']),
        page: _as<int>(json['page']),
        locator: _as<String>(json['locator']),
        referenceNumber: _as<String>(json['reference_number']),
        referenceText: _as<String>(json['reference_text']),
      );
}

class Takhrij {
  const Takhrij({
    required this.hadithId,
    required this.sources,
    required this.references,
    required this.datasetVersion,
    required this.textAvailable,
    this.text,
  });

  final String hadithId;

  /// The collections the author's takhrij names, verbatim.
  final List<String> sources;
  final List<HadithReference> references;
  final String datasetVersion;
  final bool textAvailable;

  /// The takhrij line itself; null while text is withheld.
  final String? text;

  factory Takhrij.fromJson(Map<String, dynamic> json) => Takhrij(
        hadithId: json['hadith_id'] as String,
        text: _as<String>(json['takhrij_text']),
        textAvailable: _as<bool>(json['text_available']) ?? false,
        sources: (json['sources'] as List? ?? const []).cast<String>(),
        references: (json['references'] as List? ?? const [])
            .cast<Map<String, dynamic>>()
            .map(HadithReference.fromJson)
            .toList(growable: false),
        datasetVersion: _as<String>(json['dataset_version']) ?? '',
      );
}

/// A record may carry several gradings, or none. None is mandatory.
class Grading {
  const Grading({
    required this.text,
    this.source,
    this.reference,
    this.notes,
    this.datasetVersion,
    this.hadithCount,
    this.bookCount,
    this.verifiedCount,
  });

  final String text;
  final String? source;
  final String? reference;
  final String? notes;
  final String? datasetVersion;

  /// Set on the label rows of `GET /api/v1/gradings`, not on a hadith grading.
  final int? hadithCount;
  final int? bookCount;
  final int? verifiedCount;

  factory Grading.fromJson(Map<String, dynamic> json) => Grading(
        text: (json['grading_text'] ?? json['label']) as String,
        source: _as<String>(json['source']) ?? _as<String>(json['grader']),
        reference: _as<String>(json['reference']),
        notes: _as<String>(json['notes']),
        datasetVersion: _as<String>(json['dataset_version']),
        hadithCount: _as<int>(json['hadith_count']),
        bookCount: _as<int>(json['book_count']),
        verifiedCount: _as<int>(json['verified_count']),
      );
}

/// The slim shape lists and search results return.
class HadithSummary {
  const HadithSummary({
    required this.id,
    required this.datasetVersion,
    required this.contentHash,
    required this.verificationStatus,
    required this.textAvailable,
    this.number,
    this.text,
    this.bookId,
    this.chapterId,
    this.sourceId,
    this.volume,
    this.page,
  });

  final String id;
  final String? number;

  /// Null while the server withholds the text — show nothing, never a fallback.
  final String? text;
  final bool textAvailable;
  final String? bookId;
  final String? chapterId;
  final String? sourceId;
  final int? volume;
  final int? page;
  final String datasetVersion;
  final String contentHash;
  final String verificationStatus;

  factory HadithSummary.fromJson(Map<String, dynamic> json) => HadithSummary(
        id: json['id'] as String,
        number: _as<String>(json['number']),
        text: _as<String>(json['text']),
        textAvailable: _as<bool>(json['text_available']) ?? false,
        bookId: _as<String>(json['book_id']),
        chapterId: _as<String>(json['chapter_id']),
        sourceId: _as<String>(json['source_id']),
        volume: _as<int>(json['volume']),
        page: _as<int>(json['page']),
        datasetVersion: _as<String>(json['dataset_version']) ?? '',
        contentHash: _as<String>(json['content_hash']) ?? '',
        verificationStatus: _as<String>(json['verification_status']) ?? 'pending',
      );
}

/// The full record, as `GET /api/v1/hadiths/{id}` returns it.
class Hadith {
  const Hadith({
    required this.id,
    required this.location,
    required this.dataset,
    required this.verification,
    required this.sourceLocked,
    required this.textAvailable,
    this.number,
    this.text,
    this.source,
    this.book,
    this.chapter,
    this.narrators = const [],
    this.references = const [],
    this.gradings = const [],
    this.takhrij,
    this.raw = const {},
  });

  final String id;
  final String? number;
  final String? text;
  final bool textAvailable;

  final Ref? source;
  final Ref? book;
  final Ref? chapter;

  final HadithLocation location;
  final DatasetRef dataset;
  final Verification verification;
  final bool sourceLocked;

  /// Present only when requested with `include:`.
  final List<Narrator> narrators;
  final List<HadithReference> references;
  final List<Grading> gradings;
  final Takhrij? takhrij;

  /// The response exactly as the server sent it. Kept so a cache can persist
  /// and restore the record without a second, lossy serialization of its own.
  final Map<String, dynamic> raw;

  /// The text to display, or null. Never a fallback, never a guess.
  String? get displayText => text;

  factory Hadith.fromJson(Map<String, dynamic> json) => Hadith(
        id: json['id'] as String,
        number: _as<String>(json['number']),
        text: _as<String>(json['text']),
        textAvailable: _as<bool>(json['text_available']) ?? false,
        source: Ref.fromJson(json['source']),
        book: Ref.fromJson(json['book']),
        chapter: Ref.fromJson(json['chapter'], nameKey: 'title'),
        location: HadithLocation.fromJson(_as<Map<String, dynamic>>(json['location'])),
        dataset: DatasetRef.fromJson(_as<Map<String, dynamic>>(json['dataset'])),
        verification: Verification.fromJson(_as<Map<String, dynamic>>(json['verification'])),
        sourceLocked: _as<bool>(json['source_locked']) ?? true,
        narrators: (json['narrators'] as List? ?? const [])
            .cast<Map<String, dynamic>>()
            .map(Narrator.fromJson)
            .toList(growable: false),
        references: (json['references'] as List? ?? const [])
            .cast<Map<String, dynamic>>()
            .map(HadithReference.fromJson)
            .toList(growable: false),
        gradings: (json['gradings'] as List? ?? const [])
            .cast<Map<String, dynamic>>()
            .map(Grading.fromJson)
            .toList(growable: false),
        takhrij: json['takhrij'] is Map<String, dynamic>
            ? Takhrij.fromJson(json['takhrij'] as Map<String, dynamic>)
            : null,
        raw: json,
      );
}

class HadithSource {
  const HadithSource({
    required this.id,
    required this.name,
    required this.licenseStatus,
    this.slug,
    this.type,
    this.publisher,
    this.url,
    this.hadithCount,
  });

  final String id;
  final String name;
  final String licenseStatus;
  final String? slug;
  final String? type;
  final String? publisher;
  final String? url;
  final int? hadithCount;

  factory HadithSource.fromJson(Map<String, dynamic> json) => HadithSource(
        id: json['id'] as String,
        name: json['name'] as String,
        licenseStatus: _as<String>(json['license_status']) ?? 'unconfirmed',
        slug: _as<String>(json['slug']),
        type: _as<String>(json['source_type']),
        publisher: _as<String>(json['publisher']),
        url: _as<String>(json['url']),
        hadithCount: _as<int>(json['hadith_count']),
      );
}

class HadithBook {
  const HadithBook({
    required this.id,
    required this.editionId,
    required this.name,
    required this.hadithCount,
    this.orderNumber,
    this.chapterCount,
    this.description,
    this.firstVolume,
    this.lastVolume,
    this.chapters = const [],
  });

  final String id;
  final String editionId;
  final String name;
  final int hadithCount;
  final int? orderNumber;
  final int? chapterCount;
  final String? description;
  final int? firstVolume;
  final int? lastVolume;

  /// Filled only by `GET /api/v1/catalog?chapters=true`.
  final List<HadithChapter> chapters;

  factory HadithBook.fromJson(Map<String, dynamic> json) => HadithBook(
        id: json['id'] as String,
        editionId: _as<String>(json['edition_id']) ?? '',
        name: json['name'] as String,
        hadithCount: _as<int>(json['hadith_count']) ?? 0,
        orderNumber: _as<int>(json['order_number']),
        chapterCount: _as<int>(json['chapter_count']),
        description: _as<String>(json['description']),
        firstVolume: _as<int>(json['first_volume']),
        lastVolume: _as<int>(json['last_volume']),
        chapters: (json['chapters'] as List? ?? const [])
            .cast<Map<String, dynamic>>()
            .map(HadithChapter.fromJson)
            .toList(growable: false),
      );
}

class HadithChapter {
  const HadithChapter({
    required this.id,
    required this.bookId,
    required this.title,
    required this.hadithCount,
    this.parentId,
    this.number,
    this.orderNumber,
    this.pageStart,
    this.pageEnd,
  });

  final String id;
  final String bookId;
  final String title;
  final int hadithCount;
  final String? parentId;
  final String? number;
  final int? orderNumber;
  final int? pageStart;
  final int? pageEnd;

  factory HadithChapter.fromJson(Map<String, dynamic> json) => HadithChapter(
        id: json['id'] as String,
        bookId: _as<String>(json['book_id']) ?? '',
        title: (json['title'] ?? json['name']) as String,
        hadithCount: _as<int>(json['hadith_count']) ?? 0,
        parentId: _as<String>(json['parent_id']),
        number: json['number']?.toString() ?? json['chapter_number']?.toString(),
        orderNumber: _as<int>(json['order_number']),
        pageStart: _as<int>(json['page_start']),
        pageEnd: _as<int>(json['page_end']),
      );
}

class DatasetVersion {
  const DatasetVersion({
    required this.version,
    required this.status,
    this.datasetHash,
    this.recordCount,
    this.isActive,
    this.sourceName,
  });

  final String version;
  final String status;
  final String? datasetHash;
  final int? recordCount;
  final bool? isActive;
  final String? sourceName;

  factory DatasetVersion.fromJson(Map<String, dynamic> json) => DatasetVersion(
        version: json['version'] as String,
        status: _as<String>(json['status']) ?? 'draft',
        datasetHash: _as<String>(json['dataset_hash']),
        recordCount: _as<int>(json['record_count']),
        isActive: _as<bool>(json['is_active']),
        sourceName: _as<String>(json['source_name']),
      );
}

/// `GET /api/v1/version` — what a client is holding right now.
class ApiVersion {
  const ApiVersion({
    required this.apiVersion,
    required this.contentLicenseConfirmed,
    this.datasetVersion,
    this.datasetHash,
    this.recordCount,
    this.status,
  });

  final String apiVersion;
  final bool contentLicenseConfirmed;
  final String? datasetVersion;
  final String? datasetHash;
  final int? recordCount;
  final String? status;

  factory ApiVersion.fromJson(Map<String, dynamic> json) => ApiVersion(
        apiVersion: _as<String>(json['api_version']) ?? 'v1',
        contentLicenseConfirmed: _as<bool>(json['content_license_confirmed']) ?? false,
        datasetVersion: _as<String>(json['dataset_version']),
        datasetHash: _as<String>(json['dataset_hash']),
        recordCount: _as<int>(json['record_count']),
        status: _as<String>(json['status']),
      );
}

class HadithStats {
  const HadithStats({required this.raw});

  final Map<String, dynamic> raw;

  int get hadiths => _as<int>(raw['hadiths']) ?? 0;
  int get books => _as<int>(raw['books']) ?? 0;
  int get chapters => _as<int>(raw['chapters']) ?? 0;
  int get sources => _as<int>(raw['sources']) ?? 0;
  int get narrators => _as<int>(raw['narrators']) ?? 0;
  int get references => _as<int>(raw['references']) ?? 0;
  int get gradings => _as<int>(raw['gradings']) ?? 0;
  int get verifiedHadiths => _as<int>(raw['verified_hadiths']) ?? 0;
  int get pendingHadiths => _as<int>(raw['pending_hadiths']) ?? 0;
  int get needsReviewHadiths => _as<int>(raw['needs_review_hadiths']) ?? 0;
  int get rejectedHadiths => _as<int>(raw['rejected_hadiths']) ?? 0;
  int get editions => _as<int>(raw['editions']) ?? 0;
  int get imports => _as<int>(raw['imports']) ?? 0;
  bool get contentLicenseConfirmed => _as<bool>(raw['content_license_confirmed']) ?? false;

  factory HadithStats.fromJson(Map<String, dynamic> json) => HadithStats(raw: json);
}

/// One page of results plus the API's meta block.
class Paged<T> {
  const Paged({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    this.totalPages,
  });

  final List<T> items;
  final int page;
  final int limit;
  final int total;
  final int? totalPages;

  int get currentPage => page;
  bool get hasMore => page * limit < total;

  factory Paged.fromResponse(
    Object? data,
    Map<String, dynamic> meta,
    T Function(Map<String, dynamic>) map,
  ) {
    final items =
        (data as List? ?? const []).cast<Map<String, dynamic>>().map(map).toList(growable: false);
    final limit = _as<int>(meta['limit']) ?? items.length;
    final total = _as<int>(meta['total']) ?? items.length;
    return Paged<T>(
      items: items,
      page: _as<int>(meta['current_page']) ?? _as<int>(meta['page']) ?? 1,
      limit: limit,
      total: total,
      totalPages: _as<int>(meta['total_pages']) ?? (limit > 0 ? (total + limit - 1) ~/ limit : 0),
    );
  }
}

/// One printed edition of a source book. `GET /api/v1/editions`.
class HadithEdition {
  const HadithEdition({
    required this.id,
    required this.title,
    this.slug,
    this.author,
    this.publisher,
    this.editionNumber,
    this.publicationYear,
    this.volumeCount,
    this.hadithCount,
  });

  final String id;
  final String title;
  final String? slug;
  final String? author;
  final String? publisher;
  final int? editionNumber;
  final int? publicationYear;
  final int? volumeCount;
  final int? hadithCount;

  factory HadithEdition.fromJson(Map<String, dynamic> json) => HadithEdition(
        id: json['id'] as String,
        title: json['title'] as String,
        slug: _as<String>(json['slug']),
        author: _as<String>(json['author']),
        publisher: _as<String>(json['publisher']),
        editionNumber: _as<int>(json['edition_number']),
        publicationYear: _as<int>(json['publication_year']),
        volumeCount: _as<int>(json['volume_count']),
        hadithCount: _as<int>(json['hadith_count']),
      );
}

/// A collection this edition cites in its takhrij. `GET /api/v1/collections`.
class Collection {
  const Collection({
    required this.name,
    required this.hadithCount,
    this.bookCount,
    this.firstVolume,
    this.lastVolume,
    this.corroboratedCount,
  });

  final String name;
  final int hadithCount;
  final int? bookCount;
  final int? firstVolume;
  final int? lastVolume;

  /// How many of those citations an independent corpus corroborates.
  final int? corroboratedCount;

  factory Collection.fromJson(Map<String, dynamic> json) => Collection(
        name: json['name'] as String,
        hadithCount: _as<int>(json['hadith_count']) ?? 0,
        bookCount: _as<int>(json['book_count']),
        firstVolume: _as<int>(json['first_volume']),
        lastVolume: _as<int>(json['last_volume']),
        corroboratedCount: _as<int>(json['corroborated_count']),
      );
}

/// One printed volume. `GET /api/v1/volumes`.
class Volume {
  const Volume({
    required this.volume,
    required this.hadithCount,
    this.editionId,
    this.firstPage,
    this.lastPage,
    this.pagesWithText,
    this.bookCount,
  });

  final int volume;
  final int hadithCount;
  final String? editionId;
  final int? firstPage;
  final int? lastPage;
  final int? pagesWithText;
  final int? bookCount;

  factory Volume.fromJson(Map<String, dynamic> json) => Volume(
        volume: _as<int>(json['volume']) ?? 0,
        hadithCount: _as<int>(json['hadith_count']) ?? 0,
        editionId: _as<String>(json['edition_id']),
        firstPage: _as<int>(json['first_page']),
        lastPage: _as<int>(json['last_page']),
        pagesWithText: _as<int>(json['pages_with_text']),
        bookCount: _as<int>(json['book_count']),
      );
}

/// How the dataset compares with an independent corpus. This is a MACHINE
/// cross-check, never a human verification: it never makes a hadith "verified".
class CrossCheckSummary {
  const CrossCheckSummary({
    required this.datasetVersion,
    required this.referenceName,
    required this.checked,
    required this.corroborated,
    required this.partial,
    required this.notFound,
    this.referenceSlug,
    this.takhrijAgrees,
    this.takhrijDisagrees,
    this.meanSimilarity,
  });

  final String datasetVersion;
  final String referenceName;
  final int checked;
  final int corroborated;
  final int partial;
  final int notFound;
  final String? referenceSlug;
  final int? takhrijAgrees;
  final int? takhrijDisagrees;
  final String? meanSimilarity;

  factory CrossCheckSummary.fromJson(Map<String, dynamic> json) => CrossCheckSummary(
        datasetVersion: json['dataset_version'] as String,
        referenceName: (json['reference_name'] ?? '') as String,
        checked: _as<int>(json['checked']) ?? 0,
        corroborated: _as<int>(json['corroborated']) ?? 0,
        partial: _as<int>(json['partial']) ?? 0,
        notFound: _as<int>(json['not_found']) ?? 0,
        referenceSlug: _as<String>(json['reference_slug']),
        takhrijAgrees: _as<int>(json['takhrij_agrees']),
        takhrijDisagrees: _as<int>(json['takhrij_disagrees']),
        meanSimilarity: json['mean_similarity']?.toString(),
      );
}

/// One machine cross-check of a record against an independent corpus.
/// It is evidence for a human, never a verdict on the hadith itself.
class CrossCheck {
  const CrossCheck({
    required this.reference,
    required this.verdict,
    this.referenceName,
    this.referenceCollection,
    this.referenceNumber,
    this.method,
    this.similarity,
    this.takhrijAgrees,
    this.takhrijCollections = const [],
    this.details = const {},
  });

  /// The reference corpus slug, e.g. `npm-hadith-1.3.0`.
  final String reference;
  final String? referenceName;

  /// corroborated | partial | not_found
  final String verdict;
  final String? referenceCollection;
  final String? referenceNumber;
  final String? method;
  final String? similarity;
  final bool? takhrijAgrees;
  final List<String> takhrijCollections;
  final Map<String, dynamic> details;

  double get similarityValue => double.tryParse(similarity ?? '') ?? 0;

  factory CrossCheck.fromJson(Map<String, dynamic> json) => CrossCheck(
        reference: _as<String>(json['reference']) ?? '',
        referenceName: _as<String>(json['reference_name']),
        verdict: _as<String>(json['verdict']) ?? 'not_found',
        referenceCollection: _as<String>(json['reference_collection']),
        referenceNumber: json['reference_number']?.toString(),
        method: _as<String>(json['method']),
        similarity: json['similarity']?.toString(),
        takhrijAgrees: _as<bool>(json['takhrij_agrees']),
        takhrijCollections:
            (json['takhrij_collections'] as List? ?? const []).map((e) => '$e').toList(growable: false),
        details: _as<Map<String, dynamic>>(json['details']) ?? const {},
      );
}

/// A record waiting for a human to look at it, worst match first.
class ReviewQueueItem {
  const ReviewQueueItem({
    required this.hadithId,
    required this.verdict,
    this.sourceLocator,
    this.volume,
    this.page,
    this.grading,
    this.similarity,
    this.takhrijCollections = const [],
    this.takhrijAgrees,
    this.referenceCollection,
    this.book,
    this.chapter,
  });

  final String hadithId;
  final String verdict;
  final String? sourceLocator;
  final int? volume;
  final int? page;
  final String? grading;
  final String? similarity;
  final List<String> takhrijCollections;
  final bool? takhrijAgrees;
  final String? referenceCollection;
  final String? book;
  final String? chapter;

  factory ReviewQueueItem.fromJson(Map<String, dynamic> json) => ReviewQueueItem(
        hadithId: json['hadith_id'] as String,
        verdict: _as<String>(json['verdict']) ?? 'not_found',
        sourceLocator: _as<String>(json['source_locator']),
        volume: _as<int>(json['volume']),
        page: _as<int>(json['page']),
        grading: _as<String>(json['grading']),
        similarity: json['similarity']?.toString(),
        takhrijCollections:
            (json['takhrij_collections'] as List? ?? const []).map((e) => '$e').toList(growable: false),
        takhrijAgrees: _as<bool>(json['takhrij_agrees']),
        referenceCollection: _as<String>(json['reference_collection']),
        book: _as<String>(json['book']),
        chapter: _as<String>(json['chapter']),
      );
}
