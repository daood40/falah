import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:waqti/models/models.dart';
import 'package:waqti/state/app_state.dart';

Future<AppState> freshState() async {
  SharedPreferences.setMockInitialValues({});
  return AppState.load();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('starts with default categories and no tasks', () async {
    final state = await freshState();
    expect(state.categories, hasLength(4));
    expect(state.tasks, isEmpty);
    expect(state.loggedIn, isFalse);
  });

  test('free plan allows at most 5 tasks; premium is unlimited', () async {
    final state = await freshState();
    for (var i = 0; i < 5; i++) {
      expect(state.addTask(TaskItem(id: 't$i', name: 'مهمة $i')), isTrue);
    }
    expect(state.addTask(TaskItem(id: 't5', name: 'زيادة')), isFalse);
    state.setPremium(true);
    expect(state.addTask(TaskItem(id: 't5', name: 'زيادة')), isTrue);
  });

  test('cycleStatus cycles pending → done → late → missed → pending', () async {
    final state = await freshState();
    final task = TaskItem(id: 't1', name: 'قراءة');
    state.addTask(task);
    final date = DateTime(2026, 8, 10);

    state.cycleStatus('t1', date);
    expect(task.statusOn(date), TaskStatus.done);
    state.cycleStatus('t1', date);
    expect(task.statusOn(date), TaskStatus.doneLate);
    state.cycleStatus('t1', date);
    expect(task.statusOn(date), TaskStatus.missed);
    state.cycleStatus('t1', date);
    expect(task.statusOn(date), isNull);
  });

  test('monthStats counts applicable and done occurrences', () async {
    final state = await freshState();
    final task = TaskItem(id: 't1', name: 'قراءة');
    state.addTask(task);
    task.setStatusOn(DateTime(2026, 8, 1), TaskStatus.done);
    task.setStatusOn(DateTime(2026, 8, 2), TaskStatus.doneLate);
    task.setStatusOn(DateTime(2026, 8, 3), TaskStatus.missed);

    final stats = state.monthStats(2026, 8);
    expect(stats.applicable, 31);
    expect(stats.done, 1);
    expect(stats.late, 1);
    expect(stats.missed, 1);
    expect(stats.pct, ((1 / 31) * 100).round());
  });

  test('XP: 10 per done, 4 per late', () async {
    final state = await freshState();
    final task = TaskItem(id: 't1', name: 'قراءة');
    state.addTask(task);
    task.setStatusOn(DateTime(2026, 8, 1), TaskStatus.done);
    task.setStatusOn(DateTime(2026, 8, 2), TaskStatus.done);
    task.setStatusOn(DateTime(2026, 8, 3), TaskStatus.doneLate);
    task.setStatusOn(DateTime(2026, 8, 4), TaskStatus.missed);
    expect(state.totalXp(), 24);
  });

  test('streak counts consecutive fully-done days ending today', () async {
    final state = await freshState();
    final task = TaskItem(id: 't1', name: 'قراءة');
    state.addTask(task);
    final today = DateTime.now();
    for (var i = 0; i < 3; i++) {
      task.setStatusOn(today.subtract(Duration(days: i)), TaskStatus.done);
    }
    expect(state.currentStreak(), 3);

    // يوم مفقود قبلها يقطع التتابع عند 3.
    task.setStatusOn(
      today.subtract(const Duration(days: 3)),
      TaskStatus.missed,
    );
    expect(state.currentStreak(), 3);
  });

  test('removing a category unlinks its tasks', () async {
    final state = await freshState();
    final category = state.addCategory('عمل', 0xFF123456);
    final task = TaskItem(id: 't1', name: 'اجتماع', categoryId: category.id);
    state.addTask(task);
    state.removeCategory(category.id);
    expect(task.categoryId, isNull);
    expect(state.categoryById(category.id), isNull);
  });

  test('export/import round-trip preserves tasks and categories', () async {
    final state = await freshState();
    state.addTask(
      TaskItem(id: 't1', name: 'قراءة')
        ..setStatusOn(DateTime(2026, 8, 1), TaskStatus.done),
    );
    final exported = state.exportJson();

    final other = await freshState();
    expect(other.importJson(exported), isTrue);
    expect(other.tasks, hasLength(1));
    expect(other.tasks.first.name, 'قراءة');
    expect(other.tasks.first.statusOn(DateTime(2026, 8, 1)), TaskStatus.done);
    expect(other.importJson('ليس JSON'), isFalse);
  });

  test('remove/restore task supports undo', () async {
    final state = await freshState();
    state.addTask(TaskItem(id: 't1', name: 'أ'));
    state.addTask(TaskItem(id: 't2', name: 'ب'));
    final removed = state.removeTask('t1');
    expect(removed, isNotNull);
    expect(state.tasks, hasLength(1));
    state.restoreTask(removed!.$1, removed.$2);
    expect(state.tasks, hasLength(2));
    expect(state.tasks.first.id, 't1');
  });

  // ---------- اختبارات إضافية للمزايا الجديدة ----------

  test('seedDemoData seeds within the free plan limit and only once', () async {
    final state = await freshState();
    state.seedDemoData();
    expect(state.tasks, hasLength(5));
    expect(state.tasks.length <= AppState.freePlanTaskLimit, isTrue);
    state.seedDemoData(); // لا تُزرع مرة ثانية فوق بيانات موجودة.
    expect(state.tasks, hasLength(5));
  });

  test('reorderTask moves a task and persists order', () async {
    final state = await freshState();
    state.addTask(TaskItem(id: 'a', name: 'أ'));
    state.addTask(TaskItem(id: 'b', name: 'ب'));
    state.addTask(TaskItem(id: 'c', name: 'ج'));
    state.reorderTask(0, 3); // كما يرسلها ReorderableListView
    expect(state.tasks.map((t) => t.id).toList(), ['b', 'c', 'a']);
    state.reorderTask(2, 0);
    expect(state.tasks.map((t) => t.id).toList(), ['a', 'b', 'c']);
  });

  test('dailyCompletionPct returns -1 without applicable tasks', () async {
    final state = await freshState();
    expect(state.dailyCompletionPct(DateTime(2026, 8, 10)), -1);
    final task = TaskItem(id: 't1', name: 'قراءة');
    state.addTask(task);
    expect(state.dailyCompletionPct(DateTime(2026, 8, 10)), 0);
    task.setStatusOn(DateTime(2026, 8, 10), TaskStatus.done);
    expect(state.dailyCompletionPct(DateTime(2026, 8, 10)), 100);
  });

  test('theme mode system round-trips through persistence', () async {
    SharedPreferences.setMockInitialValues({});
    var state = await AppState.load();
    state.setThemeMode(ThemeMode.system);
    // نعيد التحميل من نفس التخزين الوهمي.
    state = await AppState.load();
    expect(state.themeMode, ThemeMode.system);
  });

  test('weeklyBuckets covers the whole month', () async {
    final state = await freshState();
    final task = TaskItem(id: 't1', name: 'قراءة');
    state.addTask(task);
    for (var d = 1; d <= 7; d++) {
      task.setStatusOn(DateTime(2026, 8, d), TaskStatus.done);
    }
    final buckets = state.weeklyBuckets(2026, 8);
    expect(buckets, hasLength(5)); // 31 يومًا → 5 مقاطع
    expect(buckets.first.pct, 100);
    expect(buckets.last.pct, 0);
  });

  test('best and worst habit ranked by commitment', () async {
    final state = await freshState();
    final good = TaskItem(id: 'g', name: 'جيدة');
    final bad = TaskItem(id: 'b', name: 'ضعيفة');
    state.addTask(good);
    state.addTask(bad);
    for (var d = 1; d <= 10; d++) {
      good.setStatusOn(DateTime(2026, 8, d), TaskStatus.done);
    }
    expect(state.bestHabit(2026, 8)!.task.id, 'g');
    expect(state.worstHabit(2026, 8)!.task.id, 'b');
  });

  test('levelInfo derives level from xp', () async {
    final state = await freshState();
    final task = TaskItem(id: 't1', name: 'قراءة');
    state.addTask(task);
    // 31 يوم إنجاز = 310 نقطة → المستوى 2 والباقي 10.
    for (var d = 1; d <= 31; d++) {
      task.setStatusOn(DateTime(2026, 8, d), TaskStatus.done);
    }
    final level = state.levelInfo();
    expect(level.level, 2);
    expect(level.current, 10);
  });
}
