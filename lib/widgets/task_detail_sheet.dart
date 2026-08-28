import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/l10n.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../state/app_state.dart';
import 'common.dart';
import 'task_editor_sheet.dart';

/// نافذة تفاصيل مهمة: نسبة الالتزام، مرات الإنجاز والتفويت،
/// وسجل الشهر المعروض.
Future<void> showTaskDetailSheet(
  BuildContext context, {
  required String taskId,
  required int year,
  required int month,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => TaskDetailSheet(taskId: taskId, year: year, month: month),
  );
}

class TaskDetailSheet extends StatelessWidget {
  const TaskDetailSheet({
    super.key,
    required this.taskId,
    required this.year,
    required this.month,
  });

  final String taskId;
  final int year;
  final int month;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final s = AppStrings.of(state.lang);
    final wq = context.wq;
    final task = state.taskById(taskId);
    if (task == null) return const SizedBox.shrink();

    final dim = AppState.daysInMonth(year, month);
    var done = 0, missed = 0, applicable = 0;
    final history = <({int day, TaskStatus status})>[];
    for (var d = 1; d <= dim; d++) {
      final date = DateTime(year, month, d);
      if (!task.isApplicableOn(date)) continue;
      applicable++;
      final status = task.statusOn(date);
      if (status == TaskStatus.done) done++;
      if (status == TaskStatus.missed) missed++;
      if (status != null) history.add((day: d, status: status));
    }
    final pct = applicable > 0 ? ((done / applicable) * 100).round() : 0;

    return ListView(
      shrinkWrap: true,
      padding: const EdgeInsets.fromLTRB(22, 12, 22, 22),
      children: [
        Center(
          child: Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: wq.none,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            TaskIconBox(task: task, size: 38, fontSize: 18),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                task.name,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
        if (task.description.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            task.description,
            style: TextStyle(fontSize: 13, color: wq.textMuted),
          ),
        ],
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _MiniStat(value: '$pct%', label: s.commitment),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _MiniStat(value: '$done', label: s.doneCount),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _MiniStat(value: '$missed', label: s.missedCount),
            ),
          ],
        ),
        const SizedBox(height: 16),
        LevelBar(pct: pct, color: Color(task.colorValue)),
        const SizedBox(height: 16),
        Text(
          s.history,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: wq.textMuted,
          ),
        ),
        const SizedBox(height: 8),
        if (history.isEmpty)
          Text(s.noData, style: TextStyle(fontSize: 13, color: wq.textMuted))
        else
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final entry in history)
                Tooltip(
                  message: '${entry.day}',
                  child: StatusDot(status: entry.status),
                ),
            ],
          ),
        const SizedBox(height: 18),
        Row(
          children: [
            Expanded(
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text(s.close),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  showTaskEditorSheet(context, existing: task);
                },
                child: Text(s.editTask),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return WqCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11, color: context.wq.textMuted),
          ),
        ],
      ),
    );
  }
}
