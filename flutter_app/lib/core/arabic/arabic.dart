/// Arabic text utilities for diacritics-insensitive search — ported 1:1 from
/// the PWA. These NEVER modify displayed text (SOURCE_LOCK: search-index only).
library;

final _diacritics = RegExp(
  '[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640\\u08D3-\\u08FF]',
);
final _alefVariants = RegExp('[آأإٱ]');
final _spaces = RegExp(r'\s+');

/// Normalize Arabic for matching: strip tashkeel/Quranic marks, unify letters.
String normalizeArabic(String input) => input
    .replaceAll(_diacritics, '')
    .replaceAll(_alefVariants, 'ا')
    .replaceAll('ة', 'ه')
    .replaceAll('ى', 'ي')
    .replaceAll('ؤ', 'و')
    .replaceAll('ئ', 'ي')
    .replaceAll(_spaces, ' ')
    .trim();

final _arabicIndic = RegExp('[٠-٩]');
final _refPattern = RegExp(r'^(\d{1,3})\s*[:\s،-]\s*(\d{1,3})$');

class AyahRef {
  final int surah;
  final int ayah;
  const AyahRef(this.surah, this.ayah);
}

/// Parse an ayah reference like "2:255", "٢:٢٥٥" or "2 255".
AyahRef? parseAyahReference(String query) {
  final western = query.replaceAllMapped(
    _arabicIndic,
    (m) => String.fromCharCode(m[0]!.codeUnitAt(0) - 0x0660 + 0x30),
  );
  final match = _refPattern.firstMatch(western.trim());
  if (match == null) return null;
  final surah = int.parse(match[1]!);
  final ayah = int.parse(match[2]!);
  if (surah < 1 || surah > 114 || ayah < 1) return null;
  return AyahRef(surah, ayah);
}
