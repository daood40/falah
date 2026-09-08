// Tasbih: circular counter with targets 33/34/100, haptics, daily total.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/settings/settings.dart';
import '../../l10n/app_localizations.dart';

class TasbihScreen extends ConsumerWidget {
  const TasbihScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context)!;
    final state = ref.watch(tasbihProvider);
    final notifier = ref.read(tasbihProvider.notifier);
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: Text(t.tasbih_title)),
      body: ListView(
        padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 16, 24),
        children: [
          Text(
            t.tasbih_subtitle,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 16),
          Center(
            child: SizedBox(
              width: 230,
              height: 230,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CircularProgressIndicator(
                    value: state.target == 0 ? 0 : state.count / state.target,
                    strokeWidth: 10,
                    backgroundColor: scheme.surfaceContainerHighest,
                  ),
                  Material(
                    color: Colors.transparent,
                    shape: const CircleBorder(),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        notifier.tick();
                      },
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '${state.count}',
                              style: Theme.of(context).textTheme.displayMedium,
                            ),
                            Text(
                              '/ ${state.target}',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 8,
            children: [
              for (final target in const [33, 34, 100])
                ChoiceChip(
                  label: Text('$target'),
                  selected: state.target == target,
                  onSelected: (_) => notifier.setTarget(target),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Card(
            child: ListTile(
              leading: const Icon(Icons.today_outlined),
              title: Text(t.tasbih_today),
              trailing: Text(
                '${state.todayTotal}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: TextButton.icon(
              onPressed: notifier.reset,
              icon: const Icon(Icons.refresh),
              label: Text(t.tasbih_reset),
            ),
          ),
        ],
      ),
    );
  }
}
