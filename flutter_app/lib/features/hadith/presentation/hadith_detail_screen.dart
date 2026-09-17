/// One hadith in full: its text (when the licence allows it), where it is
/// printed, its narrator, its takhrij, its grading and its verification state.
///
/// Nothing on this screen is composed by the app. Every value is what the API
/// returned; a missing value is shown as missing, never filled in.
library;

import 'package:falah_hadith_api/falah_hadith_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/tokens.dart';
import '../../../l10n/app_localizations.dart';
import '../data/hadith_providers.dart';
import 'hadith_states.dart';

class HadithDetailScreen extends ConsumerWidget {
  const HadithDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    final hadith = ref.watch(hadithProvider(id));

    return Scaffold(
      appBar: AppBar(title: Text(t.hadith_title)),
      body: hadithAsync(
        hadith,
        onRetry: () => ref.invalidate(hadithProvider(id)),
        data: (h) => ListView(
          padding: const EdgeInsetsDirectional.all(FlSpace.s4),
          children: [
            if (h.textAvailable && h.displayText != null)
              SelectableText(
                h.displayText!,
                style: Theme.of(context).textTheme.titleMedium,
                textAlign: TextAlign.start,
              )
            else
              const HadithWithheldNotice(),
            const SizedBox(height: FlSpace.s5),
            _Section(
              title: t.hadith_sourceLabel,
              rows: [
                if (h.source != null) (t.hadith_collectionLabel, h.source!.name),
                if (h.book != null) (t.hadith_bookLabel, h.book!.name),
                if (h.chapter != null) (t.hadith_chapterLabel, h.chapter!.name),
                if (h.location.volume != null && h.location.page != null)
                  (t.hadith_locationLabel, t.hadith_volumePage(h.location.page!, h.location.volume!)),
                if (h.location.locator != null) (t.hadith_locatorLabel, h.location.locator!),
                if (h.number != null) (t.hadith_numberLabel, h.number!),
              ],
            ),
            if (h.narrators.isNotEmpty)
              _Section(
                title: t.hadith_narratorLabel,
                rows: [
                  for (final n in h.narrators) (n.position?.toString() ?? '—', n.name),
                ],
              ),
            if (h.gradings.isNotEmpty)
              _Section(
                title: t.hadith_gradingLabel,
                rows: [
                  for (final g in h.gradings) (g.source ?? t.hadith_gradingLabel, g.text),
                ],
              ),
            if (h.takhrij != null && h.takhrij!.sources.isNotEmpty)
              _Section(
                title: t.hadith_takhrijLabel,
                rows: [
                  for (final r in h.takhrij!.references)
                    (r.source ?? '—', r.referenceNumber ?? r.book ?? r.locator ?? '—'),
                  if (h.takhrij!.references.isEmpty)
                    (t.hadith_collectionLabel, h.takhrij!.sources.join('، ')),
                ],
              ),
            _VerificationCard(verification: h.verification, dataset: h.dataset),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.rows});

  final String title;
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: FlSpace.s5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: FlSpace.s2),
          for (final row in rows)
            Padding(
              padding: const EdgeInsetsDirectional.only(bottom: FlSpace.s1),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 110,
                    child: Text(row.$1, style: Theme.of(context).textTheme.bodySmall),
                  ),
                  Expanded(child: Text(row.$2)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// The verification state as the service reports it. A machine check is never
/// presented as a human one, and "pending" is shown plainly.
class _VerificationCard extends StatelessWidget {
  const _VerificationCard({required this.verification, required this.dataset});

  final Verification verification;
  final DatasetRef dataset;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Card(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(FlSpace.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(verification.verified ? Icons.verified_outlined : Icons.pending_outlined),
                const SizedBox(width: FlSpace.s2),
                Text(verification.verified ? t.hadith_verified : t.hadith_unverified),
              ],
            ),
            const SizedBox(height: FlSpace.s2),
            Text(
              t.hadith_datasetLine(dataset.version, 0),
              style: Theme.of(context).textTheme.bodySmall,
            ),
            Text(
              t.hadith_hashLabel(dataset.hash.substring(0, dataset.hash.length.clamp(0, 12))),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}
