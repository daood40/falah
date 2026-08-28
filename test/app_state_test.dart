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
}
