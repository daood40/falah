import 'dart:math';

/// حالة إنجاز مهمة في يوم معيّن.
enum TaskStatus {
  done,
  doneLate,
  missed;

  String get key => switch (this) {
    TaskStatus.done => 'done',
    TaskStatus.doneLate => 'late',
    TaskStatus.missed => 'missed',
  };

  static TaskStatus? fromKey(String? key) => switch (key) {
    'done' => TaskStatus.done,
    'late' => TaskStatus.doneLate,
    'missed' => TaskStatus.missed,
    _ => null,
  };
}

/// أولوية المهمة.
enum TaskPriority {
  low,
  medium,
  high;

  static TaskPriority fromKey(String? key) => switch (key) {
    'low' => TaskPriority.low,
    'high' => TaskPriority.high,
    _ => TaskPriority.medium,
  };
}

/// نوع تكرار المهمة.
enum RecurrenceType {
  once,
  daily,
  weekly,
  monthly,
  specificDays;

  String get key => switch (this) {
    RecurrenceType.once => 'once',
    RecurrenceType.daily => 'daily',
    RecurrenceType.weekly => 'weekly',
    RecurrenceType.monthly => 'monthly',
    RecurrenceType.specificDays => 'specific',
  };

  static RecurrenceType fromKey(String? key) => switch (key) {
    'once' => RecurrenceType.once,
    'weekly' => RecurrenceType.weekly,
    'monthly' => RecurrenceType.monthly,
    'specific' => RecurrenceType.specificDays,
    _ => RecurrenceType.daily,
  };
}

/// قاعدة تكرار المهمة (يومي، أسبوعي، شهري، أيام محددة، أو مرة واحدة).
class Recurrence {
  const Recurrence({
    this.type = RecurrenceType.daily,
    this.weekday = 0,
    this.dayOfMonth = 1,
    this.days = const [],
    this.date,
  });

  final RecurrenceType type;

  /// يوم الأسبوع للتكرار الأسبوعي — 0 = الأحد … 6 = السبت.
  final int weekday;

  /// يوم الشهر للتكرار الشهري (1–31).
  final int dayOfMonth;

  /// أيام الأسبوع للتكرار "أيام محددة" — 0 = الأحد … 6 = السبت.
  final List<int> days;

  /// تاريخ التنفيذ لمهمة "مرة واحدة".
  final DateTime? date;

  Recurrence copyWith({
    RecurrenceType? type,
    int? weekday,
    int? dayOfMonth,
    List<int>? days,
    DateTime? date,
  }) {
    return Recurrence(
      type: type ?? this.type,
      weekday: weekday ?? this.weekday,
      dayOfMonth: dayOfMonth ?? this.dayOfMonth,
      days: days ?? this.days,
      date: date ?? this.date,
    );
  }

  Map<String, dynamic> toJson() => {
    'type': type.key,
    'weekday': weekday,
    'dayOfMonth': dayOfMonth,
    'days': days,
    if (date != null) 'date': DateKey.fromDate(date!),
  };

  factory Recurrence.fromJson(Map<String, dynamic> json) => Recurrence(
    type: RecurrenceType.fromKey(json['type'] as String?),
    weekday: (json['weekday'] as num?)?.toInt() ?? 0,
    dayOfMonth: (json['dayOfMonth'] as num?)?.toInt() ?? 1,
    days: ((json['days'] as List?) ?? const [])
        .map((e) => (e as num).toInt())
        .toList(),
    date: DateKey.tryParse(json['date'] as String?),
  );
}

/// تصنيف للمهام (روحانيات، صحة، …).
class TaskCategory {
  const TaskCategory({
    required this.id,
    required this.name,
    required this.colorValue,
  });

  final String id;
  final String name;
  final int colorValue;

  TaskCategory copyWith({String? name, int? colorValue}) => TaskCategory(
    id: id,
    name: name ?? this.name,
    colorValue: colorValue ?? this.colorValue,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'color': colorValue,
  };

  factory TaskCategory.fromJson(Map<String, dynamic> json) => TaskCategory(
    id: json['id'] as String,
    name: json['name'] as String? ?? '',
    colorValue: (json['color'] as num?)?.toInt() ?? 0xFF6E8F72,
  );
}

