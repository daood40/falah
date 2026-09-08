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
