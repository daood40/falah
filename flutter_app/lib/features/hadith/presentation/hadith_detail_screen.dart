/// One hadith in full: its text (when the licence allows it), where it is
/// printed, who narrated it, its takhrij, its grading, its verification state
/// and the machine cross-check evidence behind that state.
///
/// Nothing on this screen is composed by the app. Every value is what the API
/// returned; a missing value is shown as missing, never filled in.
library;

import 'package:falah_hadith_api/falah_hadith_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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

            // ---- where it is printed ----
            HadithSection(
              title: t.hadith_sourceLabel,
              rows: [
                if (h.source != null) (t.hadith_collectionLabel, h.source!.name),
                if (h.book != null) (t.hadith_bookLabel, h.book!.name),
                if (h.chapter != null) (t.hadith_chapterLabel, h.chapter!.name),
                if (h.location.volume != null && h.location.page != null)
                  (t.hadith_locationLabel, t.hadith_volumePage(h.location.page!, h.location.volume!)),
                if (h.location.locator != null) (t.hadith_locatorLabel, h.location.locator!),
                (t.hadith_numberLabel, h.number ?? t.hadith_noNumberInEdition),
              ],
            ),

            // ---- narrators ----
            if (h.narrators.isNotEmpty)
              HadithSection(
                title: t.hadith_narratorLabel,
                rows: [
                  for (final n in h.narrators) ...[
                    (n.position?.toString() ?? t.hadith_narratorLabel, n.name),
                    if (n.kunya != null) (t.hadith_kunyaLabel, n.kunya!),
                    if (n.laqab != null) (t.hadith_laqabLabel, n.laqab!),
                    if (n.role != null) (t.hadith_roleLabel, n.role!),
                    if (n.sourceReference != null)
                      (t.hadith_narratorSourceLabel, n.sourceReference!),
                  ],
                ],
                action: h.narrators.isEmpty
                    ? null
                    : (
                        t.hadith_narratorHadiths,
                        () => context.pushNamed(
                              'hadithNarratorList',
                              pathParameters: {'narratorId': h.narrators.first.id},
                              extra: h.narrators.first.name,
                            ),
                      ),
              ),

            // ---- grading ----
            if (h.gradings.isNotEmpty)
              HadithSection(
                title: t.hadith_gradingLabel,
                rows: [
                  for (final g in h.gradings) ...[
                    (t.hadith_gradingLabel, g.text),
                    if (g.source != null) (t.hadith_graderLabel, g.source!),
                    if (g.reference != null) (t.hadith_referenceLabel, g.reference!),
                    if (g.notes != null) (t.hadith_notesLabel, g.notes!),
                  ],
                ],
              ),

            // ---- takhrij: which collections the edition cites ----
            if (h.takhrij != null)
              HadithSection(
                title: t.hadith_takhrijLabel,
                rows: [
                  if (h.takhrij!.sources.isNotEmpty)
                    (t.hadith_collectionsTitle, h.takhrij!.sources.join('، ')),
                  for (final r in h.takhrij!.references)
                    (
                      r.source ?? '—',
                      [
                        if (r.book != null) r.book!,
                        if (r.referenceNumber != null) '(${r.referenceNumber})',
                        if (r.volume != null && r.page != null)
                          t.hadith_volumePage(r.page!, r.volume!),
                      ].join(' '),
                    ),
                  if (!h.takhrij!.textAvailable) (t.hadith_takhrijTextLabel, t.hadith_textWithheld),
                ],
              ),

            // ---- references, when asked for separately ----
            if (h.references.isNotEmpty)
              HadithSection(
                title: t.hadith_referencesTitle,
                rows: [
                  for (final r in h.references)
                    (
                      r.source ?? '—',
                      [
                        if (r.referenceNumber != null) r.referenceNumber!,
                        if (r.locator != null) r.locator!,
                      ].join(' · '),
                    ),
                ],
              ),

            _VerificationCard(verification: h.verification, dataset: h.dataset, locked: h.sourceLocked),
            _CrossCheckCard(hadithId: h.id),
          ],
        ),
      ),
    );
  }
}

