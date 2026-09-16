// FALAH Quran API — Flutter usage.
//
// The real client already lives in the app:
//   flutter_app/lib/features/quran_api/
// This file shows how a screen consumes it. Build with:
//   flutter run --dart-define-from-file=config/production.json
import 'package:falah/features/quran_api/domain/models.dart';
import 'package:falah/features/quran_api/providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class SurahListScreen extends ConsumerWidget {
  const SurahListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // The API is used only when QURAN_API_BASE_URL was provided at build time.
    if (!ref.watch(quranApiEnabledProvider)) {
      return const Center(child: Text('يعمل بالبيانات المدمجة دون إنترنت'));
    }

    final surahs = ref.watch(apiSurahListProvider);
    return surahs.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(child: Text('تعذّر التحميل: $error')),
      data: (items) => items.isEmpty
          ? const Center(child: Text('لا توجد سور'))
          : ListView.builder(
              itemCount: items.length,
              itemBuilder: (context, index) {
                final QuranSurah surah = items[index];
                return ListTile(
                  leading: Text('${surah.number}'),
                  title: Text(surah.nameAr),
                  subtitle: Text('${surah.ayahCount} آية'),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => SurahReader(surah: surah)),
                  ),
                );
              },
            ),
    );
  }
}

class SurahReader extends ConsumerWidget {
  const SurahReader({required this.surah, super.key});

  final QuranSurah surah;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ayahs = ref.watch(apiSurahAyahsProvider(surah.number));
    return Scaffold(
      appBar: AppBar(title: Text(surah.nameAr)),
      body: ayahs.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('تعذّر التحميل: $error')),
        data: (items) => ListView.builder(
          itemCount: items.length,
          itemBuilder: (context, index) {
            final QuranAyah ayah = items[index];
            // `ayah.text` is the source text verbatim — never transform it.
            return ListTile(
              title: Text(ayah.text, textDirection: TextDirection.rtl),
              subtitle: Text('${ayah.ayahKey} · ${ayah.verificationStatus}'),
            );
          },
        ),
      ),
    );
  }
}

// Search, reciters and audio use the same providers:
//   final hits   = await ref.read(quranApiRepositoryProvider).search('الحمد لله');
//   final people = await ref.read(reciterRepositoryProvider).getReciters();
//   final files  = await ref.read(audioRepositoryProvider).getAyahAudio(ayah.id);
