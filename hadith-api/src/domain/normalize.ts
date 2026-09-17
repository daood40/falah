/**
 * Search-only Arabic normalization. It mirrors corpus.normalize_ar() in SQL.
 * It NEVER touches stored text — the original is always what is saved,
 * displayed and exported (SOURCE_POLICY §2).
 */
const DIACRITICS = /[ً-ٰٟۖ-ۭـ]/g;
const MAP: Record<string, string> = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا',
  'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '٫': '.',
};

export function normalizeArabic(input: string): string {
  return input
    .replace(DIACRITICS, '')
    .replace(/[أإآٱىةؤئ٠-٩٫]/g, (ch) => MAP[ch] ?? ch)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Only whitespace at the very edges is trimmed; inner text stays verbatim. */
export function preserveText(input: string): string {
  return input.replace(/^﻿/, '').replace(/[ \t]+$/gm, '').trim();
}
