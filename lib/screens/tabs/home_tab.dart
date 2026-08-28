import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/app_state.dart';
import '../../widgets/common.dart';
import '../../widgets/task_detail_sheet.dart';
import '../../widgets/trend_chart.dart';
import '../shell_screen.dart';
import '../subscription_screen.dart';

/// تبويب الرئيسية: الجدول الشهري، منحنى الإنجازات، وحلقة نسبة الإنجاز.
class HomeTab extends StatefulWidget {
  const HomeTab({super.key, required this.query});

  final String query;

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  int _windowStart = 1;
  int? _windowMonthKey;

  static int _maxWindowStart(int dim) => 1 + 7 * ((dim - 1) ~/ 7);

  void _syncWindowWithMonth(MonthCursor cursor) {
    final key = cursor.year * 12 + cursor.month;
    if (_windowMonthKey == key) return;
    _windowMonthKey = key;
    final dim = AppState.daysInMonth(cursor.year, cursor.month);
    if (cursor.isCurrentMonth) {
      final start = 1 + 7 * ((DateTime.now().day - 1) ~/ 7);
      _windowStart = start.clamp(1, _maxWindowStart(dim));
    } else {
      _windowStart = 1;
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final cursor = context.watch<MonthCursor>();
    final s = AppStrings.of(state.lang);
    final wq = context.wq;

    _syncWindowWithMonth(cursor);

    final dim = AppState.daysInMonth(cursor.year, cursor.month);
    final maxStart = _maxWindowStart(dim);
    final windowEnd = (_windowStart + 6).clamp(1, dim);
    final today = DateTime.now();

    final query = widget.query.trim().toLowerCase();
    final tasks = query.isEmpty
        ? state.tasks
        : state.tasks
              .where((t) => t.name.toLowerCase().contains(query))
              .toList();

    final stats = state.monthStats(cursor.year, cursor.month);

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        if (!state.isPremium) ...[
          WqCard(
            onTap: () => SubscriptionScreen.push(context),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                const Text('💎', style: TextStyle(fontSize: 22)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        s.adBannerTitle,
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        s.adBannerSub,
                        style: TextStyle(fontSize: 12.5, color: wq.textMuted),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 5,
                    vertical: 1,
                  ),
                  decoration: BoxDecoration(
                    border: Border.all(color: wq.border),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    s.adBannerTag,
                    style: TextStyle(fontSize: 9.5, color: wq.textMuted),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
        ],
        Text(
          s.monthlySchedule,
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 4),
        Text(
          s.trackDesc,
          style: TextStyle(fontSize: 13.5, color: wq.textMuted),
        ),
        const SizedBox(height: 18),
        WqCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    WqIconButton(
                      onTap: () => cursor.shift(-1),
                      child: Icon(
                        Icons.chevron_left,
                        size: 20,
                        color: wq.text,
                        textDirection: TextDirection.ltr,
                      ),
                    ),
                    Text(
                      '${s.months[cursor.month - 1]} ${cursor.year}',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    WqIconButton(
                      onTap: () => cursor.shift(1),
                      child: Icon(
                        Icons.chevron_right,
                        size: 20,
                        color: wq.text,
                        textDirection: TextDirection.ltr,
                      ),
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: wq.border),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 10, 18, 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    WqIconButton(
                      onTap: _windowStart > 1
                          ? () => setState(
                              () => _windowStart = (_windowStart - 7).clamp(
                                1,
                                maxStart,
                              ),
                            )
                          : null,
                      child: Icon(
                        Icons.chevron_left,
                        size: 18,
                        color: wq.text,
                        textDirection: TextDirection.ltr,
                      ),
                    ),
                    Text(
                      '$_windowStart - $windowEnd / $dim',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: wq.textMuted,
                      ),
                    ),
                    WqIconButton(
                      onTap: _windowStart < maxStart
                          ? () => setState(
                              () => _windowStart = (_windowStart + 7).clamp(
                                1,
                                maxStart,
                              ),
                            )
                          : null,
                      child: Icon(
                        Icons.chevron_right,
                        size: 18,
                        color: wq.text,
                        textDirection: TextDirection.ltr,
                      ),
                    ),
                  ],
                ),
              ),
              if (tasks.isEmpty)
                EmptyHint(query.isNotEmpty ? s.noResults : s.noTasks)
              else
                Padding(
                  padding: const EdgeInsets.fromLTRB(10, 6, 10, 14),
                  child: _HabitGrid(
                    tasks: tasks,
                    year: cursor.year,
                    month: cursor.month,
                    windowStart: _windowStart,
                    windowEnd: windowEnd,
                    today: today,
                    strings: s,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        _Legend(strings: s),
        SectionTitle(s.dailyTrend),
        WqCard(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
          child: tasks.isEmpty && state.tasks.isEmpty
              ? EmptyHint(s.noData)
              : DailyTrendChart(
                  dailyCounts: state.dailyDoneCounts(cursor.year, cursor.month),
                  maxY: state.tasks.length,
                  todayIndex: cursor.isCurrentMonth ? today.day - 1 : -1,
                  axisLabel: s.tasksAxis,
                ),
        ),
        SectionTitle(s.completion),
        WqCard(
          padding: const EdgeInsets.all(18),
          child: Center(
            child: CompletionRing(pct: stats.pct, label: s.completion),
          ),
        ),
      ],
    );
  }
}