/// مهمة أو عادة يتتبعها المستخدم.
class TaskItem {
  TaskItem({
    required this.id,
    required this.name,
    this.description = '',
    this.icon = '✅',
    this.colorValue = 0xFF6E8F72,
    this.categoryId,
    this.priority = TaskPriority.medium,
    this.recurrence = const Recurrence(),
    this.notificationsOn = true,
    Map<String, TaskStatus>? statuses,
  }) : statuses = statuses ?? {};

  final String id;
  String name;
  String description;
  String icon;
  int colorValue;
  String? categoryId;
  TaskPriority priority;
  Recurrence recurrence;
  bool notificationsOn;

  /// حالات الإنجاز مفهرسة بمفتاح تاريخ كامل `yyyy-MM-dd`
  /// (بخلاف النموذج الأولي الذي كان يفهرس برقم اليوم فقط،
  /// وهو ما كان يكرر نفس الحالات في كل الشهور).
  final Map<String, TaskStatus> statuses;

  /// هل تنطبق المهمة على هذا اليوم بحسب قاعدة تكرارها؟
  bool isApplicableOn(DateTime date) {
    final r = recurrence;
    final sundayBased = date.weekday % 7; // الأحد = 0 … السبت = 6
    return switch (r.type) {
      RecurrenceType.daily => true,
      RecurrenceType.weekly => sundayBased == r.weekday,
      RecurrenceType.monthly => date.day == r.dayOfMonth,
      RecurrenceType.specificDays => r.days.contains(sundayBased),
      RecurrenceType.once =>
        r.date != null &&
            r.date!.year == date.year &&
            r.date!.month == date.month &&
            r.date!.day == date.day,
    };
  }

  TaskStatus? statusOn(DateTime date) => statuses[DateKey.fromDate(date)];

  void setStatusOn(DateTime date, TaskStatus? status) {
    final key = DateKey.fromDate(date);
    if (status == null) {
      statuses.remove(key);
    } else {
      statuses[key] = status;
    }
  }

  TaskItem deepCopy() => TaskItem(
    id: id,
    name: name,
    description: description,
    icon: icon,
    colorValue: colorValue,
    categoryId: categoryId,
    priority: priority,
    recurrence: recurrence,
    notificationsOn: notificationsOn,
    statuses: Map.of(statuses),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'desc': description,
    'icon': icon,
    'color': colorValue,
    if (categoryId != null) 'category': categoryId,
    'priority': priority.name,
    'recurrence': recurrence.toJson(),
    'notif': notificationsOn,
    'statuses': statuses.map((k, v) => MapEntry(k, v.key)),
  };

  factory TaskItem.fromJson(Map<String, dynamic> json) {
    final rawStatuses = (json['statuses'] as Map?) ?? const {};
    final statuses = <String, TaskStatus>{};
    rawStatuses.forEach((key, value) {
      final status = TaskStatus.fromKey(value as String?);
      if (status != null) statuses[key as String] = status;
    });
    return TaskItem(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      description: json['desc'] as String? ?? '',
      icon: json['icon'] as String? ?? '✅',
      colorValue: (json['color'] as num?)?.toInt() ?? 0xFF6E8F72,
      categoryId: json['category'] as String?,
      priority: TaskPriority.fromKey(json['priority'] as String?),
      recurrence: json['recurrence'] is Map<String, dynamic>
          ? Recurrence.fromJson(json['recurrence'] as Map<String, dynamic>)
          : const Recurrence(),
      notificationsOn: json['notif'] as bool? ?? true,
      statuses: statuses,
    );
  }

  static String newId() {
    final rand = Random();
    final now = DateTime.now().microsecondsSinceEpoch.toRadixString(36);
    final salt = rand.nextInt(1 << 30).toRadixString(36);
    return 't$now$salt';
  }
}

/// بيانات المستخدم المسجّل محليًا.
class UserProfile {
  const UserProfile({required this.name, this.email = ''});

  final String name;
  final String email;

  Map<String, dynamic> toJson() => {'name': name, 'email': email};

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
    name: json['name'] as String? ?? '',
    email: json['email'] as String? ?? '',
  );
}

/// أدوات تحويل التاريخ من/إلى مفتاح نصي `yyyy-MM-dd`.
abstract final class DateKey {
  static String fromDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';

  static DateTime? tryParse(String? key) {
    if (key == null || key.isEmpty) return null;
    final parts = key.split('-');
    if (parts.length != 3) return null;
    final y = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    final d = int.tryParse(parts[2]);
    if (y == null || m == null || d == null) return null;
    return DateTime(y, m, d);
  }
}
