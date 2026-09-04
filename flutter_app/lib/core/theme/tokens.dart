/// FALAH Design Tokens — ported 1:1 from the PWA's tokens.css.
/// Single source of truth for all styling; no hard-coded colors elsewhere.
library;

import 'dart:ui';

abstract final class FlBrand {
  static const green900 = Color(0xFF06281F);
  static const green800 = Color(0xFF083B2D);
  static const green700 = Color(0xFF0E5C46);
  static const green600 = Color(0xFF12744F);
  static const green500 = Color(0xFF178A60);
  static const green100 = Color(0xFFD9EFE6);
  static const green50 = Color(0xFFEEF8F3);
  static const gold600 = Color(0xFFB08D24);
  static const gold500 = Color(0xFFD4AF37);
  static const gold100 = Color(0xFFF6ECC9);
  static const cream = Color(0xFFF8F5EC);
}

/// Light theme: aged paper (parchment ground, sepia ink).
abstract final class FlLight {
  static const bg = Color(0xFFECE1C8);
  static const surface = Color(0xFFF6EEDB);
  static const surface2 = Color(0xFFE9DCBE);
  static const surface3 = Color(0xFFDCCAA4);
  static const text = Color(0xFF2E2414);
  static const text2 = Color(0xFF615133);
  static const text3 = Color(0xFF8D7C59);
  static const border = Color(0xFFD3C19B);
  static const primary = FlBrand.green700;
  static const primaryHover = FlBrand.green600;
  static const onPrimary = Color(0xFFF8F5EC);
  static const accent = FlBrand.gold600;
  static const danger = Color(0xFFA53A28);
  static const warning = Color(0xFF96660A);
  static const success = Color(0xFF17734F);
  static const info = Color(0xFF1A5F8A);
}

/// Dark theme: old leather binding (warm browns, parchment-toned ink).
abstract final class FlDark {
  static const bg = Color(0xFF171106);
  static const surface = Color(0xFF221A0C);
  static const surface2 = Color(0xFF2D2312);
  static const surface3 = Color(0xFF3A2E19);
  static const text = Color(0xFFF0E6CF);
  static const text2 = Color(0xFFC4B28C);
  static const text3 = Color(0xFF8F7E5D);
  static const border = Color(0xFF42351D);
  static const primary = FlBrand.green500;
  static const primaryHover = Color(0xFF1DA06F);
  static const onPrimary = FlBrand.green900;
  static const accent = FlBrand.gold500;
  static const danger = Color(0xFFE06158);
  static const warning = Color(0xFFD99A2B);
  static const success = Color(0xFF2FAE7D);
  static const info = Color(0xFF4D9FD0);
}

abstract final class FlSpace {
  static const s1 = 4.0;
  static const s2 = 8.0;
  static const s3 = 12.0;
  static const s4 = 16.0;
  static const s5 = 24.0;
  static const s6 = 32.0;
  static const s7 = 48.0;
  static const s8 = 64.0;
}

abstract final class FlRadius {
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 24.0;
}

abstract final class FlLayout {
  static const touchMin = 44.0;
  static const contentMax = 1200.0;
}
