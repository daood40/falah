/// Shared state widgets for the hadith screens.
///
/// Every screen in this feature shows exactly one of four states — loading,
/// empty, error, data — and they all render through here so the wording and
/// the retry behaviour cannot drift between screens.
library;

import 'package:falah_hadith_api/falah_hadith_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/tokens.dart';
import '../../../l10n/app_localizations.dart';

/// Renders an async value with the precedence the reader needs: an attached
/// error is shown as an error, even while Riverpod still reports "loading"
/// (it keeps that flag while a retry is pending). Otherwise: spinner, then
/// content.
Widget hadithAsync<T>(
  AsyncValue<T> value, {
  required Widget Function(T data) data,
  required VoidCallback onRetry,
}) {
  final error = value.error;
  if (error != null) return HadithError(error: error, onRetry: onRetry);
  if (value.hasValue) return data(value.requireValue);
  return const HadithLoading();
}

class HadithCentered extends StatelessWidget {
  const HadithCentered({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsetsDirectional.all(FlSpace.s6),
          child: child,
        ),
      );
}

class HadithLoading extends StatelessWidget {
  const HadithLoading({super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return HadithCentered(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: FlSpace.s4),
          Text(t.hadith_loading),
        ],
      ),
    );
  }
}

class HadithEmpty extends StatelessWidget {
  const HadithEmpty({super.key, this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return HadithCentered(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.inbox_outlined, size: 40),
          const SizedBox(height: FlSpace.s3),
          Text(message ?? t.hadith_empty, textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

/// Turns a failure into a sentence the reader can act on. A network failure,
/// a rate limit and a server fault are different situations, so they are
/// different messages — never one generic "something went wrong".
String hadithErrorMessage(BuildContext context, Object error) {
  final t = AppLocalizations.of(context)!;
  if (error is ApiException) {
    switch (error.code) {
      case 'NETWORK_ERROR':
        return t.hadith_errorNetwork;
      case 'NOT_FOUND':
        return t.hadith_errorNotFound;
      case 'RATE_LIMITED':
        return t.hadith_errorRateLimited;
      case 'VALIDATION_ERROR':
      case 'BAD_REQUEST':
        return t.hadith_errorBadRequest;
      case 'CONTENT_LICENSE_RESTRICTED':
        return t.hadith_textWithheld;
      case 'INTERNAL_ERROR':
      case 'INVALID_RESPONSE':
        return t.hadith_errorServer;
    }
    if ((error.statusCode ?? 0) >= 500) return t.hadith_errorServer;
  }
  return t.hadith_error;
}

class HadithError extends StatelessWidget {
  const HadithError({super.key, required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return HadithCentered(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_outlined, size: 40),
          const SizedBox(height: FlSpace.s3),
          Text(hadithErrorMessage(context, error), textAlign: TextAlign.center),
          const SizedBox(height: FlSpace.s4),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: Text(t.hadith_retry),
          ),
        ],
      ),
    );
  }
}

/// The notice shown in place of a withheld text. It is never a substitute
/// text: the app shows the reason, not an approximation of the hadith.
class HadithWithheldNotice extends StatelessWidget {
  const HadithWithheldNotice({super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(FlSpace.s4),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(FlRadius.md),
      ),
      child: Row(
        children: [
          const Icon(Icons.lock_outline),
          const SizedBox(width: FlSpace.s3),
          Expanded(child: Text(t.hadith_textWithheld)),
        ],
      ),
    );
  }
}
