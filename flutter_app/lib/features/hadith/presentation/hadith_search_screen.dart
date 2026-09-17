/// Search across the collection. `GET /api/v1/search?q=…`.
///
/// The server normalises Arabic (diacritics, hamza forms, ta-marbuta), so the
/// app sends the term as typed and never rewrites it.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/tokens.dart';
import '../../../l10n/app_localizations.dart';
import '../data/hadith_providers.dart';
import 'hadith_states.dart';

class HadithSearchScreen extends ConsumerStatefulWidget {
  const HadithSearchScreen({super.key});

  @override
  ConsumerState<HadithSearchScreen> createState() => _HadithSearchScreenState();
}

class _HadithSearchScreenState extends ConsumerState<HadithSearchScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit(String value) {
    final term = value.trim();
    if (term.length < 2) return;
    ref.read(hadithSearchTermProvider.notifier).set(term);
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final term = ref.watch(hadithSearchTermProvider);

    return Scaffold(
      appBar: AppBar(title: Text(t.hadith_searchTitle)),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.all(FlSpace.s4),
            child: TextField(
              controller: _controller,
              textInputAction: TextInputAction.search,
              onSubmitted: _submit,
              decoration: InputDecoration(
                hintText: t.hadith_searchHint,
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.arrow_forward),
                  onPressed: () => _submit(_controller.text),
                ),
              ),
            ),
          ),
          if (term.isEmpty)
            Expanded(child: HadithEmpty(message: t.hadith_searchPrompt))
          else
            Expanded(child: _Results(term: term)),
        ],
      ),
    );
  }
}

class _Results extends ConsumerWidget {
  const _Results({required this.term});

  final String term;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    final query = HadithListQuery(HadithListKind.search, term);
    final state = ref.watch(hadithListProvider(query));

    return hadithAsync(
      state,
      onRetry: () => ref.read(hadithListProvider(query).notifier).refresh(),
      data: (data) {
        if (data.items.isEmpty) return HadithEmpty(message: t.hadith_noResults);
        return ListView.separated(
          padding: const EdgeInsetsDirectional.all(FlSpace.s4),
          itemCount: data.items.length + 1,
          separatorBuilder: (_, __) => const SizedBox(height: FlSpace.s2),
          itemBuilder: (context, i) {
            if (i == data.items.length) {
              return Padding(
                padding: const EdgeInsetsDirectional.symmetric(vertical: FlSpace.s4),
                child: Column(
                  children: [
                    Text(
                      t.hadith_pageStatus(data.items.length, data.total),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    if (data.hasMore) ...[
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
            final item = data.items[i];
            return Card(
              child: ListTile(
                title: Text(
                  item.textAvailable && item.text != null ? item.text! : t.hadith_textWithheld,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: (item.volume != null && item.page != null)
                    ? Text(t.hadith_volumePage(item.page!, item.volume!))
                    : null,
                trailing: const Icon(Icons.chevron_left),
                onTap: () => context.pushNamed(
                  'hadithDetail',
                  pathParameters: {'id': item.id},
                ),
              ),
            );
          },
        );
      },
    );
  }
}
