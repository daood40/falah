import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'core/theme.dart';
import 'screens/auth_screen.dart';
import 'screens/shell_screen.dart';
import 'state/app_state.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final appState = await AppState.load();
  runApp(WaqtiApp(appState: appState));
}

/// تطبيق "وقتي" — تتبع المهام والعادات اليومية.
class WaqtiApp extends StatelessWidget {
  const WaqtiApp({super.key, required this.appState});

  final AppState appState;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: appState,
      child: Consumer<AppState>(
        builder: (context, state, _) => MaterialApp(
          title: 'وقتي',
          debugShowCheckedModeBanner: false,
          theme: WaqtiTheme.light(),
          darkTheme: WaqtiTheme.dark(),
          themeMode: state.themeMode,
          locale: Locale(state.lang),
          supportedLocales: const [Locale('ar'), Locale('en')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: state.loggedIn ? const ShellScreen() : const AuthScreen(),
        ),
      ),
    );
  }
}
