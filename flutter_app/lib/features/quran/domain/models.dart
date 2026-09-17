/// Quran domain models. Sacred text always travels as [LockedText]
/// (SOURCE_LOCK) — these models carry it together with its verified source.
library;

import '../../../core/sourcelock/source_lock.dart';

/// Same dataset and versions as the PWA, so checksums match byte-for-byte.
const tanzilSource = SourceMetadata(
  sourceId: 'tanzil-uthmani',
  sourceName: 'Tanzil Project — Quran Uthmani (via quran-json)',
  sourceUrl: 'https://tanzil.net',
  sourceVersion: 'quran-json@3.1.2',
  verifiedAt: '2026-08-28T00:00:00Z',
  reviewStatus: ReviewStatus.verified,
);

const sahihIntlSource = SourceMetadata(
  sourceId: 'en-sahih-international',
  sourceName: 'Sahih International translation',
  sourceUrl: 'https://tanzil.net/trans/',
  sourceVersion: 'quran-json@3.1.2',
  verifiedAt: '2026-08-28T00:00:00Z',
  reviewStatus: ReviewStatus.verified,
);

enum Revelation { meccan, medinan }

class Surah {
  final int number;
  final String name;
  final String transliteration;
  final Revelation revelation;
  final int ayahCount;

  const Surah({
    required this.number,
    required this.name,
    required this.transliteration,
    required this.revelation,
    required this.ayahCount,
  });

  factory Surah.fromJson(Map<String, dynamic> json) => Surah(
    number: json['id'] as int,
    name: json['name'] as String,
    transliteration: json['transliteration'] as String,
    revelation: json['type'] == 'medinan'
        ? Revelation.medinan
        : Revelation.meccan,
    ayahCount: json['total_verses'] as int,
  );
}

class Ayah {
  final int surah;
  final int ayah;

  /// The verified Uthmani text, locked with its checksum and source.
  final LockedText locked;
  final String? translation;

  const Ayah({
    required this.surah,
    required this.ayah,
    required this.locked,
    this.translation,
  });

  String get text => locked.text;
  String get key => '$surah:$ayah';
}

class QuranSearchResult {
  final Ayah ayah;
  final String surahName;
  const QuranSearchResult(this.ayah, this.surahName);
}

// ---------------------------------------------------------------------------
// Mushaf structure (assets/quran/structure.json) — boundaries only, no text.
// Generated from the source dataset by quran_api/scripts/quran-structure.ts.
// ---------------------------------------------------------------------------

/// One position in the mushaf: surah, ayah and the global ayah number (1..6236).
class MushafPosition {
  const MushafPosition({
    required this.surah,
    required this.ayah,
    required this.global,
  });

  final int surah;
  final int ayah;
  final int global;

  factory MushafPosition.fromJson(Map<String, dynamic> json) => MushafPosition(
    surah: json['surah'] as int,
    ayah: json['ayah'] as int,
    global: json['global'] as int,
  );

  String get key => '$surah:$ayah';
}

/// A juz, hizb, rub, page, manzil or ruku: a numbered inclusive range.
class MushafDivision {
  const MushafDivision({
    required this.number,
    required this.start,
    required this.end,
    this.juz,
    this.hizb,
    this.quarter,
    this.surah,
  });

  final int number;
  final MushafPosition start;
  final MushafPosition end;

  /// Set on hizbs and rubs.
  final int? juz;

  /// Set on rubs.
  final int? hizb;
  final int? quarter;

  /// Set on rukus: the surah the ruku belongs to (a ruku never crosses one).
  final int? surah;

  factory MushafDivision.fromJson(Map<String, dynamic> json) => MushafDivision(
    number: json['number'] as int,
    start: MushafPosition.fromJson(json['start'] as Map<String, dynamic>),
    end: MushafPosition.fromJson(json['end'] as Map<String, dynamic>),
    juz: json['juz'] as int?,
    hizb: json['hizb'] as int?,
    quarter: json['quarter'] as int?,
    surah: json['surah'] as int?,
  );

