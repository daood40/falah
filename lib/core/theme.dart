import 'package:flutter/material.dart';

/// ألوان "وقتي" الإضافية التي لا يغطيها [ColorScheme]
/// (ألوان الحالات، الحدود، النصوص الثانوية…).
@immutable
class WaqtiColors extends ThemeExtension<WaqtiColors> {
  const WaqtiColors({
    required this.background,
    required this.surface,
    required this.surfaceAlt,
    required this.primary,
    required this.primaryDark,
    required this.primaryLight,
    required this.text,
    required this.textMuted,
    required this.border,
    required this.done,
    required this.late,
    required this.missed,
    required this.none,
  });

  final Color background;
  final Color surface;
  final Color surfaceAlt;
  final Color primary;
  final Color primaryDark;
  final Color primaryLight;
  final Color text;
  final Color textMuted;
  final Color border;
  final Color done;
  final Color late;
  final Color missed;
  final Color none;

  static const lightColors = WaqtiColors(
    background: Color(0xFFF6F7F1),
    surface: Color(0xFFFFFFFF),
    surfaceAlt: Color(0xFFEEF2E7),
    primary: Color(0xFF6E8F72),
    primaryDark: Color(0xFF4F6E54),
    primaryLight: Color(0xFFDCE7DD),
    text: Color(0xFF20291F),
    textMuted: Color(0xFF6C7A69),
    border: Color(0xFFE5E9DE),
    done: Color(0xFF4CAF6D),
    late: Color(0xFFE3A93F),
    missed: Color(0xFFE1615A),
    none: Color(0xFFD7DCCF),
  );

  static const darkColors = WaqtiColors(
    background: Color(0xFF141C15),
    surface: Color(0xFF1C261C),
    surfaceAlt: Color(0xFF233024),
    primary: Color(0xFF7FA184),
    primaryDark: Color(0xFF5C7C60),
    primaryLight: Color(0xFF2B3A2C),
    text: Color(0xFFEAF1E7),
    textMuted: Color(0xFF93A390),
    border: Color(0xFF2C3A2C),
    done: Color(0xFF4CAF6D),
    late: Color(0xFFE3A93F),
    missed: Color(0xFFE1615A),
    none: Color(0xFF3A4A3A),
  );

  @override
  WaqtiColors copyWith({
    Color? background,
    Color? surface,
    Color? surfaceAlt,
    Color? primary,
    Color? primaryDark,
    Color? primaryLight,
    Color? text,
    Color? textMuted,
    Color? border,
    Color? done,
    Color? late,
    Color? missed,
    Color? none,
  }) {
    return WaqtiColors(
      background: background ?? this.background,
      surface: surface ?? this.surface,
      surfaceAlt: surfaceAlt ?? this.surfaceAlt,
      primary: primary ?? this.primary,
      primaryDark: primaryDark ?? this.primaryDark,
      primaryLight: primaryLight ?? this.primaryLight,
      text: text ?? this.text,
      textMuted: textMuted ?? this.textMuted,
      border: border ?? this.border,
      done: done ?? this.done,
      late: late ?? this.late,
      missed: missed ?? this.missed,
      none: none ?? this.none,
    );
  }

