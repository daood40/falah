/// Chapters of one book. `GET /api/v1/books/{id}/chapters`.
library;

import 'package:falah_hadith_api/falah_hadith_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/tokens.dart';
import '../../../l10n/app_localizations.dart';
import '../data/hadith_providers.dart';
import 'hadith_states.dart';

class HadithChaptersScreen extends ConsumerWidget {
  const HadithChaptersScreen({super.key, required this.bookId, this.bookName});

  final String bookId;
  final String? bookName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    final chapters = ref.watch(hadithChaptersProvider(bookId));

    return Scaffold(
      appBar: AppBar(
        title: Text(bookName ?? t.hadith_chaptersTitle),
        actions: [
          TextButton(
            onPressed: () => context.pushNamed(
              'hadithBookList',
              pathParameters: {'bookId': bookId},
              extra: bookName,
            ),
            child: Text(t.hadith_allOfBook),
          ),
        ],
      ),
      body: hadithAsync(
        chapters,
        onRetry: () => ref.invalidate(hadithChaptersProvider(bookId)),
        data: (items) => items.isEmpty
            ? const HadithEmpty()
            : RefreshIndicator(
                onRefresh: () async => ref.invalidate(hadithChaptersProvider(bookId)),
                child: ListView.separated(
                  padding: const EdgeInsetsDirectional.all(FlSpace.s4),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: FlSpace.s2),
                  itemBuilder: (context, i) => _ChapterTile(chapter: items[i]),
                ),
              ),
      ),
    );
  }
}

class _ChapterTile extends StatelessWidget {
  const _ChapterTile({required this.chapter});

  final HadithChapter chapter;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsetsDirectional.symmetric(
          horizontal: FlSpace.s4,
          vertical: FlSpace.s2,
        ),
        title: Text(chapter.title),
        subtitle: Text(t.hadith_countLabel(chapter.hadithCount)),
        trailing: const Icon(Icons.chevron_left),
        onTap: () => context.pushNamed(
          'hadithChapterList',
          pathParameters: {'chapterId': chapter.id},
          extra: chapter.title,
        ),
      ),
    );
  }
}
