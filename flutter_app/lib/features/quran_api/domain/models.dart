/// Domain models for the FALAH Quran API (`/api/v1`).
///
/// SOURCE_LOCK: every model keeps the text exactly as the API returned it,
/// together with its `contentHash`, source and verification state. Nothing is
/// rewritten, trimmed or normalised on the client. Fields the API returns as
/// null stay null — the UI shows "غير متوفر", it never guesses.
library;

/// Envelope shared by every endpoint: `{ success, data, meta }`.
class ApiEnvelope<T> {
  const ApiEnvelope({required this.data, this.meta = const {}});

  final T data;
  final Map<String, dynamic> meta;
}

/// A page of results plus the API pagination meta.
class Paginated<T> {
  const Paginated({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final List<T> items;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  static Paginated<T> fromEnvelope<T>(
    ApiEnvelope<List<T>> envelope,
  ) {
    final meta = envelope.meta;
    final total = (meta['total'] as num?)?.toInt() ?? envelope.data.length;
    final limit = (meta['limit'] as num?)?.toInt() ?? envelope.data.length;
    return Paginated<T>(
      items: envelope.data,
      page: (meta['page'] as num?)?.toInt() ?? 1,
      limit: limit,
      total: total,
      totalPages: (meta['total_pages'] as num?)?.toInt() ?? 1,
    );
  }

  bool get hasMore => page < totalPages;
}

int? _int(Object? value) => value == null ? null : (value as num).toInt();
String? _str(Object? value) => value as String?;

class QuranEditionRef {
  const QuranEditionRef({
    required this.id,
    required this.slug,
    required this.name,
    this.riwayah,
    this.qiraah,
  });

  final String id;
  final String slug;
  final String name;
  final String? riwayah;
  final String? qiraah;

  factory QuranEditionRef.fromJson(Map<String, dynamic> json) =>
      QuranEditionRef(
        id: json['id'] as String,
        slug: json['slug'] as String,
        name: json['name'] as String,
        riwayah: _str(json['riwayah']),
        qiraah: _str(json['qiraah']),
      );
}

class QuranSourceRef {
  const QuranSourceRef({required this.id, this.name, this.version});

  final String id;
  final String? name;
  final String? version;

  factory QuranSourceRef.fromJson(Map<String, dynamic> json) => QuranSourceRef(
    id: json['id'] as String,
    name: _str(json['name']),
    version: _str(json['version']),
  );
}

class QuranSurah {
  const QuranSurah({
    required this.id,
    required this.number,
    required this.nameAr,
    required this.ayahCount,
    required this.verified,
    this.nameEn,
    this.transliteration,
    this.revelationPlace,
    this.revelationOrder,
    this.bismillah,
    this.sourceId,
    this.datasetVersion,
  });

  final String id;
  final int number;
  final String nameAr;
  final String? nameEn;
  final String? transliteration;
  final String? revelationPlace;
  final int? revelationOrder;
  final int ayahCount;

  /// Null when the source dataset carries no bismillah text. Never invented.
  final String? bismillah;
  final String? sourceId;
  final bool verified;
  final String? datasetVersion;

  factory QuranSurah.fromJson(Map<String, dynamic> json) => QuranSurah(
    id: json['id'] as String,
    number: (json['surah_number'] as num).toInt(),
    nameAr: json['name_ar'] as String,
    nameEn: _str(json['name_en']),
    transliteration: _str(json['name_transliteration']),
    revelationPlace: _str(json['revelation_place']),
    revelationOrder: _int(json['revelation_order']),
    ayahCount: (json['ayah_count'] as num).toInt(),
    bismillah: _str(json['bismillah']),
    sourceId: _str(json['source_id']),
    verified: json['verified'] as bool? ?? false,
    datasetVersion: _str(json['dataset_version']),
  );
}

class QuranAyahTranslation {
  const QuranAyahTranslation({required this.text, this.title, this.language});

  final String text;
  final String? title;
  final String? language;

  factory QuranAyahTranslation.fromJson(Map<String, dynamic> json) =>
      QuranAyahTranslation(
        text: json['text'] as String,
        title: _str(json['title']),
        language: _str(json['language']),
      );
}

class QuranAyah {
  const QuranAyah({
    required this.id,
    required this.surahNumber,
    required this.surahNameAr,
    required this.ayahNumber,
    required this.globalAyahNumber,
    required this.text,
    required this.contentHash,
    required this.verified,
    required this.verificationStatus,
    this.juz,
    this.hizb,
    this.rub,
    this.page,
    this.manzil,
    this.ruku,
    this.sajdah = false,
    this.sajdahType,
    this.textUthmani,
    this.textSimple,
    this.edition,
    this.source,
    this.translation,
    this.datasetVersion,
  });

  final String id;
  final int surahNumber;
  final String surahNameAr;
  final int ayahNumber;
  final int globalAyahNumber;
  final int? juz;
  final int? hizb;
  final int? rub;
  final int? page;
  final int? manzil;
  final int? ruku;
  final bool sajdah;

  /// Null unless the source states the ruling — never derived on the client.
  final String? sajdahType;

  /// The verbatim source text. Do not transform before display.
  final String text;
  final String? textUthmani;
  final String? textSimple;
  final String contentHash;
  final bool verified;
  final String verificationStatus;
  final QuranEditionRef? edition;
  final QuranSourceRef? source;
  final QuranAyahTranslation? translation;
  final String? datasetVersion;

  String get ayahKey => '$surahNumber:$ayahNumber';

  factory QuranAyah.fromJson(Map<String, dynamic> json) {
    final surah = (json['surah'] as Map).cast<String, dynamic>();
    final verification =
        (json['verification'] as Map?)?.cast<String, dynamic>() ?? const {};
    return QuranAyah(
      id: json['id'] as String,
      surahNumber: (surah['number'] as num).toInt(),
      surahNameAr: surah['name_ar'] as String,
      ayahNumber: (json['ayah_number'] as num).toInt(),
      globalAyahNumber: (json['global_ayah_number'] as num).toInt(),
      juz: _int(json['juz']),
      hizb: _int(json['hizb']),
      rub: _int(json['rub']),
      page: _int(json['page']),
      manzil: _int(json['manzil']),
      ruku: _int(json['ruku']),
      sajdah: json['sajdah'] as bool? ?? false,
      sajdahType: _str(json['sajdah_type']),
      text: json['text'] as String,
      textUthmani: _str(json['text_uthmani']),
      textSimple: _str(json['text_simple']),
      contentHash: json['content_hash'] as String,
      verified: verification['verified'] as bool? ?? false,
      verificationStatus: _str(verification['status']) ?? 'pending',
      edition: json['edition'] == null
          ? null
          : QuranEditionRef.fromJson((json['edition'] as Map).cast<String, dynamic>()),
      source: json['source'] == null
          ? null
          : QuranSourceRef.fromJson((json['source'] as Map).cast<String, dynamic>()),
      translation: json['translation'] == null
          ? null
          : QuranAyahTranslation.fromJson(
              (json['translation'] as Map).cast<String, dynamic>(),
            ),
      datasetVersion: _str(json['dataset_version']),
    );
  }

  Map<String, dynamic> toCacheJson() => {
    'id': id,
    'surah': {'number': surahNumber, 'name_ar': surahNameAr},
    'ayah_number': ayahNumber,
    'global_ayah_number': globalAyahNumber,
    'juz': juz,
    'hizb': hizb,
    'rub': rub,
    'page': page,
    'manzil': manzil,
    'ruku': ruku,
    'sajdah': sajdah,
    'sajdah_type': sajdahType,
    'text': text,
    'text_uthmani': textUthmani,
    'text_simple': textSimple,
    'content_hash': contentHash,
    'verification': {'verified': verified, 'status': verificationStatus},
    'dataset_version': datasetVersion,
  };
}

/// One structural division: juz, hizb, rub al-hizb, page or manzil.
class QuranDivision {
  const QuranDivision({
    required this.id,
    required this.number,
    required this.startSurah,
    required this.startAyah,
    required this.endSurah,
    required this.endAyah,
    required this.startGlobalAyah,
    required this.endGlobalAyah,
    this.sourceId,
    this.verified = false,
    this.juzNumber,
    this.hizbNumber,
    this.quarter,
    this.surahNumber,
  });

  final String id;
  final int number;
  final int startSurah;
  final int startAyah;
  final int endSurah;
  final int endAyah;
  final int startGlobalAyah;
  final int endGlobalAyah;
  final String? sourceId;
  final bool verified;

  /// Rubs and hizbs carry their juz; rubs their hizb and quarter; rukus their surah.
  final int? juzNumber;
  final int? hizbNumber;
  final int? quarter;
  final int? surahNumber;

  factory QuranDivision.fromJson(Map<String, dynamic> json) => QuranDivision(
    id: json['id'] as String,
    number: (json['number'] as num).toInt(),
    startSurah: (json['start_surah'] as num).toInt(),
    startAyah: (json['start_ayah'] as num).toInt(),
    endSurah: (json['end_surah'] as num).toInt(),
    endAyah: (json['end_ayah'] as num).toInt(),
    startGlobalAyah: (json['start_global_ayah'] as num).toInt(),
    endGlobalAyah: (json['end_global_ayah'] as num).toInt(),
    sourceId: _str(json['source_id']),
    verified: json['verified'] as bool? ?? false,
    juzNumber: _int(json['juz_number']),
    hizbNumber: _int(json['hizb_number']),
    quarter: _int(json['quarter']),
    surahNumber: _int(json['surah_number']),
  );
}

typedef QuranJuz = QuranDivision;
typedef QuranHizb = QuranDivision;
typedef QuranPage = QuranDivision;
typedef QuranManzil = QuranDivision;
typedef QuranRub = QuranDivision;
typedef QuranRuku = QuranDivision;

/// A sajdah position as `/api/v1/sajdahs` reports it.
class QuranSajdah {
  const QuranSajdah({
    required this.ayahId,
    required this.surah,
    required this.ayah,
    required this.globalAyahNumber,
    required this.juz,
    required this.page,
    this.sajdahType,
    this.sourceId,
    this.verified = false,
  });

  final String ayahId;
  final int surah;
  final int ayah;
  final int globalAyahNumber;
  final int juz;
  final int page;

  /// Null unless the source states the ruling — never inferred.
  final String? sajdahType;
  final String? sourceId;
  final bool verified;

  factory QuranSajdah.fromJson(Map<String, dynamic> json) => QuranSajdah(
    ayahId: json['ayah_id'] as String,
    surah: (json['surah'] as num).toInt(),
    ayah: (json['ayah'] as num).toInt(),
    globalAyahNumber: (json['global_ayah_number'] as num).toInt(),
    juz: (json['juz'] as num).toInt(),
    page: (json['page'] as num).toInt(),
    sajdahType: _str(json['sajdah_type']),
    sourceId: _str(json['source_id']),
    verified: json['verified'] as bool? ?? false,
  );

  String get key => '$surah:$ayah';
}

class QuranTranslation {
  const QuranTranslation({
    required this.id,
    required this.slug,
    required this.language,
    required this.title,
    this.translator,
    this.license,
    this.licenseUrl,
    this.verified = false,
  });

  final String id;
  final String slug;
  final String language;
  final String title;
  final String? translator;
  final String? license;
  final String? licenseUrl;
  final bool verified;

  factory QuranTranslation.fromJson(Map<String, dynamic> json) =>
      QuranTranslation(
        id: json['id'] as String,
        slug: json['slug'] as String,
        language: json['language'] as String,
        title: json['title'] as String,
        translator: _str(json['translator']),
        license: _str(json['license']),
        licenseUrl: _str(json['license_url']),
        verified: json['verified'] as bool? ?? false,
      );
}

class QuranQiraah {
  const QuranQiraah({
    required this.id,
    required this.slug,
    required this.nameAr,
    this.nameEn,
    this.description,
    this.sourceId,
    this.verified = false,
  });

  final String id;
  final String slug;
  final String nameAr;
  final String? nameEn;
  final String? description;
  final String? sourceId;
  final bool verified;

  factory QuranQiraah.fromJson(Map<String, dynamic> json) => QuranQiraah(
    id: json['id'] as String,
    slug: json['slug'] as String,
    nameAr: json['name_ar'] as String,
    nameEn: _str(json['name_en']),
    description: _str(json['description']),
    sourceId: _str(json['source_id']),
    verified: json['verified'] as bool? ?? false,
  );
}

class QuranRiwayah extends QuranQiraah {
  const QuranRiwayah({
    required super.id,
    required super.slug,
    required super.nameAr,
    super.nameEn,
    super.description,
    super.sourceId,
    super.verified,
    this.qiraahId,
    this.qiraahNameAr,
  });

  final String? qiraahId;
  final String? qiraahNameAr;

  factory QuranRiwayah.fromJson(Map<String, dynamic> json) => QuranRiwayah(
    id: json['id'] as String,
    slug: json['slug'] as String,
    nameAr: json['name_ar'] as String,
    nameEn: _str(json['name_en']),
    description: _str(json['description']),
    sourceId: _str(json['source_id']),
    verified: json['verified'] as bool? ?? false,
    qiraahId: _str(json['qiraah_id']),
    qiraahNameAr: _str(json['qiraah_name_ar']),
  );
}

class QuranReciter {
  const QuranReciter({
    required this.id,
    required this.slug,
    required this.nameAr,
    this.nameEn,
    this.displayName,
    this.bio,
    this.country,
    this.birthYear,
    this.deathYear,
    this.photoUrl,
    this.website,
    this.attributionRequired = true,
    this.attributionText,
    this.verified = false,
  });

  final String id;
  final String slug;
  final String nameAr;
  final String? nameEn;
  final String? displayName;

  /// Biography, country, years and photo are null unless the source has them.
  final String? bio;
  final String? country;
  final int? birthYear;
  final int? deathYear;
  final String? photoUrl;
  final String? website;
  final bool attributionRequired;
  final String? attributionText;
  final bool verified;

  factory QuranReciter.fromJson(Map<String, dynamic> json) => QuranReciter(
    id: json['id'] as String,
    slug: json['slug'] as String,
    nameAr: json['name_ar'] as String,
    nameEn: _str(json['name_en']),
    displayName: _str(json['display_name']),
    bio: _str(json['bio']),
    country: _str(json['country']),
    birthYear: _int(json['birth_year']),
    deathYear: _int(json['death_year']),
    photoUrl: _str(json['photo_url']),
    website: _str(json['website']),
    attributionRequired: json['attribution_required'] as bool? ?? true,
    attributionText: _str(json['attribution_text']),
    verified: json['verified'] as bool? ?? false,
  );
}

class QuranRecitation {
  const QuranRecitation({
    required this.id,
    required this.reciterId,
    required this.name,
    required this.type,
    required this.status,
    this.riwayahId,
    this.quality,
    this.format,
    this.bitrate,
    this.sampleRate,
    this.verified = false,
  });

  final String id;
  final String reciterId;
  final String? riwayahId;
  final String name;
  final String type;
  final String? quality;
  final String? format;
  final int? bitrate;
  final int? sampleRate;
  final String status;
  final bool verified;

  factory QuranRecitation.fromJson(Map<String, dynamic> json) =>
      QuranRecitation(
        id: json['id'] as String,
        reciterId: json['reciter_id'] as String,
        riwayahId: _str(json['riwayah_id']),
        name: json['name'] as String,
        type: json['type'] as String,
        quality: _str(json['quality']),
        format: _str(json['format']),
        bitrate: _int(json['bitrate']),
        sampleRate: _int(json['sample_rate']),
        status: _str(json['status']) ?? 'restricted',
        verified: json['verified'] as bool? ?? false,
      );
}

class QuranAudioFile {
  const QuranAudioFile({
    required this.id,
    required this.recitationId,
    required this.sequenceNumber,
    required this.audioUrl,
    required this.status,
    required this.verified,
    required this.downloadable,
    this.ayahId,
    this.surahId,
    this.streamUrl,
    this.downloadUrl,
    this.format,
    this.codec,
    this.bitrate,
    this.sampleRate,
    this.durationMs,
    this.fileSize,
    this.checksum,
  });

  final String id;
  final String recitationId;
  final String? ayahId;
  final String? surahId;
  final int sequenceNumber;
  final String audioUrl;
  final String? streamUrl;

  /// Null while audio redistribution rights are not confirmed.
  final String? downloadUrl;
  final bool downloadable;
  final String? format;
  final String? codec;
  final int? bitrate;
  final int? sampleRate;
  final int? durationMs;
  final int? fileSize;
  final String? checksum;
  final String status;
  final bool verified;

  /// What a player should open: the streaming URL when present, else the file.
  String get playbackUrl => streamUrl ?? audioUrl;

  factory QuranAudioFile.fromJson(Map<String, dynamic> json) => QuranAudioFile(
    id: json['id'] as String,
    recitationId: json['recitation_id'] as String,
    ayahId: _str(json['ayah_id']),
    surahId: _str(json['surah_id']),
    sequenceNumber: (json['sequence_number'] as num).toInt(),
    audioUrl: json['audio_url'] as String,
    streamUrl: _str(json['stream_url']),
    downloadUrl: _str(json['download_url']),
    downloadable: json['downloadable'] as bool? ?? false,
    format: _str(json['format']),
    codec: _str(json['codec']),
    bitrate: _int(json['bitrate']),
    sampleRate: _int(json['sample_rate']),
    durationMs: _int(json['duration_ms']),
    fileSize: _int(json['file_size']),
    checksum: _str(json['checksum']),
    status: _str(json['status']) ?? 'restricted',
    verified: json['verified'] as bool? ?? false,
  );
}

/// Offline manifest returned by `/api/v1/downloads/quran`.
class QuranDownloadManifest {
  const QuranDownloadManifest({
    required this.datasetVersion,
    required this.checksum,
    required this.recordCount,
    required this.sizeBytes,
    required this.downloadable,
    required this.licenseNote,
    this.editionSlug,
    this.language,
  });

  final String datasetVersion;
  final String checksum;
  final int recordCount;
  final int sizeBytes;
  final bool downloadable;
  final String licenseNote;
  final String? editionSlug;
  final String? language;

  factory QuranDownloadManifest.fromJson(Map<String, dynamic> json) =>
      QuranDownloadManifest(
        datasetVersion: json['dataset_version'] as String,
        checksum: json['checksum'] as String,
        recordCount: (json['record_count'] as num?)?.toInt() ?? 0,
        sizeBytes: (json['size'] as num?)?.toInt() ?? 0,
        downloadable: json['downloadable'] as bool? ?? false,
        licenseNote: _str(json['license_note']) ?? '',
        editionSlug: _str(
          (json['edition'] as Map?)?.cast<String, dynamic>()['slug'],
        ),
        language: _str(json['language']),
      );
}