/// شبكة العادات: صف لكل مهمة، وعمود لكل يوم من نافذة الأسبوع المعروضة.
class _HabitGrid extends StatelessWidget {
  const _HabitGrid({
    required this.tasks,
    required this.year,
    required this.month,
    required this.windowStart,
    required this.windowEnd,
    required this.today,
    required this.strings,
  });

  final List<TaskItem> tasks;
  final int year;
  final int month;
  final int windowStart;
  final int windowEnd;
  final DateTime today;
  final AppStrings strings;

  @override
  Widget build(BuildContext context) {
    final state = context.read<AppState>();
    final wq = context.wq;
    final isCurrentMonth = year == today.year && month == today.month;
    final days = [for (var d = windowStart; d <= windowEnd; d++) d];

    return Column(
      children: [
        // صف رؤوس الأيام.
        Row(
          children: [
            const SizedBox(width: 46, child: Center(child: Text('📋'))),
            for (final d in days)
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: wq.surfaceAlt,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  margin: const EdgeInsets.symmetric(horizontal: 1),
                  child: Column(
                    children: [
                      Text(
                        strings.weekdaysShort[DateTime(year, month, d).weekday %
                            7],
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: isCurrentMonth && d == today.day
                              ? wq.primaryDark
                              : wq.textMuted,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '$d',
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w800,
                          color: isCurrentMonth && d == today.day
                              ? wq.primaryDark
                              : wq.text,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 6),
        for (final task in tasks)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                SizedBox(
                  width: 46,
                  child: Center(
                    child: TaskIconBox(
                      task: task,
                      onTap: () => showTaskDetailSheet(
                        context,
                        taskId: task.id,
                        year: year,
                        month: month,
                      ),
                    ),
                  ),
                ),
                for (final d in days)
                  Expanded(
                    child: Center(
                      child: Builder(
                        builder: (context) {
                          final date = DateTime(year, month, d);
                          final applicable = task.isApplicableOn(date);
                          return StatusDot(
                            status: task.statusOn(date),
                            applicable: applicable,
                            onTap: applicable
                                ? () => state.cycleStatus(task.id, date)
                                : null,
                          );
                        },
                      ),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.strings});

  final AppStrings strings;

  @override
  Widget build(BuildContext context) {
    final wq = context.wq;

    Widget item(Color color, String label, {bool outlined = false}) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 14,
            height: 14,
            decoration: BoxDecoration(
              color: outlined ? Colors.transparent : color,
              shape: BoxShape.circle,
              border: outlined ? Border.all(color: color, width: 2) : null,
            ),
          ),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(fontSize: 12.5, color: wq.textMuted)),
        ],
      );
    }

    return Wrap(
      spacing: 18,
      runSpacing: 8,
      alignment: WrapAlignment.center,
      children: [
        item(wq.done, strings.done),
        item(wq.late, strings.late),
        item(wq.missed, strings.missed),
        item(wq.none, strings.none, outlined: true),
      ],
    );
  }
}
