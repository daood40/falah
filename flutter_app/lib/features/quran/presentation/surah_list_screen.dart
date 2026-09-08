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

    return Scaffold(
      appBar: AppBar(title: Text(t.create_quran)),
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
                    data: (surahs) => ListView.builder(
                      itemCount: surahs.length,
                      itemBuilder: (context, i) {
                        final s = surahs[i];
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
                            '${t.create_ayahCount}: ${s.ayahCount}',
                          ),
                          onTap: () => context.goNamed(
                            'surah',
                            pathParameters: {'n': '${s.number}'},
                          ),
                        );
                      },
                    ),
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
