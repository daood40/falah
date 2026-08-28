/** Arabic text utilities for diacritics-insensitive search.
 * These NEVER modify displayed text — search-index only (Source Lock). */

// Tashkeel (064B-065F), Quranic annotation marks (0610-061A, 06D6-06ED),
// superscript alef (0670), tatweel (0640), Quranic supplements (08D3-08FF).
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08D3-\u08FF]/g;

/** Normalize Arabic for matching: strip tashkeel/Quranic marks, unify letter forms. */
export function normalizeArabic(input: string): string {
  return input
    .replace(DIACRITICS, '')
    .replace(/[آأإٱ]/g, 'ا') // alef variants → alef
    .replace(/ة/g, 'ه') // ta marbuta → ha
    .replace(/ى/g, 'ي') // alef maqsura → ya
    .replace(/ؤ/g, 'و') // waw hamza → waw
    .replace(/ئ/g, 'ي') // ya hamza → ya
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse an ayah reference like "2:255", "٢:٢٥٥" or "2 255". Returns null if not a reference. */
export function parseAyahReference(query: string): { surah: number; ayah: number } | null {
  const western = query.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const match = western.trim().match(/^(\d{1,3})\s*[:\s،-]\s*(\d{1,3})$/);
  if (!match) return null;
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  if (surah < 1 || surah > 114 || ayah < 1) return null;
  return { surah, ayah };
}
