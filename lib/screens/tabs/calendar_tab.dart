import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/app_state.dart';
import '../../widgets/common.dart';
import '../shell_screen.dart';

/// تبويب التقويم: شبكة الشهر مع ملخص إنجاز كل يوم.
class CalendarTab extends StatelessWidget {
  const CalendarTab({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final cursor = context.watch<MonthCursor>();
    final s = AppStrings.of(state.lang);
    final wq = context.wq;

    final dim = AppState.daysInMonth(cursor.year, cursor.month);
    final firstWeekday = DateTime(cursor.year, cursor.month, 1).weekday % 7;
    final today = DateTime.now();

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        SectionTitle(s.calendar, topPadding: 0),
        WqCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Row(
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
              const SizedBox(height: 14),
              Row(
                children: [
                  for (var i = 0; i < 7; i++)
                    Expanded(
                      child: Center(
                        child: Text(
                          s.weekdaysShort[i],
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: wq.textMuted,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 7,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 0.72,
                ),
                itemCount: firstWeekday + dim,
                itemBuilder: (context, index) {
                  if (index < firstWeekday) return const SizedBox.shrink();
                  final day = index - firstWeekday + 1;
                  final date = DateTime(cursor.year, cursor.month, day);
                  final isToday = cursor.isCurrentMonth && day == today.day;
                  final dayTasks = state.tasks
                      .where((t) => t.isApplicableOn(date))
                      .toList(growable: false);
                  final doneCount = dayTasks
                      .where((t) => t.statusOn(date) == TaskStatus.done)
                      .length;

                  return Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: wq.surface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isToday ? wq.primary : wq.border,
                        width: isToday ? 2 : 1,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '$day',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: isToday ? wq.primaryDark : wq.text,
                          ),
                        ),
                        if (dayTasks.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(
                            '$doneCount/${dayTasks.length}',
                            style: TextStyle(
                              fontSize: 9.5,
                              color: wq.textMuted,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Expanded(
                            child: Wrap(
                              spacing: 2,
                              runSpacing: 2,
                              children: [
                                for (final t in dayTasks.take(6))
                                  Container(
                                    width: 6,
                                    height: 6,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: switch (t.statusOn(date)) {
                                        TaskStatus.done => wq.done,
                                        TaskStatus.doneLate => wq.late,
                                        TaskStatus.missed => wq.missed,
                                        null => wq.none,
                                      },
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}
