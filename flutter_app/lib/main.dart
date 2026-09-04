// FALAH — Flutter migration (stage M0).
// The live product remains the PWA until stage M4; this app grows behind it
// per MIGRATION.md. Sacred-text rules live in core/sourcelock (tested).
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/theme/tokens.dart';
import 'l10n/app_localizations.dart';

void main() => runApp(const FalahApp());

class FalahApp extends StatelessWidget {
  const FalahApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      onGenerateTitle: (context) => AppLocalizations.of(context)!.app_name,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('ar'), Locale('en')],
      locale: const Locale('ar'),
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: FlLight.bg,
        colorScheme: const ColorScheme.light(
          primary: FlLight.primary,
          onPrimary: FlLight.onPrimary,
          secondary: FlLight.accent,
          surface: FlLight.surface,
          onSurface: FlLight.text,
          error: FlLight.danger,
        ),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: FlDark.bg,
        colorScheme: const ColorScheme.dark(
          primary: FlDark.primary,
          onPrimary: FlDark.onPrimary,
          secondary: FlDark.accent,
          surface: FlDark.surface,
          onSurface: FlDark.text,
          error: FlDark.danger,
        ),
      ),
      home: const _M0Home(),
    );
  }
}

class _M0Home extends StatelessWidget {
  const _M0Home();

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(t.app_name)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(FlSpace.s5),
          child: Text(
            t.app_tagline,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleLarge,
          ),
        ),
      ),
    );
  }
}
