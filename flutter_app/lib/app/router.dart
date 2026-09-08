// go_router with StatefulShellRoute: each tab keeps its own stack.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/home/home_screen.dart';
import '../features/quran/presentation/surah_list_screen.dart';
import '../features/quran/presentation/surah_reader_screen.dart';
import '../features/settings/settings_screen.dart';
import '../features/tasbih/tasbih_screen.dart';
import '../l10n/app_localizations.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => _ShellScaffold(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/',
                name: 'home',
                builder: (c, s) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/quran',
                name: 'quran',
                builder: (c, s) => const SurahListScreen(),
                routes: [
                  GoRoute(
                    path: ':n',
                    name: 'surah',
                    builder: (c, s) => SurahReaderScreen(
                      surah: int.tryParse(s.pathParameters['n'] ?? '') ?? 1,
                      initialAyah: s.extra is int ? s.extra as int : null,
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/tasbih',
                name: 'tasbih',
                builder: (c, s) => const TasbihScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/settings',
                name: 'settings',
                builder: (c, s) => const SettingsScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});

class _ShellScaffold extends StatelessWidget {
  const _ShellScaffold({required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (i) =>
            shell.goBranch(i, initialLocation: i == shell.currentIndex),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home),
            label: t.nav_home,
          ),
          NavigationDestination(
            icon: const Icon(Icons.menu_book_outlined),
            selectedIcon: const Icon(Icons.menu_book),
            label: t.create_quran,
          ),
          NavigationDestination(
            icon: const Icon(Icons.radio_button_unchecked),
            selectedIcon: const Icon(Icons.radio_button_checked),
            label: t.tasbih_title,
          ),
          NavigationDestination(
            icon: const Icon(Icons.settings_outlined),
            selectedIcon: const Icon(Icons.settings),
            label: t.nav_settings,
          ),
        ],
      ),
    );
  }
}
