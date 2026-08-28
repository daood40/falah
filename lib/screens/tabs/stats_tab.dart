import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n.dart';
import '../../core/theme.dart';
import '../../state/app_state.dart';
import '../../widgets/common.dart';
import '../../widgets/trend_chart.dart';
import '../../widgets/year_heatmap.dart';
import '../shell_screen.dart';

/// تبويب الإحصائيات: ملخص الشهر، أفضل/أضعف عادة،
/// الأعمدة الأسبوعية، والتزام كل مهمة.
class StatsTab extends StatelessWidget {
  const StatsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final cursor = context.watch<MonthCursor>();
    final s = AppStrings.of(state.lang);
    final wq = context.wq;

    final stats = state.monthStats(cursor.year, cursor.month);
    final streak = state.currentStreak();
    final xp = state.totalXp();
    final best = state.bestHabit(cursor.year, cursor.month);
    final worst = state.worstHabit(cursor.year, cursor.month);
    final weeks = state.weeklyBuckets(cursor.year, cursor.month);

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        SectionTitle(
          s.stats,
          topPadding: 0,
          trailing: Text(
            '${s.months[cursor.month - 1]} ${cursor.year}',
            style: TextStyle(fontSize: 13, color: wq.textMuted),
          ),
        ),
        Row(
          children: [
            Expanded(
              child: StatCard(
                icon: '✅',
                value: '${stats.done}',
                label: s.completed,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: StatCard(
                icon: '📋',
                value: '${stats.remaining}',
                label: s.remaining,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: StatCard(icon: '🔥', value: '$streak', label: s.streak),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: StatCard(icon: '⭐', value: '$xp', label: s.xp),
            ),
          ],
        ),
        const SizedBox(height: 14),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _InfoBox(value: '${stats.pct}%', label: s.avgCompletion),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _InfoBox(value: '$streak', label: s.bestStreak),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _InfoBox(
                  value: best == null
                      ? '—'
                      : '${best.task.icon} ${best.task.name} (${best.pct}%)',
                  label: s.bestHabit,
                  small: true,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _InfoBox(
                  value: worst == null
                      ? '—'
                      : '${worst.task.icon} ${worst.task.name} (${worst.pct}%)',
                  label: s.worstHabit,
                  small: true,
                ),
              ),
            ],
          ),
        ),
        SectionTitle(s.weeklyChart),
        WqCard(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
          child: weeks.every((w) => w.pct == 0)
              ? EmptyHint(s.noData)
              : WeeklyBars(buckets: weeks),
        ),
        SectionTitle(
          s.yearHeatmap,
          trailing: Text(
            '${cursor.year}',
            style: TextStyle(fontSize: 13, color: wq.textMuted),
          ),
        ),
        WqCard(
          padding: const EdgeInsets.all(16),
          child: state.tasks.isEmpty
              ? EmptyHint(s.noData)
              : YearHeatmap(
                  year: cursor.year,
                  pctForDate: state.dailyCompletionPct,
                  monthLabels: s.months,
                  lessLabel: s.heatmapLegendLess,
                  moreLabel: s.heatmapLegendMore,
                ),
        ),
        SectionTitle(s.tasks),
        WqCard(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: state.tasks.isEmpty
              ? EmptyHint(s.noTasks)
              : Column(
                  children: [
                    for (final task in state.tasks) ...[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              '${task.icon} ${task.name}',
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12.5),
                            ),
                          ),
                          Text(
                            '${state.taskCommitment(task, cursor.year, cursor.month)}%',
                            style: TextStyle(
                              fontSize: 12.5,
                              color: wq.textMuted,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      LevelBar(
                        pct: state.taskCommitment(
                          task,
                          cursor.year,
                          cursor.month,
                        ),
                        color: Color(task.colorValue),
                      ),
                      if (task != state.tasks.last) const SizedBox(height: 12),
                    ],
                  ],
                ),
        ),
      ],
    );
  }
}

class _InfoBox extends StatelessWidget {
  const _InfoBox({
    required this.value,
    required this.label,
    this.small = false,
  });

  final String value;
  final String label;
  final bool small;

  @override
  Widget build(BuildContext context) {
    return WqCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: small ? 13.5 : 20,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(fontSize: 12, color: context.wq.textMuted),
          ),
        ],
      ),
    );
  }
}
