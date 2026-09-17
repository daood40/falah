/// The classification screens: volumes, cited collections, gradings,
/// narrators, editions and sources, dataset versions, the tree catalogue,
/// the corpus statistics and the cross-check evidence.
///
/// They all read counts and labels only — no hadith text passes through here,
/// so they stay readable whatever the content licence says.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/tokens.dart';
import '../../../l10n/app_localizations.dart';
import '../data/hadith_providers.dart';
import 'hadith_states.dart';

// ---------------- volumes ----------------

class HadithVolumesScreen extends ConsumerWidget {
  const HadithVolumesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(t.hadith_volumesTitle)),
      body: hadithAsync(
        ref.watch(hadithVolumesProvider),
        onRetry: () => ref.invalidate(hadithVolumesProvider),
        data: (volumes) => volumes.isEmpty
            ? const HadithEmpty()
            : ListView.separated(
                padding: const EdgeInsetsDirectional.all(FlSpace.s4),
                itemCount: volumes.length,
                separatorBuilder: (_, __) => const SizedBox(height: FlSpace.s2),
                itemBuilder: (context, i) {
                  final v = volumes[i];
                  return Card(
                    child: ListTile(
                      title: Text(t.hadith_volumeLabel(v.volume)),
                      subtitle: Text(
                        '${t.hadith_countLabel(v.hadithCount)} · '
                        '${t.hadith_pageRange(v.lastPage ?? 0, v.firstPage ?? 0)}',
                      ),
                      trailing: const Icon(Icons.chevron_left),
                      onTap: () => context.pushNamed(
                        'hadithVolumeList',
                        pathParameters: {'volume': '${v.volume}'},
                        extra: t.hadith_volumeLabel(v.volume),
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

// ---------------- cited collections (takhrij) ----------------

class HadithCollectionsScreen extends ConsumerWidget {
  const HadithCollectionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(t.hadith_collectionsTitle)),
      body: hadithAsync(
        ref.watch(hadithCollectionsProvider),
        onRetry: () => ref.invalidate(hadithCollectionsProvider),
        data: (items) => items.isEmpty
            ? const HadithEmpty()
            : ListView.separated(
                padding: const EdgeInsetsDirectional.all(FlSpace.s4),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: FlSpace.s2),
                itemBuilder: (context, i) {
                  final c = items[i];
                  return Card(
                    child: ListTile(
                      title: Text(c.name),
                      subtitle: Text([
                        t.hadith_countLabel(c.hadithCount),
                        if (c.corroboratedCount != null)
                          t.hadith_corroboratedLabel(c.corroboratedCount!),
                      ].join(' · ')),
                      trailing: const Icon(Icons.chevron_left),
                      onTap: () => context.pushNamed(
                        'hadithCollectionList',
                        pathParameters: {'name': c.name},
                        extra: c.name,
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

// ---------------- gradings ----------------

class HadithGradingsScreen extends ConsumerWidget {
  const HadithGradingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(t.hadith_gradingsTitle)),
      body: hadithAsync(
        ref.watch(hadithGradingLabelsProvider),
        onRetry: () => ref.invalidate(hadithGradingLabelsProvider),
        data: (items) => items.isEmpty
            ? const HadithEmpty()
            : ListView.separated(
                padding: const EdgeInsetsDirectional.all(FlSpace.s4),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: FlSpace.s2),
                itemBuilder: (context, i) {
                  final g = items[i];
                  return Card(
                    child: ListTile(
                      title: Text(g.text),
                      // the grader is the author of the edition, reported as the
                      // API gives it — the app never grades anything itself
                      subtitle: Text([
                        if (g.hadithCount != null) t.hadith_countLabel(g.hadithCount!),
                        if (g.source != null) '${t.hadith_graderLabel}: ${g.source}',
                      ].join(' · ')),
                      trailing: const Icon(Icons.chevron_left),
                      onTap: () => context.pushNamed(
                        'hadithGradingList',
                        pathParameters: {'grading': g.text},
                        extra: g.text,
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

// ---------------- narrators ----------------

class HadithNarratorsScreen extends ConsumerStatefulWidget {
  const HadithNarratorsScreen({super.key});

  @override
  ConsumerState<HadithNarratorsScreen> createState() => _HadithNarratorsScreenState();
}

class _HadithNarratorsScreenState extends ConsumerState<HadithNarratorsScreen> {
  final _controller = TextEditingController();
  NarratorQuery _query = const NarratorQuery();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final narrators = ref.watch(hadithNarratorsProvider(_query));

    return Scaffold(
      appBar: AppBar(title: Text(t.hadith_narratorsTitle)),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.all(FlSpace.s4),
            child: TextField(
              controller: _controller,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: t.hadith_narratorSearchHint,
                prefixIcon: const Icon(Icons.search),
              ),
              onSubmitted: (value) =>
                  setState(() => _query = NarratorQuery(name: value.trim())),
            ),
          ),
          Expanded(
            child: hadithAsync(
              narrators,
              onRetry: () => ref.invalidate(hadithNarratorsProvider(_query)),
              data: (page) => page.items.isEmpty
                  ? HadithEmpty(message: t.hadith_noResults)
                  : ListView.separated(
                      padding: const EdgeInsetsDirectional.all(FlSpace.s4),
                      itemCount: page.items.length + 1,
                      separatorBuilder: (_, __) => const SizedBox(height: FlSpace.s2),
                      itemBuilder: (context, i) {
                        if (i == page.items.length) {
                          return _Pager(
                            page: page.page,
                            totalPages: page.totalPages ?? 1,
                            total: page.total,
                            onPage: (p) => setState(
                              () => _query = NarratorQuery(page: p, name: _query.name),
                            ),
                          );
                        }
                        final n = page.items[i];
                        return Card(
                          child: ListTile(
                            title: Text(n.name),
                            subtitle: (n.kunya ?? n.laqab) == null
                                ? null
                                : Text([n.kunya, n.laqab].whereType<String>().join(' · ')),
                            trailing: const Icon(Icons.chevron_left),
                            onTap: () => context.pushNamed(
                              'hadithNarratorList',
                              pathParameters: {'narratorId': n.id},
                              extra: n.name,
                            ),
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

class _Pager extends StatelessWidget {
  const _Pager({
    required this.page,
    required this.totalPages,
    required this.total,
    required this.onPage,
  });

  final int page;
  final int totalPages;
  final int total;
  final void Function(int page) onPage;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsetsDirectional.symmetric(vertical: FlSpace.s4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton(
            onPressed: page > 1 ? () => onPage(page - 1) : null,
            icon: const Icon(Icons.chevron_right),
          ),
          Text(t.hadith_pageOf(page, totalPages, total)),
          IconButton(
            onPressed: page < totalPages ? () => onPage(page + 1) : null,
            icon: const Icon(Icons.chevron_left),
          ),
        ],
      ),
    );
  }
}

// ---------------- editions, sources and datasets ----------------

class HadithEditionsScreen extends ConsumerWidget {
  const HadithEditionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    final editions = ref.watch(hadithEditionsProvider);
    final sources = ref.watch(hadithSourcesProvider);
    final datasets = ref.watch(hadithDatasetsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(t.hadith_editionsTitle)),
      body: hadithAsync(
        editions,
        onRetry: () => ref.invalidate(hadithEditionsProvider),
        data: (items) => ListView(
          padding: const EdgeInsetsDirectional.all(FlSpace.s4),
          children: [
            for (final e in items)
              Card(
                child: Padding(
                  padding: const EdgeInsetsDirectional.all(FlSpace.s4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(e.title, style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: FlSpace.s2),
                      _Row(label: t.hadith_authorLabel, value: e.author),
                      _Row(label: t.hadith_publisherLabel, value: e.publisher),
                      _Row(
                        label: t.hadith_printingLabel,
                        value: [
                          if (e.editionNumber != null) '${e.editionNumber}',
                          if (e.publicationYear != null) '${e.publicationYear}',
                        ].join(' — '),
                      ),
                      _Row(label: t.hadith_volumeCountLabel, value: '${e.volumeCount ?? '—'}'),
                      _Row(label: t.hadith_countLabel(e.hadithCount ?? 0), value: ''),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: FlSpace.s4),
            Text(t.hadith_sourcesTitle, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: FlSpace.s2),
            sources.when(
              loading: () => const LinearProgressIndicator(),
              error: (_, __) => const SizedBox.shrink(),
              data: (list) => Column(
                children: [
                  for (final s in list)
                    Card(
                      child: ListTile(
                        title: Text(s.name),
                        subtitle: Text('${t.hadith_licenceLabel}: ${s.licenseStatus}'),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: FlSpace.s4),
            Text(t.hadith_datasetsTitle, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: FlSpace.s2),
            datasets.when(
              loading: () => const LinearProgressIndicator(),
              error: (_, __) => const SizedBox.shrink(),
              data: (list) => Column(
                children: [
                  for (final d in list)
                    Card(
                      child: ListTile(
                        title: Text(d.version),
                        subtitle: Text([
                          d.status,
                          if (d.recordCount != null) t.hadith_countLabel(d.recordCount!),
                          if (d.datasetHash != null)
                            t.hadith_hashLabel(d.datasetHash!.substring(0, 12)),
                        ].join(' · ')),
                        trailing: d.isActive == true ? const Icon(Icons.check_circle_outline) : null,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    if (value == null || value!.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: FlSpace.s1),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 110, child: Text(label, style: Theme.of(context).textTheme.bodySmall)),
          Expanded(child: Text(value!)),
        ],
      ),
    );
  }
}

// ---------------- the tree catalogue ----------------

class HadithCatalogScreen extends ConsumerWidget {
  const HadithCatalogScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(t.hadith_catalogTitle)),
      body: hadithAsync(
        ref.watch(hadithCatalogProvider),
        onRetry: () => ref.invalidate(hadithCatalogProvider),
        data: (books) => ListView(
          padding: const EdgeInsetsDirectional.all(FlSpace.s4),
          children: [
            for (final book in books)
              ExpansionTile(
                title: Text(book.name),
                subtitle: Text(t.hadith_countLabel(book.hadithCount)),
                children: [
                  for (final c in book.chapters)
                    ListTile(
                      title: Text(c.title),
                      subtitle: Text(t.hadith_countLabel(c.hadithCount)),
                      onTap: () => context.pushNamed(
                        'hadithChapterList',
                        pathParameters: {'chapterId': c.id},
                        extra: c.title,
                      ),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

// ---------------- statistics ----------------

class HadithStatsScreen extends ConsumerWidget {
  const HadithStatsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(t.hadith_statsTitle)),
      body: hadithAsync(
        ref.watch(hadithStatsProvider),
        onRetry: () => ref.invalidate(hadithStatsProvider),
        data: (s) => ListView(
          padding: const EdgeInsetsDirectional.all(FlSpace.s4),
          children: [
            _StatTile(label: t.hadith_title, value: s.hadiths),
            _StatTile(label: t.hadith_booksTitle, value: s.books),
            _StatTile(label: t.hadith_chaptersTitle, value: s.chapters),
            _StatTile(label: t.hadith_narratorsTitle, value: s.narrators),
            _StatTile(label: t.hadith_takhrijLabel, value: s.references),
            _StatTile(label: t.hadith_gradingsTitle, value: s.gradings),
            _StatTile(label: t.hadith_editionsTitle, value: s.editions),
            const Divider(),
            _StatTile(label: t.hadith_verified, value: s.verifiedHadiths),
            _StatTile(label: t.hadith_unverified, value: s.pendingHadiths),
            _StatTile(label: t.hadith_needsReview, value: s.needsReviewHadiths),
          ],
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsetsDirectional.only(bottom: FlSpace.s2),
        child: ListTile(
          title: Text(label),
          trailing: Text('$value', style: Theme.of(context).textTheme.titleMedium),
        ),
      );
}

// ---------------- cross-check evidence ----------------

class HadithCrossCheckScreen extends ConsumerWidget {
  const HadithCrossCheckScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    final summary = ref.watch(crossCheckSummaryProvider);
    final queue = ref.watch(reviewQueueProvider(1));

    return Scaffold(
      appBar: AppBar(title: Text(t.hadith_crossCheckTitle)),
      body: hadithAsync(
        summary,
        onRetry: () => ref.invalidate(crossCheckSummaryProvider),
        data: (rows) => ListView(
          padding: const EdgeInsetsDirectional.all(FlSpace.s4),
          children: [
            Text(t.hadith_crossCheckNote, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: FlSpace.s3),
            for (final r in rows)
              Card(
                child: Padding(
                  padding: const EdgeInsetsDirectional.all(FlSpace.s4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(r.referenceName, style: Theme.of(context).textTheme.titleSmall),
                      const SizedBox(height: FlSpace.s2),
                      _Row(label: t.hadith_checkedLabel, value: '${r.checked}'),
                      _Row(label: t.hadith_corroboratedOnly, value: '${r.corroborated}'),
                      _Row(label: t.hadith_partialLabel, value: '${r.partial}'),
                      _Row(label: t.hadith_notFoundLabel, value: '${r.notFound}'),
                      if (r.takhrijAgrees != null)
                        _Row(label: t.hadith_takhrijAgreesLabel, value: '${r.takhrijAgrees}'),
                      if (r.meanSimilarity != null)
                        _Row(label: t.hadith_similarityLabel, value: r.meanSimilarity),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: FlSpace.s4),
            Text(t.hadith_reviewQueueTitle, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: FlSpace.s2),
            queue.when(
              loading: () => const LinearProgressIndicator(),
              error: (e, __) => Text(hadithErrorMessage(context, e)),
              data: (page) => Column(
                children: [
                  Text(
                    t.hadith_pageStatus(page.items.length, page.total),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  for (final item in page.items)
                    Card(
                      child: ListTile(
                        title: Text(item.sourceLocator ?? item.hadithId),
                        subtitle: Text([
                          if (item.book != null) item.book!,
                          if (item.grading != null) item.grading!,
                          '${t.hadith_similarityLabel}: ${item.similarity ?? '—'}',
                          if (item.takhrijCollections.isNotEmpty)
                            item.takhrijCollections.join('، '),
                        ].join(' · ')),
                        trailing: const Icon(Icons.chevron_left),
                        onTap: () => context.pushNamed(
                          'hadithDetail',
                          pathParameters: {'id': item.hadithId},
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
