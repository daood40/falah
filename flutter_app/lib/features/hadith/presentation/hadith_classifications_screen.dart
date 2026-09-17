/// Every way this edition is organised, in one place.
///
/// The hub lists the classifications the service publishes — books, chapters,
/// volumes, cited collections, gradings, narrators, editions and sources,
/// dataset versions, the cross-check evidence and the corpus in numbers — each
/// with its real count, read from the API.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/tokens.dart';
import '../../../l10n/app_localizations.dart';
import '../data/hadith_providers.dart';
import 'hadith_states.dart';

class HadithClassificationsScreen extends ConsumerWidget {
  const HadithClassificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    final stats = ref.watch(hadithStatsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(t.hadith_classificationsTitle)),
      body: hadithAsync(
        stats,
        onRetry: () => ref.invalidate(hadithStatsProvider),
        data: (s) => ListView(
          padding: const EdgeInsetsDirectional.all(FlSpace.s4),
          children: [
            _Tile(
              icon: Icons.menu_book_outlined,
              title: t.hadith_booksTitle,
              count: s.books,
              onTap: () => context.pushNamed('hadithBooks'),
            ),
            _Tile(
              icon: Icons.account_tree_outlined,
              title: t.hadith_chaptersTitle,
              count: s.chapters,
              onTap: () => context.pushNamed('hadithCatalog'),
            ),
            _Tile(
              icon: Icons.library_books_outlined,
              title: t.hadith_volumesTitle,
              count: null,
              onTap: () => context.pushNamed('hadithVolumes'),
            ),
            _Tile(
              icon: Icons.format_quote_outlined,
              title: t.hadith_collectionsTitle,
              count: s.references,
              onTap: () => context.pushNamed('hadithCollections'),
            ),
            _Tile(
              icon: Icons.verified_outlined,
              title: t.hadith_gradingsTitle,
              count: s.gradings,
              onTap: () => context.pushNamed('hadithGradings'),
            ),
            _Tile(
              icon: Icons.people_outline,
              title: t.hadith_narratorsTitle,
              count: s.narrators,
              onTap: () => context.pushNamed('hadithNarrators'),
            ),
            _Tile(
              icon: Icons.source_outlined,
              title: t.hadith_editionsTitle,
              count: s.editions,
              onTap: () => context.pushNamed('hadithEditions'),
            ),
            _Tile(
              icon: Icons.fact_check_outlined,
              title: t.hadith_crossCheckTitle,
              count: null,
              onTap: () => context.pushNamed('hadithCrossCheck'),
            ),
            _Tile(
              icon: Icons.insights_outlined,
              title: t.hadith_statsTitle,
              count: s.hadiths,
              onTap: () => context.pushNamed('hadithStats'),
            ),
            _Tile(
              icon: Icons.list_alt_outlined,
              title: t.hadith_allHadiths,
              count: s.hadiths,
              onTap: () => context.pushNamed('hadithAll'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.icon, required this.title, required this.count, required this.onTap});

  final IconData icon;
  final String title;
  final int? count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Card(
      margin: const EdgeInsetsDirectional.only(bottom: FlSpace.s2),
      child: ListTile(
        leading: Icon(icon),
        title: Text(title),
        subtitle: count == null ? null : Text(t.hadith_countLabel(count!)),
        trailing: const Icon(Icons.chevron_left),
        onTap: onTap,
      ),
    );
  }
}
