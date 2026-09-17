// go_router with StatefulShellRoute: each tab keeps its own stack.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/azkar/azkar_screen.dart';
import '../features/home/home_screen.dart';
import '../features/hadith/data/hadith_providers.dart';
import '../features/hadith/presentation/hadith_books_screen.dart';
import '../features/hadith/presentation/hadith_chapters_screen.dart';
import '../features/hadith/presentation/hadith_detail_screen.dart';
import '../features/hadith/presentation/hadith_list_screen.dart';
import '../features/hadith/presentation/hadith_search_screen.dart';
import '../features/quran/presentation/surah_list_screen.dart';
import '../features/quran/presentation/surah_reader_screen.dart';
import '../features/settings/settings_screen.dart';
import '../features/tasbih/tasbih_screen.dart';
import '../core/theme/tokens.dart';
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
                path: '/hadith',
                name: 'hadith',
                builder: (c, s) => const HadithBooksScreen(),
                routes: [
                  GoRoute(
                    path: 'search',
                    name: 'hadithSearch',
                    builder: (c, s) => const HadithSearchScreen(),
                  ),
                  GoRoute(
                    path: 'all',
                    name: 'hadithAll',
                    builder: (c, s) => const HadithListScreen(
                      query: HadithListQuery(HadithListKind.all),
                    ),
                  ),
                  GoRoute(
                    path: 'book/:bookId',
                    name: 'hadithChapters',
                    builder: (c, s) => HadithChaptersScreen(
                      bookId: s.pathParameters['bookId']!,
                      bookName: s.extra as String?,
                    ),
                    routes: [
                      GoRoute(
                        path: 'hadiths',
                        name: 'hadithBookList',
                        builder: (c, s) => HadithListScreen(
                          query: HadithListQuery(
                            HadithListKind.book,
                            s.pathParameters['bookId']!,
                          ),
                          title: s.extra as String?,
                        ),
                      ),
                    ],
                  ),
                  GoRoute(
                    path: 'chapter/:chapterId',
                    name: 'hadithChapterList',
                    builder: (c, s) => HadithListScreen(
                      query: HadithListQuery(
                        HadithListKind.chapter,
                        s.pathParameters['chapterId']!,
                      ),
                      title: s.extra as String?,
                    ),
                  ),
                  GoRoute(
                    path: 'item/:id',
                    name: 'hadithDetail',
                    builder: (c, s) => HadithDetailScreen(id: s.pathParameters['id']!),
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
                routes: [
                  GoRoute(
                    path: 'azkar',
                    name: 'azkar',
                    builder: (c, s) => const AzkarScreen(),
                  ),
                ],
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
      // Keep reading lines comfortable on wide (web/desktop) viewports.
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: FlLayout.readingMax),
          child: shell,
        ),
      ),
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
            icon: const Icon(Icons.format_quote_outlined),
            selectedIcon: const Icon(Icons.format_quote),
            label: t.hadith_title,
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
