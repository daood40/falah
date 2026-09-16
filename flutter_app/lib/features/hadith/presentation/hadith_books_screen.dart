/// Books of the hadith collection, served by the FALAH API.
///
/// Every visible string comes from the localization file, every layout uses
/// EdgeInsetsDirectional, and the screen implements the four required states:
/// loading, empty, error, data.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/tokens.dart';
import '../../../l10n/app_localizations.dart';
import '../data/hadith_providers.dart';
import '../domain/models.dart';

class HadithBooksScreen extends ConsumerWidget {
  const HadithBooksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context);
    final books = ref.watch(hadithBooksProvider);

    return Scaffold(
      appBar: AppBar(title: Text(t.hadith_booksTitle)),
      body: books.when(
        loading: () => _Centered(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(),
              const SizedBox(height: FlSpace.s4),
              Text(t.hadith_loading),
            ],
          ),
        ),
        error: (_, __) => _Centered(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(t.hadith_error, textAlign: TextAlign.center),
              const SizedBox(height: FlSpace.s4),
              FilledButton(
                onPressed: () => ref.invalidate(hadithBooksProvider),
                child: Text(t.hadith_retry),
              ),
            ],
          ),
        ),
        data: (items) => items.isEmpty
            ? _Centered(child: Text(t.hadith_empty, textAlign: TextAlign.center))
            : ListView.separated(
                padding: const EdgeInsetsDirectional.all(FlSpace.s4),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: FlSpace.s2),
                itemBuilder: (context, i) => _BookTile(book: items[i]),
              ),
      ),
    );
  }
}

class _BookTile extends StatelessWidget {
  const _BookTile({required this.book});

  final HadithBook book;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsetsDirectional.symmetric(
          horizontal: FlSpace.s4,
          vertical: FlSpace.s2,
        ),
        title: Text(book.name),
        subtitle: Text('${book.hadithCount}'),
        trailing: const Icon(Icons.chevron_left),
      ),
    );
  }
}

class _Centered extends StatelessWidget {
  const _Centered({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsetsDirectional.all(FlSpace.s6),
          child: child,
        ),
      );
}
