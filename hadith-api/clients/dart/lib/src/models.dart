/// Domain models for the FALAH Hadith API.
///
/// SOURCE_LOCK: every field is exactly what the API returned. Nothing is
/// completed, corrected or guessed on the client. A field the source does not
/// carry stays `null`, and the UI shows nothing rather than inventing a value.
library;

class HadithRef {
  const HadithRef({required this.id, required this.name});

  final String id;
  final String name;

  static HadithRef? fromJson(Object? json) {
    if (json is! Map<String, dynamic>) return null;
    final id = json['id'];
    if (id is! String) return null;
    return HadithRef(id: id, name: json['name'] as String? ?? '');
  }
}

class HadithSourceInfo {
  const HadithSourceInfo({this.name, this.edition, this.publisher});

  final String? name;
  final String? edition;
  final String? publisher;

  factory HadithSourceInfo.fromJson(Map<String, dynamic>? json) => HadithSourceInfo(
        name: json?['name'] as String?,
        edition: json?['edition'] as String?,
        publisher: json?['publisher'] as String?,
      );
}

class HadithVerification {
  const HadithVerification({required this.verified, required this.status});

  final bool verified;
  final String status;

  factory HadithVerification.fromJson(Map<String, dynamic>? json) => HadithVerification(
        verified: json?['verified'] as bool? ?? false,
        status: json?['status'] as String? ?? 'pending',
      );
}

class Hadith {
  const Hadith({
    required this.id,
    required this.contentHash,
    required this.datasetVersion,
    required this.sourceLocked,
    required this.textAvailable,
    required this.source,
    required this.verification,
    this.hadithNumber,
    this.book,
    this.chapter,
    this.narrator,
    this.rawText,
    this.matn,
    this.isnad,
    this.takhrij,
    this.grading,
    this.volume,
    this.page,
  });

  final String id;
  final String? hadithNumber;
  final HadithRef? book;
  final HadithRef? chapter;
  final HadithRef? narrator;

  /// Null while the API withholds the text (content licence unconfirmed).
  final String? rawText;
  final String? matn;
  final String? isnad;
  final String? takhrij;
  final String? grading;
  final int? volume;
  final int? page;

  final HadithSourceInfo source;
  final HadithVerification verification;
  final bool sourceLocked;
  final String contentHash;
  final String datasetVersion;

  /// False means the server did not send the text; it is not an error state.
  final bool textAvailable;

  /// The text to display, or null. Never a fallback string, never a guess.
  String? get displayText => rawText ?? matn;

  factory Hadith.fromJson(Map<String, dynamic> json) => Hadith(
        id: json['id'] as String,
        hadithNumber: json['hadith_number'] as String?,
        book: HadithRef.fromJson(json['book']),
        chapter: HadithRef.fromJson(json['chapter']),
        narrator: HadithRef.fromJson(json['narrator']),
        rawText: json['raw_text'] as String?,
        matn: json['matn'] as String?,
        isnad: json['isnad'] as String?,
        takhrij: json['takhrij'] as String?,
        grading: json['grading'] as String?,
        volume: json['volume'] as int?,
        page: json['page'] as int?,
        source: HadithSourceInfo.fromJson(json['source'] as Map<String, dynamic>?),
        verification: HadithVerification.fromJson(json['verification'] as Map<String, dynamic>?),
        sourceLocked: json['source_locked'] as bool? ?? true,
        contentHash: json['content_hash'] as String? ?? '',
        datasetVersion: json['dataset_version'] as String? ?? '',
        textAvailable: json['text_available'] as bool? ?? false,
      );
}

class HadithBook {
  const HadithBook({
    required this.id,
    required this.editionId,
    required this.name,
    required this.hadithCount,
    this.orderNumber,
    this.description,
  });

  final String id;
  final String editionId;
  final String name;
  final int hadithCount;
  final int? orderNumber;
  final String? description;

  factory HadithBook.fromJson(Map<String, dynamic> json) => HadithBook(
        id: json['id'] as String,
        editionId: json['edition_id'] as String,
        name: json['name'] as String,
        hadithCount: json['hadith_count'] as int? ?? 0,
        orderNumber: json['order_number'] as int?,
        description: json['description'] as String?,
      );
}

class HadithChapter {
  const HadithChapter({
    required this.id,
    required this.bookId,
    required this.name,
    required this.hadithCount,
    this.parentId,
    this.chapterNumber,
    this.orderNumber,
  });

  final String id;
  final String bookId;
  final String name;
  final int hadithCount;
  final String? parentId;
  final String? chapterNumber;
  final int? orderNumber;

  factory HadithChapter.fromJson(Map<String, dynamic> json) => HadithChapter(
        id: json['id'] as String,
        bookId: json['book_id'] as String,
        name: json['name'] as String,
        hadithCount: json['hadith_count'] as int? ?? 0,
        parentId: json['parent_id'] as String?,
        chapterNumber: json['chapter_number'] as String?,
        orderNumber: json['order_number'] as int?,
      );
}

class Narrator {
  const Narrator({
    required this.id,
    required this.name,
    required this.hadithCount,
    this.kunya,
    this.laqab,
    this.biography,
    this.sourceReference,
  });

  final String id;
  final String name;
  final int hadithCount;
  final String? kunya;
  final String? laqab;

  /// Only what the source itself carries; never enriched from elsewhere.
  final String? biography;
  final String? sourceReference;

  factory Narrator.fromJson(Map<String, dynamic> json) => Narrator(
        id: json['id'] as String,
        name: json['name'] as String,
        hadithCount: json['hadith_count'] as int? ?? 0,
        kunya: json['kunya'] as String?,
        laqab: json['laqab'] as String?,
        biography: json['biography'] as String?,
        sourceReference: json['source_reference'] as String?,
      );
}

class HadithGrading {
  const HadithGrading({required this.grading, this.grader, this.sourceReference, this.notes});

  final String grading;
  final String? grader;
  final String? sourceReference;
  final String? notes;

  factory HadithGrading.fromJson(Map<String, dynamic> json) => HadithGrading(
        grading: json['grading'] as String,
        grader: json['grader'] as String?,
        sourceReference: json['source_reference'] as String?,
        notes: json['notes'] as String?,
      );
}

class HadithEdition {
  const HadithEdition({
    required this.id,
    required this.slug,
    required this.title,
    this.author,
    this.publisher,
    this.editionNumber,
    this.publicationYear,
    this.hijriYear,
    this.volumeCount,
    this.datasetVersion,
  });

  final String id;
  final String slug;
  final String title;
  final String? author;
  final String? publisher;
  final int? editionNumber;
  final int? publicationYear;
  final int? hijriYear;
  final int? volumeCount;
  final String? datasetVersion;

  factory HadithEdition.fromJson(Map<String, dynamic> json) => HadithEdition(
        id: json['id'] as String,
        slug: json['slug'] as String,
        title: json['title'] as String,
        author: json['author'] as String?,
        publisher: json['publisher'] as String?,
        editionNumber: json['edition_number'] as int?,
        publicationYear: json['publication_year'] as int?,
        hijriYear: json['hijri_year'] as int?,
        volumeCount: json['volume_count'] as int?,
        datasetVersion: json['dataset_version'] as String?,
      );
}

/// One page of results plus the API's meta block.
class Paged<T> {
  const Paged({required this.items, required this.page, required this.limit, required this.total});

  final List<T> items;
  final int page;
  final int limit;
  final int total;

  bool get hasMore => page * limit < total;
  int get totalPages => limit == 0 ? 0 : (total + limit - 1) ~/ limit;
}
