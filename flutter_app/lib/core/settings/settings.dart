/// App settings (theme mode, locale) and the tasbih daily counter — persisted
/// in shared_preferences, exposed as Riverpod notifiers.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Loaded once at startup (main awaits it) and overridden into the scope.
final prefsProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError('overridden in main'),
);

class ThemeModeNotifier extends Notifier<ThemeMode> {
  static const _key = 'settings.themeMode';

  @override
  ThemeMode build() {
    final saved = ref.read(prefsProvider).getString(_key);
    return ThemeMode.values.where((m) => m.name == saved).firstOrNull ??
        ThemeMode.system;
  }

  Future<void> set(ThemeMode mode) async {
    state = mode;
    await ref.read(prefsProvider).setString(_key, mode.name);
  }
}

final themeModeProvider = NotifierProvider<ThemeModeNotifier, ThemeMode>(
  ThemeModeNotifier.new,
);

class LocaleNotifier extends Notifier<Locale> {
  static const _key = 'settings.locale';

  @override
  Locale build() {
    final saved = ref.read(prefsProvider).getString(_key);
    return saved == 'en' ? const Locale('en') : const Locale('ar');
  }

  Future<void> set(Locale locale) async {
    state = locale;
    await ref.read(prefsProvider).setString(_key, locale.languageCode);
  }
}

final localeProvider = NotifierProvider<LocaleNotifier, Locale>(
  LocaleNotifier.new,
);

/// Tasbih: current count within the round, target, and persisted daily total.
class TasbihState {
  final int count;
  final int target;
  final int todayTotal;
  const TasbihState({
    required this.count,
    required this.target,
    required this.todayTotal,
  });

  TasbihState copyWith({int? count, int? target, int? todayTotal}) =>
      TasbihState(
        count: count ?? this.count,
        target: target ?? this.target,
        todayTotal: todayTotal ?? this.todayTotal,
      );
}

class TasbihNotifier extends Notifier<TasbihState> {
  static const _targetKey = 'tasbih.target';

  String get _todayKey {
    final now = DateTime.now();
    final m = now.month.toString().padLeft(2, '0');
    final d = now.day.toString().padLeft(2, '0');
    return 'tasbih.total.${now.year}-$m-$d';
  }

  @override
  TasbihState build() {
    final prefs = ref.read(prefsProvider);
    return TasbihState(
      count: 0,
      target: prefs.getInt(_targetKey) ?? 33,
      todayTotal: prefs.getInt(_todayKey) ?? 0,
    );
  }

  Future<void> tick() async {
    final next = state.count + 1;
    final done = next >= state.target;
    state = state.copyWith(
      count: done ? 0 : next,
      todayTotal: state.todayTotal + 1,
    );
    await ref.read(prefsProvider).setInt(_todayKey, state.todayTotal);
  }

  Future<void> setTarget(int target) async {
    state = state.copyWith(target: target, count: 0);
    await ref.read(prefsProvider).setInt(_targetKey, target);
  }

  void reset() => state = state.copyWith(count: 0);
}

final tasbihProvider = NotifierProvider<TasbihNotifier, TasbihState>(
  TasbihNotifier.new,
);
