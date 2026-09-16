/**
 * Non-destructive search normalisation. Used ONLY to build `search_text`;
 * `raw_text` is stored verbatim and never passes through here.
 * Documented in docs/SOURCE_POLICY.md.
 */
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ࣓-ࣿ]/gu;

export function normalizeForSearch(text: string): string {
  return text
    .replace(DIACRITICS, '')
    .replace(/[آأإٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .replace(/ؤ/gu, 'و')
    .replace(/ئ/gu, 'ي')
    .replace(/[ۥۦ]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Matching skeleton: the search form with every alef dropped. The Uthmani
 * script writes some long vowels as a superscript alef (e.g. ٱلۡعَٰلَمِينَ), so a
 * reader typing العالمين and a reader typing العلمين must both match. Dropping
 * alef from both sides makes the two spellings identical. Derived column only —
 * `raw_text` is never touched.
 */
export function searchSkeleton(text: string): string {
  return normalizeForSearch(text)
    .replace(/\u0627/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Arabic-Indic and extended digits → ASCII, for query parsing only. */
export function normalizeDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/gu, (d) =>
    String(d.charCodeAt(0) & 0x0f),
  );
}
