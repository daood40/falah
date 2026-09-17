/// A paged list of hadiths — of a book, of a chapter, of the whole collection,
/// or of a search. One screen serves all four, because the response shape and
/// the paging rules are identical.
library;

import 'package:falah_hadith_api/falah_hadith_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/tokens.dart';
import '../../../l10n/app_localizations.dart';
import '../data/hadith_providers.dart';
import 'hadith_states.dart';

class HadithListScreen extends ConsumerStatefulWidget {
  const HadithListScreen({super.key, required this.query, this.title});

  final HadithListQuery query;
  final String? title;

  @override
  ConsumerState<HadithListScreen> createState() => _HadithListScreenState();
}

class _HadithListScreenState extends ConsumerState<HadithListScreen> {
  final _controller = ScrollController();

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onScroll);
  }

  @override
  void dispose() {
    _controller.removeListener(_onScroll);
    _controller.dispose();
    super.dispose();
  }

  /// The next page is requested once, when the end of the list is in reach.
  void _onScroll() {
    if (!_controller.hasClients) return;
    final position = _controller.position;
    if (position.pixels >= position.maxScrollExtent - 400) {
      ref.read(hadithListProvider(widget.query).notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final state = ref.watch(hadithListProvider(widget.query));

    return Scaffold(
      appBar: AppBar(title: Text(widget.title ?? t.hadith_title)),
      body: hadithAsync(
        state,
        onRetry: () => ref.read(hadithListProvider(widget.query).notifier).refresh(),
        data: (data) {
          if (data.items.isEmpty) {
            return HadithEmpty(
              message: widget.query.kind == HadithListKind.search ? t.hadith_noResults : null,
            );
          }
          return RefreshIndicator(
            onRefresh: () => ref.read(hadithListProvider(widget.query).notifier).refresh(),
            child: ListView.separated(
              controller: _controller,
              padding: const EdgeInsetsDirectional.all(FlSpace.s4),
              itemCount: data.items.length + 1,
              separatorBuilder: (_, __) => const SizedBox(height: FlSpace.s2),
              itemBuilder: (context, i) {
                if (i == data.items.length) {
                  return _ListFooter(query: widget.query, state: data);
                }
                return _HadithTile(item: data.items[i]);
              },
            ),
          );
        },
      ),
    );
  }
}

/// Tells the reader where they are in the list: how many of how many, whether
/// more is loading, and what to do when a page failed.
class _ListFooter extends ConsumerWidget {
  const _ListFooter({required this.query, required this.state});

  final HadithListQuery query;
  final HadithListState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsetsDirectional.symmetric(vertical: FlSpace.s4),
      child: Column(
        children: [
          Text(
            t.hadith_pageStatus(state.items.length, state.total),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (state.loadingMore) ...[
            const SizedBox(height: FlSpace.s3),
            const CircularProgressIndicator(),
          ],
          if (state.error != null) ...[
            const SizedBox(height: FlSpace.s3),
            Text(hadithErrorMessage(context, state.error!), textAlign: TextAlign.center),
            const SizedBox(height: FlSpace.s2),
            FilledButton(
              onPressed: () => ref.read(hadithListProvider(query).notifier).loadMore(),
              child: Text(t.hadith_retry),
            ),
          ] else if (state.hasMore && !state.loadingMore) ...[
            const SizedBox(height: FlSpace.s3),
            OutlinedButton(
              onPressed: () => ref.read(hadithListProvider(query).notifier).loadMore(),
              child: Text(t.hadith_loadMore),
            ),
          ],
        ],
      ),
    );
  }
}

class _HadithTile extends StatelessWidget {
  const _HadithTile({required this.item});

  final HadithSummary item;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final location = (item.volume != null && item.page != null)
        ? t.hadith_volumePage(item.page!, item.volume!)
        : '';
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsetsDirectional.symmetric(
          horizontal: FlSpace.s4,
          vertical: FlSpace.s2,
        ),
        title: Text(
          // While the licence gate is closed the server sends no text, and the
          // app substitutes nothing: it says so.
          item.textAvailable && item.text != null ? item.text! : t.hadith_textWithheld,
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(location),
        trailing: const Icon(Icons.chevron_left),
        onTap: () => context.pushNamed(
          'hadithDetail',
          pathParameters: {'id': item.id},
        ),
      ),
    );
  }
}
