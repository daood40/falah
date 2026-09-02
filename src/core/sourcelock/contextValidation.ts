/** Context Validation (v2 §14.1): warn when an ayah selection cuts a clause
 * that grammatically continues across the range edge, e.g. an exception
 * («إلا») or a relative clause («الذين») opening the NEXT ayah, or a
 * selection that itself opens with one of those and so depends on the
 * PREVIOUS ayah.
 *
 * Analysis only. Nothing here modifies or generates sacred text
 * (SOURCE_LOCK); it inspects the verified text and produces UI warnings.
 * Warnings are advisory, never blocking: the app does not assert rulings
 * about which excerpts are permissible.
 */

// Strip diacritics/Quranic marks WITHOUT unifying letter forms: hamza shape
// distinguishes «إلا» (exception) from «ألا» (interrogative opener), so the
// search-oriented normalizeArabic() is too lossy here.
const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08D3-\u08FF]/g;

function stripMarks(text: string): string {
  return text.replace(MARKS, '').replace(/\s+/g, ' ').trim();
}

// «إلا» exception particle; «الذين/اللذين…» relative pronouns (plain or wasla alef).
const EXCEPTION_OPEN = /^إلا\s/;
const RELATIVE_OPEN = /^[اٱ]ل(ذين|ذي|تي|لذين|لاتي|لائي)\s/;

export type ContextReason = 'exception' | 'relative';

export interface ContextWarning {
  /** Which direction completes the meaning. */
  extend: 'before' | 'after';
  reason: ContextReason;
}

export interface ContextCheckInput {
  /** Verbatim text of the first selected ayah. */
  firstText: string;
  /** Verbatim text of the ayah after the selection (same surah), if any. */
  nextText?: string;
  /** Whether an ayah exists before the selection in the same surah. */
  hasPrev: boolean;
}

/** Returns advisory warnings for a contiguous ayah selection. */
export function checkContext(input: ContextCheckInput): ContextWarning[] {
  const warnings: ContextWarning[] = [];

  if (input.hasPrev) {
    const first = stripMarks(input.firstText);
    if (EXCEPTION_OPEN.test(first)) warnings.push({ extend: 'before', reason: 'exception' });
    else if (RELATIVE_OPEN.test(first)) warnings.push({ extend: 'before', reason: 'relative' });
  }

  if (input.nextText) {
    const next = stripMarks(input.nextText);
    if (EXCEPTION_OPEN.test(next)) warnings.push({ extend: 'after', reason: 'exception' });
    else if (RELATIVE_OPEN.test(next)) warnings.push({ extend: 'after', reason: 'relative' });
  }

  return warnings;
}
