// Surah reader: verified ayahs with ﴿n﴾ numbering, optional translation.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../l10n/app_localizations.dart';

class SurahReaderScreen extends ConsumerStatefulWidget {
  const SurahReaderScreen({super.key, required this.surah, this.initialAyah});
  final int surah;
  final int? initialAyah;

  @override
  ConsumerState<SurahReaderScreen> createState() => _SurahReaderScreenState();
}

class _SurahReaderScreenState extends ConsumerState<SurahReaderScreen> {
  bool _showTranslation = false;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final ayahsAsync = ref.watch(surahAyahsProvider(widget.surah));
    final surahAsync = ref.watch(surahMetaProvider(widget.surah));

    return Scaffold(
      appBar: AppBar(
        title: Text(surahAsync.asData?.value?.name ?? t.create_surah),
        actions: [
          IconButton(
            tooltip: t.create_translation,
            icon: Icon(
              _showTranslation ? Icons.translate : Icons.translate_outlined,
            ),
            onPressed: () =>
                setState(() => _showTranslation = !_showTranslation),
          ),
        ],
      ),
      body: ayahsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(t.errors_unknown),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: () => ref.refresh(surahAyahsProvider(widget.surah)),
                child: Text(t.common_retry),
              ),
            ],
          ),
        ),
        data: (ayahs) {
          if (ayahs.isEmpty) {
            return Center(child: Text(t.common_noResults));
          }
          final initial = widget.initialAyah;
          final controller = ScrollController(
            initialScrollOffset: initial == null
                ? 0
                : (initial - 1).clamp(0, ayahs.length) * 120.0,
          );
          return ListView.builder(
            controller: controller,
            padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 16, 24),
            itemCount: ayahs.length + 1,
            itemBuilder: (context, i) {
              if (i == ayahs.length) {
                return Padding(
                  padding: const EdgeInsetsDirectional.only(top: 12),
                  child: Center(
                    child: Chip(
                      avatar: const Icon(Icons.verified_outlined, size: 16),
                      label: Text(
                        '${t.source_verified} · ${ayahs.first.locked.source.sourceName}',
                      ),
                    ),
                  ),
                );
              }
              final a = ayahs[i];
              return Card(
                key: ValueKey(a.key),
                margin: const EdgeInsetsDirectional.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsetsDirectional.fromSTEB(14, 10, 14, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        '${a.text} ﴿${a.ayah}﴾',
                        textDirection: TextDirection.rtl,
                        style: const TextStyle(
                          fontFamily: 'AmiriQuran',
                          fontSize: 22,
                          height: 2.1,
                        ),
                      ),
                      if (_showTranslation && a.translation != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          a.translation!,
                          textDirection: TextDirection.ltr,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: Theme.of(
                                  context,
                                ).colorScheme.onSurface.withValues(alpha: 0.7),
                              ),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