  int get ayahCount => end.global - start.global + 1;
}

/// A sajdah position recorded by the source dataset (15 in the Hafs mushaf).
class SajdahPosition {
  const SajdahPosition({
    required this.surah,
    required this.ayah,
    required this.global,
    required this.juz,
    required this.page,
  });

  final int surah;
  final int ayah;
  final int global;
  final int juz;
  final int page;

  factory SajdahPosition.fromJson(Map<String, dynamic> json) => SajdahPosition(
    surah: json['surah'] as int,
    ayah: json['ayah'] as int,
    global: json['global'] as int,
    juz: json['juz'] as int,
    page: json['page'] as int,
  );

  String get key => '$surah:$ayah';
}

/// Where a surah sits in the mushaf and how the source classifies it.
class SurahPlacement {
  const SurahPlacement({
    required this.number,
    required this.revelation,
    required this.revelationOrder,
    required this.ayahCount,
    required this.startPage,
    required this.endPage,
    required this.startJuz,
    required this.endJuz,
    required this.startHizb,
    required this.endHizb,
    required this.manzil,
    required this.rukuCount,
    required this.sajdahCount,
    required this.firstGlobalAyah,
  });

  final int number;
  final Revelation revelation;
  final int revelationOrder;
  final int ayahCount;
  final int startPage;
  final int endPage;
  final int startJuz;
  final int endJuz;
  final int startHizb;
  final int endHizb;
  final int manzil;
  final int rukuCount;
  final int sajdahCount;
  final int firstGlobalAyah;

  factory SurahPlacement.fromJson(Map<String, dynamic> json) => SurahPlacement(
    number: json['number'] as int,
    revelation: json['revelation_place'] == 'madinah'
        ? Revelation.medinan
        : Revelation.meccan,
    revelationOrder: json['revelation_order'] as int,
    ayahCount: json['ayah_count'] as int,
    startPage: json['start_page'] as int,
    endPage: json['end_page'] as int,
    startJuz: json['start_juz'] as int,
    endJuz: json['end_juz'] as int,
    startHizb: json['start_hizb'] as int,
    endHizb: json['end_hizb'] as int,
    manzil: json['manzil'] as int,
    rukuCount: json['ruku_count'] as int,
    sajdahCount: json['sajdah_count'] as int,
    firstGlobalAyah: json['first_global_ayah'] as int,
  );
}

/// Every classification of the mushaf the source datasets carry.
class QuranStructure {
  const QuranStructure({
    required this.surahs,
    required this.juzs,
    required this.hizbs,
    required this.rubs,
    required this.pages,
    required this.manzils,
    required this.rukus,
    required this.sajdahs,
  });

  final List<SurahPlacement> surahs;
  final List<MushafDivision> juzs;
  final List<MushafDivision> hizbs;
  final List<MushafDivision> rubs;
  final List<MushafDivision> pages;
  final List<MushafDivision> manzils;
  final List<MushafDivision> rukus;
  final List<SajdahPosition> sajdahs;

  factory QuranStructure.fromJson(Map<String, dynamic> json) {
    List<MushafDivision> divisions(String key) => (json[key] as List)
        .cast<Map<String, dynamic>>()
        .map(MushafDivision.fromJson)
        .toList(growable: false);
    return QuranStructure(
      surahs: (json['surahs'] as List)
          .cast<Map<String, dynamic>>()
          .map(SurahPlacement.fromJson)
          .toList(growable: false),
      juzs: divisions('juzs'),
      hizbs: divisions('hizbs'),
      rubs: divisions('rubs'),
      pages: divisions('pages'),
      manzils: divisions('manzils'),
      rukus: divisions('rukus'),
      sajdahs: (json['sajdahs'] as List)
          .cast<Map<String, dynamic>>()
          .map(SajdahPosition.fromJson)
          .toList(growable: false),
    );
  }

  SurahPlacement? placement(int surah) =>
      surahs.where((s) => s.number == surah).firstOrNull;
}
