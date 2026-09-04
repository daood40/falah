/// Context Validation (v2 §14.1) — ported 1:1 from the PWA.
///
/// Warns when an ayah selection cuts a clause that grammatically continues
/// across the range edge: an exception («إلا») or relative clause («الذين»)
/// opening the NEXT ayah, or a selection that itself opens with one and so
/// depends on the PREVIOUS ayah.
///
/// Analysis only — nothing here modifies or generates sacred text
/// (SOURCE_LOCK). Warnings are advisory, never blocking.
library;

// Strip diacritics/Quranic marks WITHOUT unifying letter forms: hamza shape
// distinguishes «إلا» (exception) from «ألا» (interrogative opener).
final _marks = RegExp('[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640\\u08D3-\\u08FF]');
final _spaces = RegExp(r'\s+');

String _stripMarks(String text) =>
    text.replaceAll(_marks, '').replaceAll(_spaces, ' ').trim();

final _exceptionOpen = RegExp('^إلا\\s');
final _relativeOpen = RegExp('^[اٱ]ل(ذين|ذي|تي|لذين|لاتي|لائي)\\s');

enum ContextReason { exception, relative }

enum ContextExtend { before, after }

class ContextWarning {
  final ContextExtend extend;
  final ContextReason reason;
  const ContextWarning(this.extend, this.reason);

  @override
  bool operator ==(Object other) =>
      other is ContextWarning &&
      other.extend == extend &&
      other.reason == reason;

  @override
  int get hashCode => Object.hash(extend, reason);
}

/// Returns advisory warnings for a contiguous ayah selection.
List<ContextWarning> checkContext({
  required String firstText,
  String? nextText,
  required bool hasPrev,
}) {
  final warnings = <ContextWarning>[];

  if (hasPrev) {
    final first = _stripMarks(firstText);
    if (_exceptionOpen.hasMatch(first)) {
      warnings.add(
          const ContextWarning(ContextExtend.before, ContextReason.exception));
    } else if (_relativeOpen.hasMatch(first)) {
      warnings.add(
          const ContextWarning(ContextExtend.before, ContextReason.relative));
    }
  }

  if (nextText != null) {
    final next = _stripMarks(nextText);
    if (_exceptionOpen.hasMatch(next)) {
      warnings.add(
          const ContextWarning(ContextExtend.after, ContextReason.exception));
    } else if (_relativeOpen.hasMatch(next)) {
      warnings.add(
          const ContextWarning(ContextExtend.after, ContextReason.relative));
    }
  }

  return warnings;
}
