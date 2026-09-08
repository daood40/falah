// FALAH — Flutter migration (M1: reading core).
// The live product remains the PWA until stage M4 (MIGRATION.md).
// Sacred-text rules live in core/sourcelock and are unit-tested.
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app/router.dart';
import 'core/settings/settings.dart';
import 'core/theme/tokens.dart';
import 'l10n/app_localizations.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  runApp(
    ProviderScope(
      overrides: [prefsProvider.overrideWithValue(prefs)],
      child: const FalahApp(),
    ),
  );
}

class FalahApp extends ConsumerWidget {
  const FalahApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);
    final locale = ref.watch(localeProvider);

    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context)!.app_name,
      routerConfig: router,
      themeMode: themeMode,
      locale: locale,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('ar'), Locale('en')],
      theme: _theme(Brightness.light),
      darkTheme: _theme(Brightness.dark),
    );
  }
}

/// Old-paper (light) / leather (dark) theme built strictly from FlLight/FlDark
/// tokens — never ColorScheme.fromSeed (repo rule).
ThemeData _theme(Brightness brightness) {
  final light = brightness == Brightness.light;
  final scheme = light
      ? const ColorScheme.light(
          primary: FlLight.primary,
          onPrimary: FlLight.onPrimary,
          secondary: FlLight.accent,
          onSecondary: FlLight.text,
          surface: FlLight.surface,
          onSurface: FlLight.text,
          surfaceContainerHighest: FlLight.surface2,
          outline: FlLight.border,
          error: FlLight.danger,
        )
      : const ColorScheme.dark(
          primary: FlDark.primary,
          onPrimary: FlDark.onPrimary,
          secondary: FlDark.accent,
          onSecondary: FlDark.text,
          surface: FlDark.surface,
          onSurface: FlDark.text,
          surfaceContainerHighest: FlDark.surface2,
          outline: FlDark.border,
          error: FlDark.danger,
        );
  return ThemeData(
    useMaterial3: true,
    fontFamily: 'Cairo',
    // Arabic needs extra line height or descenders/diacritics clip.
    textTheme: const TextTheme(
      bodyLarge: TextStyle(height: 1.7),
      bodyMedium: TextStyle(height: 1.7),
      bodySmall: TextStyle(height: 1.6),
      titleMedium: TextStyle(height: 1.5),
    ),
    colorScheme: scheme,
    scaffoldBackgroundColor: light ? FlLight.bg : FlDark.bg,
    appBarTheme: AppBarTheme(
      backgroundColor: light ? FlLight.surface : FlDark.surface,
      foregroundColor: light ? FlLight.text : FlDark.text,
      elevation: 0,
    ),
    cardTheme: CardThemeData(
      color: light ? FlLight.surface : FlDark.surface,
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(FlRadius.lg),
        side: BorderSide(color: light ? FlLight.border : FlDark.border),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: light ? FlLight.surface : FlDark.surface,
      indicatorColor: (light ? FlLight.primary : FlDark.primary).withValues(
        alpha: 0.15,
      ),
    ),
  );
}
