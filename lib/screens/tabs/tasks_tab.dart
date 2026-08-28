import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/app_state.dart';
import '../../widgets/category_manager_sheet.dart';
import '../../widgets/common.dart';
import '../../widgets/task_detail_sheet.dart';
import '../../widgets/task_editor_sheet.dart';
import '../shell_screen.dart';

/// تبويب المهام والعادات: القائمة الكاملة مع الإدارة
/// وإعادة الترتيب بالسحب والإفلات.
class TasksTab extends StatelessWidget {
  const TasksTab({super.key, required this.query});

  final String query;

  Future<void> _deleteWithUndo(
    BuildContext context,
    AppState state,
    AppStrings s,
    TaskItem task,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(s.delete),
        content: Text(s.deleteTaskConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(s.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: context.wq.missed),
            child: Text(s.delete),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    final removed = state.removeTask(task.id);
    if (removed == null) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(s.taskDeleted),
        action: SnackBarAction(
          label: s.undo,
          onPressed: () => state.restoreTask(removed.$1, removed.$2),
        ),
      ),
    );
  }

  String _recurrenceLabel(Recurrence recurrence, AppStrings s) =>
      switch (recurrence.type) {
        RecurrenceType.daily => s.daily,
        RecurrenceType.weekly => s.weekly,
        RecurrenceType.monthly => s.monthly,
        RecurrenceType.specificDays => s.specificDays,
        RecurrenceType.once => s.once,
      };

  Widget _header(BuildContext context, AppState state, AppStrings s) {
    final wq = context.wq;
    final showReorderHint = query.trim().isEmpty && state.tasks.length > 1;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                s.tasks,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            FilledButton(
              onPressed: () => showCategoryManagerSheet(context),
              child: Text(
                '🏷️ ${s.categoriesManage}',
                style: const TextStyle(fontSize: 12),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: () => showTaskEditorSheet(context),
              child: Text(
                '＋ ${s.addTask}',
                style: const TextStyle(fontSize: 12),
              ),
            ),
          ],
        ),
        if (showReorderHint)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              s.reorderHint,
              style: TextStyle(fontSize: 11.5, color: wq.textMuted),
            ),
          ),
        const SizedBox(height: 12),
      ],
    );
  }

  Widget _taskCard(
    BuildContext context,
    AppState state,
    MonthCursor cursor,
    AppStrings s,
    TaskItem task,
  ) {
    final wq = context.wq;
    return Padding(
      key: ValueKey(task.id),
      padding: const EdgeInsets.only(bottom: 10),
      child: WqCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            TaskIconBox(task: task, size: 38, fontSize: 18),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    task.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      if (state.categoryById(task.categoryId)
                          case final category?)
                        WqChip(
                          category.name,
                          color: Color(category.colorValue),
                        ),
                      WqChip(_recurrenceLabel(task.recurrence, s)),
                      WqChip(switch (task.priority) {
                        TaskPriority.low => s.low,
                        TaskPriority.medium => s.medium,
                        TaskPriority.high => s.high,
                      }),
                    ],
                  ),
                ],
              ),
            ),
            WqIconButton(
              tooltip: s.taskDetails,
              onTap: () => showTaskDetailSheet(
                context,
                taskId: task.id,
                year: cursor.year,
                month: cursor.month,
              ),
              child: Icon(
                Icons.insights_rounded,
                size: 17,
                color: wq.textMuted,
              ),
            ),
            const SizedBox(width: 6),
            WqIconButton(
              tooltip: s.editTask,
              onTap: () => showTaskEditorSheet(context, existing: task),
              child: Icon(Icons.edit_outlined, size: 17, color: wq.textMuted),
            ),
            const SizedBox(width: 6),
            WqIconButton(
              tooltip: s.delete,
              onTap: () => _deleteWithUndo(context, state, s, task),
              child: Icon(Icons.delete_outline, size: 17, color: wq.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final cursor = context.watch<MonthCursor>();
    final s = AppStrings.of(state.lang);

    final trimmed = query.trim().toLowerCase();
    final searching = trimmed.isNotEmpty;
    final tasks = searching
        ? state.tasks
              .where(
                (t) =>
                    t.name.toLowerCase().contains(trimmed) ||
                    t.description.toLowerCase().contains(trimmed),
              )
              .toList()
        : state.tasks;

    const padding = EdgeInsets.fromLTRB(18, 8, 18, 24);

    if (tasks.isEmpty) {
      return ListView(
        padding: padding,
        children: [
          _header(context, state, s),
          WqCard(child: EmptyHint(searching ? s.noResults : s.noTasks)),
        ],
      );
    }

    if (searching) {
      return ListView(
        padding: padding,
        children: [
          _header(context, state, s),
          for (final task in tasks) _taskCard(context, state, cursor, s, task),
        ],
      );
    }

    // بدون بحث: قائمة قابلة لإعادة الترتيب بالسحب.
    return ReorderableListView(
      padding: padding,
      header: _header(context, state, s),
      onReorder: state.reorderTask,
      proxyDecorator: (child, index, animation) =>
          Material(color: Colors.transparent, child: child),
      children: [
        for (final task in tasks) _taskCard(context, state, cursor, s, task),
      ],
    );
  }
}