/// A labelled block of key/value rows, with an optional action underneath.
class HadithSection extends StatelessWidget {
  const HadithSection({super.key, required this.title, required this.rows, this.action});

  final String title;
  final List<(String, String)> rows;
  final (String, VoidCallback)? action;

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
          if (action != null)
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton(onPressed: action!.$2, child: Text(action!.$1)),
            ),
        ],
      ),
    );
  }
}

/// The verification state as the service reports it, in its three separate
/// layers: the file match, the machine cross-check, and the human review.
/// A machine check is never presented as a human one.
class _VerificationCard extends StatelessWidget {
  const _VerificationCard({
    required this.verification,
    required this.dataset,
    required this.locked,
  });

  final Verification verification;
  final DatasetRef dataset;
  final bool locked;

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
            const SizedBox(height: FlSpace.s3),
            _Line(label: t.hadith_statusLabel, value: verification.status),
            if (verification.sourceMatch != null)
              _Line(
                label: t.hadith_sourceMatchLabel,
                value: verification.sourceMatch! ? t.hadith_yes : t.hadith_no,
              ),
            _Line(label: t.hadith_humanReviewLabel, value: t.hadith_no),
            _Line(label: t.hadith_lockedLabel, value: locked ? t.hadith_yes : t.hadith_no),
            const Divider(),
            _Line(label: t.hadith_datasetLabel, value: dataset.version),
            _Line(
              label: t.hadith_hashLabel(''),
              value: dataset.hash.substring(0, dataset.hash.length.clamp(0, 16)),
            ),
            if (dataset.datasetHash != null)
              _Line(
                label: t.hadith_datasetHashLabel,
                value: dataset.datasetHash!.substring(0, dataset.datasetHash!.length.clamp(0, 16)),
              ),
          ],
        ),
      ),
    );
  }
}

/// What an independent corpus says about this record. Evidence for a human,
/// never a ruling: the app states the method and the score and stops there.
class _CrossCheckCard extends ConsumerWidget {
  const _CrossCheckCard({required this.hadithId});

  final String hadithId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    final checks = ref.watch(hadithCrossChecksProvider(hadithId));

    return Card(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(FlSpace.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(t.hadith_crossCheckTitle, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: FlSpace.s2),
            Text(t.hadith_crossCheckNote, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: FlSpace.s3),
            checks.when(
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => Text(hadithErrorMessage(context, e)),
              data: (items) => items.isEmpty
                  ? Text(t.hadith_crossCheckNone)
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final c in items) ...[
                          _Line(label: t.hadith_verdictLabel, value: _verdict(t, c.verdict)),
                          if (c.referenceCollection != null)
                            _Line(label: t.hadith_matchedInLabel, value: c.referenceCollection!),
                          if (c.referenceNumber != null)
                            _Line(label: t.hadith_referenceLabel, value: c.referenceNumber!),
                          if (c.similarity != null)
                            _Line(label: t.hadith_similarityLabel, value: c.similarity!),
                          if (c.takhrijAgrees != null)
                            _Line(
                              label: t.hadith_takhrijAgreesLabel,
                              value: c.takhrijAgrees! ? t.hadith_yes : t.hadith_no,
                            ),
                          if (c.referenceName != null)
                            _Line(label: t.hadith_referenceCorpusLabel, value: c.referenceName!),
                          if (c.method != null)
                            _Line(label: t.hadith_methodLabel, value: c.method!),
                        ],
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  String _verdict(AppLocalizations t, String verdict) => switch (verdict) {
        'corroborated' => t.hadith_verdictCorroborated,
        'partial' => t.hadith_verdictPartial,
        _ => t.hadith_verdictNotFound,
      };
}

class _Line extends StatelessWidget {
  const _Line({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsetsDirectional.only(bottom: FlSpace.s1),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 130,
              child: Text(label, style: Theme.of(context).textTheme.bodySmall),
            ),
            Expanded(child: Text(value)),
          ],
        ),
      );
}
