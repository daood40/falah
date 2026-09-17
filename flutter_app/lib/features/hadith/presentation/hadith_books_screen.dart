/// Books of the collection, served by the FALAH Hadith API.
///
/// Every visible string comes from the localization file, every layout uses
/// EdgeInsetsDirectional, and the screen implements the four required states:
/// loading, empty, error, data.
library;

import 'package:falah_hadith_api/falah_hadith_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/tokens.dart';
import '../../../l10n/app_localizations.dart';
import '../data/hadith_providers.dart';
import 'hadith_states.dart';

class HadithBooksScreen extends ConsumerWidget {
  const HadithBooksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    final books = ref.watch(hadithBooksProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(t.hadith_booksTitle),
        actions: [
          IconButton(
            tooltip: t.hadith_searchTitle,
            icon: const Icon(Icons.search),
            onPressed: () => context.pushNamed('hadithSearch'),
          ),
        ],
      ),
      body: Column(
        children: [
          const _DatasetBanner(),
          Expanded(
            child: hadithAsync(
              books,
              onRetry: () => ref.invalidate(hadithBooksProvider),
              data: (items) => items.isEmpty
                  ? const HadithEmpty()
                  : RefreshIndicator(
                      onRefresh: () async => ref.invalidate(hadithBooksProvider),
                      child: ListView.separated(
                        padding: const EdgeInsetsDirectional.all(FlSpace.s4),
                        itemCount: items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: FlSpace.s2),
                        itemBuilder: (context, i) => _BookTile(book: items[i]),
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Which dataset the app is reading, and whether the text is published yet.
/// A reader should never wonder why a hadith shows no text.
class _DatasetBanner extends ConsumerWidget {
  const _DatasetBanner();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    final version = ref.watch(apiVersionProvider);
    return version.maybeWhen(
      data: (v) => Container(
        width: double.infinity,
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: FlSpace.s4,
          vertical: FlSpace.s2,
        ),
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              t.hadith_datasetLine(v.datasetVersion ?? '—', v.recordCount ?? 0),
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (!v.contentLicenseConfirmed)
              Text(
                t.hadith_textWithheld,
                style: Theme.of(context).textTheme.bodySmall,
              ),
          ],
        ),
      ),
      orElse: () => const SizedBox.shrink(),
    );
  }
}

class _BookTile extends StatelessWidget {
  const _BookTile({required this.book});

  final HadithBook book;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsetsDirectional.symmetric(
          horizontal: FlSpace.s4,
          vertical: FlSpace.s2,
        ),
        title: Text(book.name),
        subtitle: Text(t.hadith_countLabel(book.hadithCount)),
        trailing: const Icon(Icons.chevron_left),
        onTap: () => context.pushNamed(
          'hadithChapters',
          pathParameters: {'bookId': book.id},
          extra: book.name,
        ),
      ),
    );
  }
}
