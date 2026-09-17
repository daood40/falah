// Quran repository against the real bundled dataset — mirrors the PWA suite.
import 'package:falah/core/arabic/arabic.dart';
import 'package:falah/features/quran/data/quran_repository.dart';
import 'package:falah/features/quran/domain/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final repo = QuranRepository();

  group('arabic utilities', () {
    test('strips diacritics and unifies letter forms', () {
      expect(
        normalizeArabic('بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ'),
        'بسم الله الرحمن الرحيم',
      );
    });

    test('parses references incl. Arabic-Indic digits', () {
      expect(parseAyahReference('2:255')?.surah, 2);
      expect(parseAyahReference('٢:٢٥٥')?.ayah, 255);
      expect(parseAyahReference('1 7')?.ayah, 7);
      expect(parseAyahReference('115:1'), isNull);
      expect(parseAyahReference('الرحمن'), isNull);
    });
  });

  group('quran repository (bundled dataset)', () {
    test('lists all 114 surahs with correct metadata', () async {
      final surahs = await repo.listSurahs();
      expect(surahs, hasLength(114));
      expect(surahs.first.name, 'الفاتحة');
      expect(surahs.first.ayahCount, 7);
      expect((await repo.surahByNumber(112))?.name, 'الإخلاص');
    });

    test('loads Al-Fatiha as verified locked text', () async {
      final ayahs = await repo.getSurahAyahs(1);
      expect(ayahs, hasLength(7));
      expect(ayahs.first.text, contains('بِسۡمِ'));
      expect(ayahs.first.locked.source.sourceId, 'tanzil-uthmani');
      expect(ayahs.first.locked.checksum, hasLength(64));
      expect(ayahs.first.translation, isNotEmpty);
    });

    test('resolves a direct reference search (Ayat al-Kursi)', () async {
      final results = await repo.search('2:255');
      expect(results, hasLength(1));
      expect(results.first.ayah.surah, 2);
      expect(results.first.ayah.ayah, 255);
      expect(
        normalizeArabic(results.first.ayah.text),
        contains('الله لا اله الا هو الحي القيوم'),
      );
    });

    test('finds ayahs by normalized Arabic text', () async {
      final results = await repo.search('قل هو الله أحد');
      expect(results, isNotEmpty);
      expect(results.first.ayah.surah, 112);
    });

    test('returns verified inclusive ayah ranges (azkar portions)', () async {
      expect(await repo.getAyahRange(2, 255, 255), hasLength(1));
      final baqarahEnd = await repo.getAyahRange(2, 285, 286);
      expect(baqarahEnd.map((a) => a.ayah), [285, 286]);
      expect(await repo.getAyahRange(112, 1, 4), hasLength(4));
      expect(baqarahEnd.first.locked.source.reviewStatus.name, 'verified');
    });

    test('bundles every classification of the mushaf', () async {
      final structure = await repo.loadStructure();
      expect(structure.surahs, hasLength(114));
      expect(structure.juzs, hasLength(30));
      expect(structure.hizbs, hasLength(60));
      expect(structure.rubs, hasLength(240));
      expect(structure.pages, hasLength(604));
      expect(structure.manzils, hasLength(7));
      expect(structure.rukus, hasLength(556));
      expect(structure.sajdahs, hasLength(15));

      // Boundaries cover 1..6236 with no gap and no overlap.
      for (final list in [
        structure.juzs,
        structure.hizbs,
        structure.rubs,
        structure.pages,
        structure.manzils,
        structure.rukus,
      ]) {
        expect(list.first.start.global, 1);
        expect(list.last.end.global, 6236);
        for (var i = 1; i < list.length; i++) {
          expect(list[i].start.global, list[i - 1].end.global + 1);
        }
      }

      final baqarah = structure.placement(2)!;
      expect(baqarah.revelation, Revelation.medinan);
      expect(baqarah.revelationOrder, 87);
      expect(baqarah.startPage, 2);
      expect(baqarah.endPage, 49);
      expect(baqarah.rukuCount, 40);
      expect(structure.placement(96)!.revelationOrder, 1);
      expect(structure.rukus[1].surah, 2);
      expect(structure.rubs[4].hizb, 2);
      expect(structure.sajdahs.first.key, '7:206');

      // The structure agrees with the surah index it ships beside.
      final surahs = await repo.listSurahs();
      for (final s in surahs) {
        final p = structure.placement(s.number)!;
        expect(p.ayahCount, s.ayahCount);
        expect(p.revelation, s.revelation);
      }
    });

    test('verse of the day is deterministic for a given date', () async {
      final date = DateTime.utc(2026, 9, 5);
      final a = await repo.verseOfDay(date);
      final b = await repo.verseOfDay(date);
      expect(a.ayah.key, b.ayah.key);
      expect(a.ayah.locked.source.reviewStatus.name, 'verified');
    });
  });
}
