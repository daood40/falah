// Surah list + unified search (name, reference like 2:255, normalized text).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../l10n/app_localizations.dart';
import '../domain/models.dart';

class SurahListScreen extends ConsumerStatefulWidget {
  const SurahListScreen({super.key});

  @override
  ConsumerState<SurahListScreen> createState() => _SurahListScreenState();
}

class _SurahListScreenState extends ConsumerState<SurahListScreen> {
  final _controller = TextEditingController();
  String _query = '';
  List<QuranSearchResult>? _results;
  bool _searching = false;

  /// Place-of-revelation filter (null = every surah) and the ordering.
  Revelation? _place;
  bool _byRevelation = false;

  /// Applies the filter and the ordering; the revelation order comes from the
  /// bundled structure and is only used once it has loaded.
  List<Surah> _arrange(List<Surah> surahs, QuranStructure? structure) {
    final filtered = _place == null
        ? surahs
        : surahs.where((s) => s.revelation == _place).toList(growable: false);
    if (!_byRevelation || structure == null) return filtered;
    final order = {
      for (final p in structure.surahs) p.number: p.revelationOrder,
    };
    final sorted = [...filtered]
      ..sort((a, b) => (order[a.number] ?? 0).compareTo(order[b.number] ?? 0));
    return sorted;
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onQuery(String text) async {
    setState(() => _query = text);
    if (text.trim().isEmpty) {
      setState(() {
        _results = null;
        _searching = false;
      });
      return;
    }
    setState(() => _searching = true);
    final results = await ref.read(quranRepositoryProvider).search(text);
    if (!mounted || _query != text) return;
    setState(() {
      _results = results;
      _searching = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final surahsAsync = ref.watch(surahListProvider);
    final structure = ref.watch(quranStructureProvider).value;

    return Scaffold(
      appBar: AppBar(
        title: Text(t.create_quran),
        actions: [
          IconButton(
            tooltip: t.mushaf_browse,
            icon: const Icon(Icons.view_list_outlined),
            onPressed: () => context.goNamed('mushafBrowse'),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(16, 8, 16, 8),
            child: TextField(
              controller: _controller,
              onChanged: _onQuery,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: t.create_searchQuran,
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                isDense: true,
              ),
            ),
          ),
          if (_results == null && !_searching)
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsetsDirectional.fromSTEB(16, 0, 16, 4),
              child: Row(
                children: [
                  ChoiceChip(
                    label: Text(t.surah_filterAll),
                    selected: _place == null,
                    onSelected: (_) => setState(() => _place = null),
                  ),
                  const SizedBox(width: 6),
                  ChoiceChip(
                    label: Text(t.surah_filterMakki),
                    selected: _place == Revelation.meccan,
                    onSelected: (_) =>
                        setState(() => _place = Revelation.meccan),
                  ),
                  const SizedBox(width: 6),
                  ChoiceChip(
                    label: Text(t.surah_filterMadani),
                    selected: _place == Revelation.medinan,
                    onSelected: (_) =>
                        setState(() => _place = Revelation.medinan),
                  ),
                  const SizedBox(width: 14),
                  FilterChip(
                    avatar: const Icon(Icons.history_outlined, size: 16),
                    label: Text(
                      _byRevelation
                          ? t.surah_sortRevelation
                          : t.surah_sortMushaf,
                    ),
                    selected: _byRevelation,
                    onSelected: (v) => setState(() => _byRevelation = v),
                  ),
                ],
              ),
            ),
          Expanded(
            child: _results != null || _searching
                ? _SearchResults(
                    searching: _searching,
                    results: _results ?? const [],
                  )
                : surahsAsync.when(
                    loading: () =>
                        const Center(child: CircularProgressIndicator()),
                    error: (e, _) => _ErrorRetry(
                      onRetry: () => ref.refresh(surahListProvider),
                    ),
                    data: (all) {
                      final surahs = _arrange(all, structure);
                      if (surahs.isEmpty) {
                        return Center(child: Text(t.common_noResults));
                      }
                      return ListView.builder(
                      itemCount: surahs.length,
                      itemBuilder: (context, i) {
                        final s = surahs[i];
                        final p = structure?.placement(s.number);
                        final place = s.revelation == Revelation.meccan
                            ? t.surah_filterMakki
                            : t.surah_filterMadani;
                        return ListTile(
                          key: ValueKey(s.number),
                          leading: CircleAvatar(
                            radius: 18,
                            child: Text(
                              '${s.number}',
                              style: const TextStyle(fontSize: 13),
                            ),
                          ),
                          title: Text(s.name),
                          subtitle: Text(
                            p == null
                                ? '${t.create_ayahCount}: ${s.ayahCount}'
                                : '${t.create_ayahCount}: ${s.ayahCount} · '
                                      '${t.surah_meta(place, p.revelationOrder, p.startPage, p.startJuz)}',
                          ),
                          onTap: () => context.goNamed(
                            'surah',
                            pathParameters: {'n': '${s.number}'},
                          ),
                        );
                      },
                    );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _SearchResults extends StatelessWidget {
  const _SearchResults({required this.searching, required this.results});
  final bool searching;
  final List<QuranSearchResult> results;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (searching) return const Center(child: CircularProgressIndicator());
    if (results.isEmpty) {
      return Center(child: Text(t.common_noResults));
    }
    return ListView.builder(
      itemCount: results.length,
      itemBuilder: (context, i) {
        final r = results[i];
        return Card(
          key: ValueKey(r.ayah.key),
          margin: const EdgeInsetsDirectional.fromSTEB(16, 6, 16, 6),
          child: ListTile(
            title: Text(
              r.ayah.text,
              style: const TextStyle(
                fontFamily: 'AmiriQuran',
                fontSize: 20,
                height: 2,
              ),
              textDirection: TextDirection.rtl,
            ),
            subtitle: Text(
              '${r.surahName} ${r.ayah.ayah} · ${t.source_verified}',
            ),
            onTap: () => context.goNamed(
              'surah',
              pathParameters: {'n': '${r.ayah.surah}'},
              extra: r.ayah.ayah,
            ),
          ),
        );
      },
    );
  }
}

class _ErrorRetry extends StatelessWidget {
  const _ErrorRetry({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(t.errors_unknown),
          const SizedBox(height: 8),
          FilledButton(onPressed: onRetry, child: Text(t.common_retry)),
        ],
      ),
    );
  }
}
