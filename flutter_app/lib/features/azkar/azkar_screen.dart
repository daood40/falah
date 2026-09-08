// أذكار قرآنية — the Quranic portions commonly recited morning and evening,
// served EXCLUSIVELY from the verified bundled Quran text (SOURCE_LOCK).
// FALAH asserts no repeat-count rulings; each card has a free counter.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../l10n/app_localizations.dart';
import '../quran/domain/models.dart';

class AzkarItem {
  final String id;
  final int surah;
  final int from;
  final int to;
  const AzkarItem(this.id, this.surah, this.from, this.to);
}

// Same portions as the PWA's AzkarPage, verbatim.
const azkarItems = [
  AzkarItem('kursi', 2, 255, 255),
  AzkarItem('baqarah-end', 2, 285, 286),
  AzkarItem('ikhlas', 112, 1, 4),
  AzkarItem('falaq', 113, 1, 5),
  AzkarItem('nas', 114, 1, 6),
];

/// Verified texts for every azkar item, plus the surah names for the meta line.
final azkarTextsProvider = FutureProvider<Map<String, List<Ayah>>>((ref) async {
  final repo = ref.watch(quranRepositoryProvider);
  final entries = await Future.wait(
    azkarItems.map(
      (i) async =>
          MapEntry(i.id, await repo.getAyahRange(i.surah, i.from, i.to)),
    ),
  );
  return Map.fromEntries(entries);
});

class AzkarScreen extends ConsumerStatefulWidget {
  const AzkarScreen({super.key});

  @override
  ConsumerState<AzkarScreen> createState() => _AzkarScreenState();
}

class _AzkarScreenState extends ConsumerState<AzkarScreen> {
  final Map<String, int> _counts = {};

  String _title(AppLocalizations t, String id) => switch (id) {
    'kursi' => t.azkar_kursi,
    'baqarah-end' => t.azkar_baqarahEnd,
    'ikhlas' => t.azkar_ikhlas,
    'falaq' => t.azkar_falaq,
    _ => t.azkar_nas,
  };

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final textsAsync = ref.watch(azkarTextsProvider);
    final surahsAsync = ref.watch(surahListProvider);

    return Scaffold(
      appBar: AppBar(title: Text(t.azkar_title)),
      body: textsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(t.errors_unknown),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: () => ref.refresh(azkarTextsProvider),
                child: Text(t.common_retry),
              ),
            ],
          ),
        ),
        data: (texts) => ListView(
          padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 16, 24),
          children: [
            Text(
              t.azkar_subtitle,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 12),
            for (final item in azkarItems)
              _AzkarCard(
                title: _title(t, item.id),
                item: item,
                ayahs: texts[item.id] ?? const [],
                surahName: surahsAsync.asData?.value
                    .where((s) => s.number == item.surah)
                    .firstOrNull
                    ?.name,
                count: _counts[item.id] ?? 0,
                onCount: () {
                  HapticFeedback.lightImpact();
                  setState(
                    () => _counts[item.id] = (_counts[item.id] ?? 0) + 1,
                  );
                },
              ),
            const SizedBox(height: 8),
            Text(
              t.azkar_note,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _AzkarCard extends StatelessWidget {
  const _AzkarCard({
    required this.title,
    required this.item,
    required this.ayahs,
    required this.surahName,
    required this.count,
    required this.onCount,
  });

  final String title;
  final AzkarItem item;
  final List<Ayah> ayahs;
  final String? surahName;
  final int count;
  final VoidCallback onCount;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final scheme = Theme.of(context).colorScheme;
    final range = item.to > item.from
        ? '${item.from}-${item.to}'
        : '${item.from}';
    return Card(
      margin: const EdgeInsetsDirectional.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.goNamed(
          'surah',
          pathParameters: {'n': '${item.surah}'},
          extra: item.from,
        ),
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 14, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  Icon(
                    Icons.verified_outlined,
                    size: 16,
                    color: scheme.secondary,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    t.source_verified,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                ayahs.map((a) => '${a.text} ﴿${a.ayah}﴾').join(' '),
                textDirection: TextDirection.rtl,
                style: const TextStyle(
                  fontFamily: 'AmiriQuran',
                  fontSize: 20,
                  height: 2.1,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${surahName ?? item.surah} $range · '
                      '${ayahs.firstOrNull?.locked.source.sourceName ?? ''}',
                      style: Theme.of(context).textTheme.bodySmall,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  FilledButton.tonalIcon(
                    onPressed: onCount,
                    icon: const Icon(Icons.repeat, size: 16),
                    label: Text('$count', textDirection: TextDirection.ltr),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
