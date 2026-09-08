// Home: greeting, verified verse of the day, navigation cards.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../l10n/app_localizations.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    final verse = ref.watch(verseOfDayProvider);
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: Text(t.app_name)),
      body: ListView(
        padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 16, 24),
        children: [
          Card(
            color: scheme.primary,
            child: Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(16, 18, 16, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    t.home_welcome,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: scheme.onPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    t.app_tagline,
                    style: TextStyle(
                      color: scheme.onPrimary.withValues(alpha: 0.85),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            t.home_verseOfDay,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          verse.when(
            loading: () => const Card(
              child: Padding(
                padding: EdgeInsetsDirectional.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
            ),
            error: (e, _) => Card(
              child: Padding(
                padding: const EdgeInsetsDirectional.all(16),
                child: Text(t.errors_unknown),
              ),
            ),
            data: (r) => Card(
              child: InkWell(
                onTap: () => context.goNamed(
                  'surah',
                  pathParameters: {'n': '${r.ayah.surah}'},
                  extra: r.ayah.ayah,
                ),
                child: Padding(
                  padding: const EdgeInsetsDirectional.fromSTEB(16, 14, 16, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        '${r.ayah.text} ﴿${r.ayah.ayah}﴾',
                        textDirection: TextDirection.rtl,
                        style: const TextStyle(
                          fontFamily: 'AmiriQuran',
                          fontSize: 21,
                          height: 2,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Icon(
                            Icons.verified_outlined,
                            size: 15,
                            color: scheme.secondary,
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              '${r.surahName} ${r.ayah.ayah} · ${t.source_verified}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _NavCard(
                  icon: Icons.menu_book_outlined,
                  label: t.create_quran,
                  onTap: () => context.go('/quran'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _NavCard(
                  icon: Icons.radio_button_checked,
                  label: t.tasbih_title,
                  onTap: () => context.go('/tasbih'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _NavCard(
                  icon: Icons.auto_stories_outlined,
                  label: t.azkar_title,
                  onTap: () => context.go('/tasbih/azkar'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _NavCard extends StatelessWidget {
  const _NavCard({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(12, 18, 12, 18),
          child: Column(
            children: [
              Icon(
                icon,
                size: 28,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: 8),
              Text(label, textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }
}
