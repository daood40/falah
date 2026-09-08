/// Dhikr presets ported verbatim from the PWA's tasbihStore — same texts,
/// same Quran references (where the wording occurs in the verified text),
/// same default targets. FALAH asserts no repeat-count rulings.
library;

class DhikrPreset {
  final String id;
  final String text;

  /// "surah:ayah" where the phrase occurs verbatim in the verified text.
  final String? quranRef;
  final int defaultTarget;

  const DhikrPreset({
    required this.id,
    required this.text,
    this.quranRef,
    required this.defaultTarget,
  });
}

const dhikrPresets = [
  DhikrPreset(
    id: 'subhan',
    text: 'سُبْحَانَ اللَّهِ',
    quranRef: '37:159',
    defaultTarget: 33,
  ),
  DhikrPreset(
    id: 'hamd',
    text: 'الْحَمْدُ لِلَّهِ',
    quranRef: '1:2',
    defaultTarget: 33,
  ),
  DhikrPreset(id: 'takbir', text: 'اللَّهُ أَكْبَرُ', defaultTarget: 34),
  DhikrPreset(
    id: 'tahlil',
    text: 'لَا إِلَٰهَ إِلَّا اللَّهُ',
    quranRef: '47:19',
    defaultTarget: 100,
  ),
  DhikrPreset(
    id: 'istighfar',
    text: 'أَسْتَغْفِرُ اللَّهَ',
    defaultTarget: 100,
  ),
];

DhikrPreset presetById(String? id) =>
    dhikrPresets.where((p) => p.id == id).firstOrNull ?? dhikrPresets.first;