  @override
  WaqtiColors lerp(ThemeExtension<WaqtiColors>? other, double t) {
    if (other is! WaqtiColors) return this;
    return WaqtiColors(
      background: Color.lerp(background, other.background, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceAlt: Color.lerp(surfaceAlt, other.surfaceAlt, t)!,
      primary: Color.lerp(primary, other.primary, t)!,
      primaryDark: Color.lerp(primaryDark, other.primaryDark, t)!,
      primaryLight: Color.lerp(primaryLight, other.primaryLight, t)!,
      text: Color.lerp(text, other.text, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      border: Color.lerp(border, other.border, t)!,
      done: Color.lerp(done, other.done, t)!,
      late: Color.lerp(late, other.late, t)!,
      missed: Color.lerp(missed, other.missed, t)!,
      none: Color.lerp(none, other.none, t)!,
    );
  }
}

/// اختصار للوصول لألوان وقتي من أي [BuildContext].
extension WaqtiThemeX on BuildContext {
  WaqtiColors get wq => Theme.of(this).extension<WaqtiColors>()!;
}

abstract final class WaqtiTheme {
  static const _fontFamily = 'Tajawal';

  static ThemeData light() => _build(WaqtiColors.lightColors, Brightness.light);

  static ThemeData dark() => _build(WaqtiColors.darkColors, Brightness.dark);

  static ThemeData _build(WaqtiColors c, Brightness brightness) {
    final scheme = ColorScheme(
      brightness: brightness,
      primary: c.primary,
      onPrimary: Colors.white,
      secondary: c.primaryDark,
      onSecondary: Colors.white,
      error: c.missed,
      onError: Colors.white,
      surface: c.surface,
      onSurface: c.text,
      surfaceContainerHighest: c.surfaceAlt,
      outline: c.border,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      fontFamily: _fontFamily,
      scaffoldBackgroundColor: c.background,
      splashFactory: InkSparkle.splashFactory,
    );

    final textTheme = base.textTheme.apply(
      bodyColor: c.text,
      displayColor: c.text,
      fontFamily: _fontFamily,
    );

    return base.copyWith(
      textTheme: textTheme,
      extensions: [c],
      appBarTheme: AppBarTheme(
        backgroundColor: c.background,
        foregroundColor: c.text,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontFamily: _fontFamily,
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: c.text,
        ),
      ),
      cardTheme: CardThemeData(
        color: c.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(color: c.border),
        ),
      ),
      dividerTheme: DividerThemeData(color: c.border, thickness: 1),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.background,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 12,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: c.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: c.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: c.primary, width: 1.6),
        ),
        hintStyle: TextStyle(color: c.textMuted, fontSize: 13.5),
        labelStyle: TextStyle(
          color: c.textMuted,
          fontSize: 12.5,
          fontWeight: FontWeight.w600,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: c.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          textStyle: const TextStyle(
            fontFamily: _fontFamily,
            fontWeight: FontWeight.w700,
            fontSize: 13.5,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: c.surfaceAlt,
          foregroundColor: c.text,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          textStyle: const TextStyle(
            fontFamily: _fontFamily,
            fontWeight: FontWeight.w700,
            fontSize: 13.5,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: c.primaryDark,
          textStyle: const TextStyle(
            fontFamily: _fontFamily,
            fontWeight: FontWeight.w700,
            fontSize: 12.5,
          ),
        ),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: const WidgetStatePropertyAll(Colors.white),
        trackColor: WidgetStateProperty.resolveWith(
          (states) =>
              states.contains(WidgetState.selected) ? c.primary : c.none,
        ),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: brightness == Brightness.light
            ? const Color(0xFF20291F)
            : c.surfaceAlt,
        contentTextStyle: TextStyle(
          fontFamily: _fontFamily,
          fontSize: 13.5,
          color: brightness == Brightness.light ? Colors.white : c.text,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        titleTextStyle: TextStyle(
          fontFamily: _fontFamily,
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: c.text,
        ),
        contentTextStyle: TextStyle(
          fontFamily: _fontFamily,
          fontSize: 14,
          color: c.text,
        ),
      ),
    );
  }
}

/// لوحة الألوان الجاهزة لاختيار لون المهمة/التصنيف — نفس ألوان النموذج الأصلي.
const List<int> kTaskColorPalette = [
  0xFF6E8F72,
  0xFF4C8DE0,
  0xFFE3A93F,
  0xFFE1615A,
  0xFF8E6CE0,
  0xFF3FB6B0,
  0xFFE07EA8,
  0xFF7A8B99,
  0xFFC97B3F,
  0xFF5FAE5F,
  0xFF2E7D5B,
  0xFF0EA5E9,
  0xFFDB2777,
  0xFF7C3AED,
  0xFFF59E0B,
  0xFF059669,
  0xFFEF4444,
  0xFF64748B,
];

/// الأيقونات (الإيموجي) الجاهزة لاختيار أيقونة المهمة — نفس مجموعة النموذج الأصلي.
const List<String> kTaskIconChoices = [
  '🙏',
  '📖',
  '🕌',
  '📿',
  '🧎',
  '🏃‍♂️',
  '🚴',
  '🏊',
  '🏋️',
  '⚽',
  '🧘',
  '😴',
  '💧',
  '🥗',
  '🍎',
  '🚭',
  '💊',
  '🩺',
  '🧠',
  '📚',
  '✍️',
  '🎓',
  '💻',
  '🖥️',
  '📊',
  '💼',
  '📞',
  '📧',
  '🗓️',
  '⏰',
  '🎯',
  '✅',
  '🎨',
  '🎵',
  '🎸',
  '📷',
  '🌱',
  '🧹',
  '🧺',
  '🚗',
  '💰',
  '💳',
  '📈',
  '🏠',
  '🛏️',
  '🚿',
  '👨‍👩‍👧‍👦',
  '❤️',
  '🤝',
];
