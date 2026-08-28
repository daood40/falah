import 'package:flutter_test/flutter_test.dart';
import 'package:waqti/models/models.dart';

void main() {
  group('Recurrence.isApplicableOn', () {
    test('daily applies every day', () {
      final task = TaskItem(id: 't1', name: 'قراءة');
      expect(task.isApplicableOn(DateTime(2026, 8, 1)), isTrue);
      expect(task.isApplicableOn(DateTime(2026, 8, 28)), isTrue);
    });

    test('weekly applies only on the chosen weekday (Sunday-based)', () {
      final task = TaskItem(
        id: 't1',
        name: 'رياضة',
        recurrence: const Recurrence(type: RecurrenceType.weekly, weekday: 0),
      );
      // 2026-08-30 يوم أحد.
      expect(task.isApplicableOn(DateTime(2026, 8, 30)), isTrue);
      expect(task.isApplicableOn(DateTime(2026, 8, 31)), isFalse);
    });

    test('monthly applies on the chosen day of month', () {
      final task = TaskItem(
        id: 't1',
        name: 'فاتورة',
        recurrence: const Recurrence(
          type: RecurrenceType.monthly,
          dayOfMonth: 15,
        ),
      );
      expect(task.isApplicableOn(DateTime(2026, 8, 15)), isTrue);
      expect(task.isApplicableOn(DateTime(2026, 8, 16)), isFalse);
    });

    test('specific days applies on selected weekdays', () {
      final task = TaskItem(
        id: 't1',
        name: 'تأمل',
        recurrence: const Recurrence(
          type: RecurrenceType.specificDays,
          days: [0, 3], // الأحد والأربعاء
        ),
      );
      expect(task.isApplicableOn(DateTime(2026, 8, 30)), isTrue); // أحد
      expect(task.isApplicableOn(DateTime(2026, 9, 2)), isTrue); // أربعاء
      expect(task.isApplicableOn(DateTime(2026, 8, 31)), isFalse); // إثنين
    });

    test('once applies only on the exact date', () {
      final task = TaskItem(
        id: 't1',
        name: 'موعد',
        recurrence: Recurrence(
          type: RecurrenceType.once,
          date: DateTime(2026, 8, 28),
        ),
      );
      expect(task.isApplicableOn(DateTime(2026, 8, 28)), isTrue);
      expect(task.isApplicableOn(DateTime(2026, 8, 29)), isFalse);
      expect(task.isApplicableOn(DateTime(2027, 8, 28)), isFalse);
    });
  });

  group('statuses keyed by full date', () {
    test('same day number in different months is independent', () {
      final task = TaskItem(id: 't1', name: 'قراءة');
      task.setStatusOn(DateTime(2026, 8, 10), TaskStatus.done);
      expect(task.statusOn(DateTime(2026, 8, 10)), TaskStatus.done);
      expect(task.statusOn(DateTime(2026, 7, 10)), isNull);
      expect(task.statusOn(DateTime(2026, 9, 10)), isNull);
    });

    test('setting null clears the status', () {
      final task = TaskItem(id: 't1', name: 'قراءة');
      task.setStatusOn(DateTime(2026, 8, 10), TaskStatus.missed);
      task.setStatusOn(DateTime(2026, 8, 10), null);
      expect(task.statusOn(DateTime(2026, 8, 10)), isNull);
    });
  });

  group('JSON round-trip', () {
    test('task survives toJson/fromJson', () {
      final original = TaskItem(
        id: 'tx',
        name: 'الصلاة في وقتها',
        description: 'وصف',
        icon: '🙏',
        colorValue: 0xFF6E8F72,
        categoryId: 'c1',
        priority: TaskPriority.high,
        recurrence: const Recurrence(
          type: RecurrenceType.specificDays,
          days: [0, 2, 4],
        ),
      )..setStatusOn(DateTime(2026, 8, 5), TaskStatus.doneLate);

      final restored = TaskItem.fromJson(original.toJson());
      expect(restored.id, original.id);
      expect(restored.name, original.name);
      expect(restored.priority, TaskPriority.high);
      expect(restored.recurrence.type, RecurrenceType.specificDays);
      expect(restored.recurrence.days, [0, 2, 4]);
      expect(restored.statusOn(DateTime(2026, 8, 5)), TaskStatus.doneLate);
    });

    test('category survives toJson/fromJson', () {
      const original = TaskCategory(
        id: 'c9',
        name: 'صحة',
        colorValue: 0xFFE3A93F,
      );
      final restored = TaskCategory.fromJson(original.toJson());
      expect(restored.id, 'c9');
      expect(restored.name, 'صحة');
      expect(restored.colorValue, 0xFFE3A93F);
    });
  });

  test('DateKey formats and parses', () {
    expect(DateKey.fromDate(DateTime(2026, 8, 5)), '2026-08-05');
    expect(DateKey.tryParse('2026-08-05'), DateTime(2026, 8, 5));
    expect(DateKey.tryParse('garbage'), isNull);
  });
}
