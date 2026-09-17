// Mushaf browser: every classification the source carries — juz, hizb, rub,
// page, manzil, ruku and sajdah — each a list of boundaries that opens the
// reader at the right ayah. Structure only; the text itself stays locked in
// the reader.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../l10n/app_localizations.dart';
import '../domain/models.dart';

enum MushafKind { juz, hizb, rub, page, manzil, ruku, sajdah }

class MushafBrowserScreen extends ConsumerWidget {
  const MushafBrowserScreen({super.key, this.initialKind = MushafKind.juz});

  final MushafKind initialKind;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    final structureAsync = ref.watch(quranStructureProvider);

    return DefaultTabController(
      length: MushafKind.values.length,
      initialIndex: initialKind.index,
      child: Scaffold(
        appBar: AppBar(
          title: Text(t.mushaf_browse),
          bottom: TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [
              Tab(text: t.mushaf_juzs),
              Tab(text: t.mushaf_hizbs),
              Tab(text: t.mushaf_rubs),
              Tab(text: t.mushaf_pages),
              Tab(text: t.mushaf_manzils),
              Tab(text: t.mushaf_rukus),
              Tab(text: t.mushaf_sajdahs),
            ],
          ),
        ),
        body: structureAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(t.errors_unknown),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: () => ref.refresh(quranStructureProvider),
                  child: Text(t.common_retry),
                ),
              ],
            ),
          ),
          data: (structure) => TabBarView(
            children: [
              _DivisionList(
                kind: MushafKind.juz,
                items: structure.juzs,
              ),
              _DivisionList(
                kind: MushafKind.hizb,
                items: structure.hizbs,
              ),
              _DivisionList(
                kind: MushafKind.rub,
                items: structure.rubs,
              ),
              _DivisionList(
                kind: MushafKind.page,
                items: structure.pages,
              ),
              _DivisionList(
                kind: MushafKind.manzil,
                items: structure.manzils,
              ),
              _DivisionList(
                kind: MushafKind.ruku,
                items: structure.rukus,
              ),
              _SajdahList(items: structure.sajdahs),
            ],
          ),
        ),
      ),
    );
  }
}

/// Opens the reader on the ayah a boundary starts at.
void _openAt(BuildContext context, int surah, int ayah) {
  context.goNamed(
    'surah',
    pathParameters: {'n': '$surah'},
    extra: ayah,
  );
}

String _surahName(List<Surah> surahs, int number) =>
    surahs.where((s) => s.number == number).firstOrNull?.name ?? '$number';

class _DivisionList extends ConsumerWidget {
  const _DivisionList({required this.kind, required this.items});

  final MushafKind kind;
  final List<MushafDivision> items;

  String _title(AppLocalizations t, MushafDivision d) => switch (kind) {
    MushafKind.juz => t.mushaf_juzN(d.number),
    MushafKind.hizb => t.mushaf_hizbN(d.number),
    MushafKind.rub => t.mushaf_rubN(d.quarter ?? 0, d.hizb ?? 0),
    MushafKind.page => t.mushaf_pageN(d.number),
    MushafKind.manzil => t.mushaf_manzilN(d.number),
    MushafKind.ruku => t.mushaf_rukuN(d.number),
    MushafKind.sajdah => '',
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    final surahs = ref.watch(surahListProvider).value ?? const <Surah>[];
    if (items.isEmpty) {
      return Center(child: Text(t.common_noResults));
    }
    return ListView.builder(
      padding: const EdgeInsetsDirectional.fromSTEB(16, 8, 16, 24),
      itemCount: items.length,
      itemBuilder: (context, i) {
        final d = items[i];
        final startName = _surahName(surahs, d.start.surah);
        final endName = _surahName(surahs, d.end.surah);
        return ListTile(
          key: ValueKey('${kind.name}-${d.number}'),
          leading: CircleAvatar(
            radius: 18,
            child: Text('${d.number}', style: const TextStyle(fontSize: 13)),
          ),
          title: Text(_title(t, d)),
          subtitle: Text(
            t.mushaf_range(
              startName,
              d.start.ayah,
              endName,
              d.end.ayah,
              d.ayahCount,
            ),
          ),
          trailing: const Icon(Icons.chevron_left),
          onTap: () => _openAt(context, d.start.surah, d.start.ayah),
        );
      },
    );
  }
}

class _SajdahList extends ConsumerWidget {
  const _SajdahList({required this.items});

  final List<SajdahPosition> items;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    final surahs = ref.watch(surahListProvider).value ?? const <Surah>[];
    if (items.isEmpty) {
      return Center(child: Text(t.common_noResults));
    }
    return ListView.builder(
      padding: const EdgeInsetsDirectional.fromSTEB(16, 8, 16, 24),
      itemCount: items.length,
      itemBuilder: (context, i) {
        final s = items[i];
        final name =
            surahs.where((x) => x.number == s.surah).firstOrNull?.name ??
            '${s.surah}';
        return ListTile(
          key: ValueKey('sajdah-${s.key}'),
          leading: CircleAvatar(
            radius: 18,
            child: Text('${i + 1}', style: const TextStyle(fontSize: 13)),
          ),
          title: Text(t.mushaf_sajdahAt(name, s.ayah)),
          subtitle: Text(
            '${t.mushaf_juzN(s.juz)} · ${t.mushaf_pageN(s.page)}',
          ),
          trailing: const Icon(Icons.chevron_left),
          onTap: () => _openAt(context, s.surah, s.ayah),
        );
      },
    );
  }
}
