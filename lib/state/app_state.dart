import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/models.dart';

/// إحصائيات شهر واحد.
class MonthStats {
  const MonthStats({
    required this.applicable,
    required this.done,
    required this.late,
    required this.missed,
  });

  final int applicable;
  final int done;
  final int late;
  final int missed;

  int get remaining => applicable - done;
  int get pct => applicable > 0 ? ((done / applicable) * 100).round() : 0;
}

/// مستوى المستخدم المحسوب من نقاط الخبرة.
class LevelInfo {
  const LevelInfo({
    required this.level,
    required this.current,
    required this.per,
  });

  final int level;
  final int current;
  final int per;

  int get pct => ((current / per) * 100).round();
}

/// الحالة المركزية للتطبيق: الإعدادات، الحساب، المهام، التصنيفات،
/// والاشتراك — مع حفظ تلقائي في [SharedPreferences].
class AppState extends ChangeNotifier {
  AppState._(this._prefs);

  static const _storageKey = 'waqti.v1';
  static const freePlanTaskLimit = 5;
  static const xpPerDone = 10;
  static const xpPerLate = 4;
  static const xpPerLevel = 300;

  final SharedPreferences _prefs;

  // ---------- الإعدادات ----------
  String lang = 'ar';
  ThemeMode themeMode = ThemeMode.light;
  bool notifMaster = true;
  bool morningRecap = true;
  bool eveningRecap = false;

  // ---------- الحساب ----------
  bool loggedIn = false;
  UserProfile? user;

  // ---------- الاشتراك ----------
  bool isPremium = false;
  String billingCycle = 'monthly';

  // ---------- البيانات ----------
  List<TaskCategory> categories = [];
  List<TaskItem> tasks = [];
  List<String> customIcons = [];
  List<int> customColors = [];

  static Future<AppState> load() async {
    final prefs = await SharedPreferences.getInstance();
    final state = AppState._(prefs);
    state._restore();
    return state;
  }

  // =======================================================================
  // الحفظ والاستعادة
  // =======================================================================

  void _restore() {
    final raw = _prefs.getString(_storageKey);
    if (raw == null) {
      categories = _defaultCategories();
      return;
    }
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      lang = json['lang'] as String? ?? 'ar';
      themeMode = switch (json['theme'] as String?) {
        'dark' => ThemeMode.dark,
        'system' => ThemeMode.system,
        _ => ThemeMode.light,
      };
      notifMaster = json['notifMaster'] as bool? ?? true;
      morningRecap = json['morningRecap'] as bool? ?? true;
      eveningRecap = json['eveningRecap'] as bool? ?? false;
      loggedIn = json['loggedIn'] as bool? ?? false;
      user = json['user'] is Map<String, dynamic>
          ? UserProfile.fromJson(json['user'] as Map<String, dynamic>)
          : null;
      isPremium = json['isPremium'] as bool? ?? false;
      billingCycle = json['billingCycle'] as String? ?? 'monthly';
      categories = ((json['categories'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(TaskCategory.fromJson)
          .toList();
      tasks = ((json['tasks'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(TaskItem.fromJson)
          .toList();
      customIcons = ((json['customIcons'] as List?) ?? const [])
          .whereType<String>()
          .toList();
      customColors = ((json['customColors'] as List?) ?? const [])
          .map((e) => (e as num).toInt())
          .toList();
      if (categories.isEmpty && tasks.isEmpty) {
        categories = _defaultCategories();
      }
    } catch (_) {
      // بيانات تالفة — نبدأ من جديد بدل تعطيل التطبيق.
      categories = _defaultCategories();
    }
  }

  Future<void> _persist() async {
    final json = <String, dynamic>{
      'lang': lang,
      'theme': switch (themeMode) {
        ThemeMode.dark => 'dark',
        ThemeMode.system => 'system',
        ThemeMode.light => 'light',
      },
      'notifMaster': notifMaster,
      'morningRecap': morningRecap,
      'eveningRecap': eveningRecap,
      'loggedIn': loggedIn,
      if (user != null) 'user': user!.toJson(),
      'isPremium': isPremium,
      'billingCycle': billingCycle,
      'categories': categories.map((c) => c.toJson()).toList(),
      'tasks': tasks.map((t) => t.toJson()).toList(),
      'customIcons': customIcons,
      'customColors': customColors,
    };
    await _prefs.setString(_storageKey, jsonEncode(json));
  }

  void _commit() {
    _persist();
    notifyListeners();
  }

  static List<TaskCategory> _defaultCategories() => [
    const TaskCategory(id: 'c1', name: 'روحانيات', colorValue: 0xFF6E8F72),
    const TaskCategory(id: 'c2', name: 'صحة', colorValue: 0xFFE3A93F),
    const TaskCategory(id: 'c3', name: 'تطوير ذاتي', colorValue: 0xFF4C8DE0),
    const TaskCategory(id: 'c4', name: 'إنتاجية', colorValue: 0xFF8E6CE0),
  ];

  // =======================================================================
  // الإعدادات
  // =======================================================================

  void setLang(String value) {
    if (lang == value) return;
    lang = value;
    _commit();
  }

  void setThemeMode(ThemeMode value) {
    if (themeMode == value) return;
    themeMode = value;
    _commit();
  }

  void setNotifMaster(bool value) {
    notifMaster = value;
    _commit();
  }

  void setMorningRecap(bool value) {
    morningRecap = value;
    _commit();
  }

  void setEveningRecap(bool value) {
    eveningRecap = value;
    _commit();
  }

  // =======================================================================
  // الحساب (محاكاة محلية — لا يوجد خادم)
  // =======================================================================

  void signIn({required String name, required String email}) {
    user = UserProfile(name: name, email: email);
    loggedIn = true;
    _commit();
  }

  void signInAsGuest(String guestLabel) {
    user = UserProfile(name: guestLabel);
    loggedIn = true;
    _commit();
  }

  void signOut() {
    loggedIn = false;
    user = null;
    _commit();
  }

  // =======================================================================
  // الاشتراك (محاكاة — بدون دفع فعلي)
  // =======================================================================

  void setBillingCycle(String cycle) {
    billingCycle = cycle;
    _commit();
  }

  void setPremium(bool value) {
    isPremium = value;
    _commit();
  }

  // =======================================================================
  // المهام
  // =======================================================================

  bool get canAddTask => isPremium || tasks.length < freePlanTaskLimit;

  TaskItem? taskById(String id) {
    for (final t in tasks) {
      if (t.id == id) return t;
    }
    return null;
  }

  TaskCategory? categoryById(String? id) {
    if (id == null) return null;
    for (final c in categories) {
      if (c.id == id) return c;
    }
    return null;
  }

  /// يضيف مهمة جديدة. يرجع `false` عند بلوغ حد الخطة المجانية.
  bool addTask(TaskItem task) {
    if (!canAddTask) return false;
    tasks.add(task);
    _commit();
    return true;
  }

  void updateTask(TaskItem task) {
    final index = tasks.indexWhere((t) => t.id == task.id);
    if (index == -1) return;
    tasks[index] = task;
    _commit();
  }

  /// يحذف المهمة ويرجعها مع موضعها للسماح بالتراجع.
  (TaskItem, int)? removeTask(String id) {
    final index = tasks.indexWhere((t) => t.id == id);
    if (index == -1) return null;
    final removed = tasks.removeAt(index);
    _commit();
    return (removed, index);
  }

  /// يعيد ترتيب المهام (سحب وإفلات في تبويب المهام).
  void reorderTask(int oldIndex, int newIndex) {
    if (oldIndex < 0 || oldIndex >= tasks.length) return;
    var target = newIndex;
    if (target > oldIndex) target -= 1;
    final task = tasks.removeAt(oldIndex);
    tasks.insert(target.clamp(0, tasks.length), task);
    _commit();
  }

  /// يزرع بيانات تجريبية (ضمن حد الخطة المجانية) مع سجل إنجاز
  /// عشوائي واقعي للأيام الماضية من الشهر الحالي — للاستكشاف السريع.
  void seedDemoData() {
    if (tasks.isNotEmpty) return;
    final demo = [
      TaskItem(
        id: TaskItem.newId(),
        name: 'الصلاة في وقتها',
        icon: '🙏',
        colorValue: 0xFF6E8F72,
        categoryId: 'c1',
        priority: TaskPriority.high,
      ),
      TaskItem(
        id: TaskItem.newId(),
        name: 'قراءة القرآن',
        icon: '📖',
        colorValue: 0xFF6E8F72,
        categoryId: 'c1',
        priority: TaskPriority.high,
      ),
      TaskItem(
        id: TaskItem.newId(),
        name: 'الرياضة',
        icon: '🏃‍♂️',
        colorValue: 0xFFE3A93F,
        categoryId: 'c2',
      ),
      TaskItem(
        id: TaskItem.newId(),
        name: 'قراءة كتاب',
        icon: '📚',
        colorValue: 0xFF4C8DE0,
        categoryId: 'c3',
        priority: TaskPriority.low,
        recurrence: const Recurrence(
          type: RecurrenceType.specificDays,
          days: [0, 2, 4],
        ),
      ),
      TaskItem(
        id: TaskItem.newId(),
        name: 'شرب 2 لتر ماء',
        icon: '💧',
        colorValue: 0xFF3FB6B0,
        categoryId: 'c2',
      ),
    ];
    final random = Random();
    final today = DateTime.now();
    for (final task in demo) {
      for (var back = 1; back <= today.day - 1; back++) {
        final date = DateTime(today.year, today.month, today.day - back);
        if (!task.isApplicableOn(date)) continue;
        final roll = random.nextDouble();
        task.setStatusOn(
          date,
          roll < 0.72
              ? TaskStatus.done
              : (roll < 0.87 ? TaskStatus.doneLate : TaskStatus.missed),
        );
      }
    }
    tasks.addAll(demo);
    _commit();
  }

  void restoreTask(TaskItem task, int index) {
    tasks.insert(index.clamp(0, tasks.length), task);
    _commit();
  }

  /// يقلّب حالة اليوم: بدون حالة ← منجز ← متأخر ← فائت ← بدون حالة.
  void cycleStatus(String taskId, DateTime date) {
    final task = taskById(taskId);
    if (task == null || !task.isApplicableOn(date)) return;
    final next = switch (task.statusOn(date)) {
      null => TaskStatus.done,
      TaskStatus.done => TaskStatus.doneLate,
      TaskStatus.doneLate => TaskStatus.missed,
      TaskStatus.missed => null,
    };
    task.setStatusOn(date, next);
    _commit();
  }

  void addCustomIcon(String icon) {
    if (icon.isEmpty || customIcons.contains(icon)) return;
    customIcons.add(icon);
    _commit();
  }

  void addCustomColor(int colorValue) {
    if (customColors.contains(colorValue)) return;
    customColors.add(colorValue);
    _commit();
  }

  // =======================================================================
  // التصنيفات
  // =======================================================================

  TaskCategory addCategory(String name, int colorValue) {
    final category = TaskCategory(
      id: TaskItem.newId(),
      name: name,
      colorValue: colorValue,
    );
    categories.add(category);
    _commit();
    return category;
  }

  void removeCategory(String id) {
    categories.removeWhere((c) => c.id == id);
    for (final t in tasks) {
      if (t.categoryId == id) t.categoryId = null;
    }
    _commit();
  }

  // =======================================================================
  // الإحصائيات
  // =======================================================================

  static int daysInMonth(int year, int month) =>
      DateTime(year, month + 1, 0).day;

  MonthStats monthStats(int year, int month, {List<TaskItem>? subset}) {
    final list = subset ?? tasks;
    final dim = daysInMonth(year, month);
    int applicable = 0, done = 0, late = 0, missed = 0;
    for (final task in list) {
      for (var d = 1; d <= dim; d++) {
        final date = DateTime(year, month, d);
        if (!task.isApplicableOn(date)) continue;
        applicable++;
        switch (task.statusOn(date)) {
          case TaskStatus.done:
            done++;
          case TaskStatus.doneLate:
            late++;
          case TaskStatus.missed:
            missed++;
          case null:
            break;
        }
      }
    }
    return MonthStats(
      applicable: applicable,
      done: done,
      late: late,
      missed: missed,
    );
  }

  /// عدد الأيام المتتالية (انتهاءً باليوم) التي أُنجزت فيها كل المهام
  /// المستحقة. الأيام بلا مهام مستحقة لا تقطع التتابع.
  int currentStreak() {
    var date = DateTime.now();
    var streak = 0;
    for (var i = 0; i < 730; i++) {
      final day = DateTime(date.year, date.month, date.day);
      final applicable = tasks
          .where((t) => t.isApplicableOn(day))
          .toList(growable: false);
      if (applicable.isNotEmpty) {
        final allDone = applicable.every(
          (t) => t.statusOn(day) == TaskStatus.done,
        );
        if (!allDone) break;
        streak++;
      }
      date = day.subtract(const Duration(days: 1));
    }
    return streak;
  }

  int totalXp() {
    var xp = 0;
    for (final task in tasks) {
      for (final status in task.statuses.values) {
        if (status == TaskStatus.done) xp += xpPerDone;
        if (status == TaskStatus.doneLate) xp += xpPerLate;
      }
    }
    return xp;
  }

  LevelInfo levelInfo() {
    final xp = totalXp();
    return LevelInfo(
      level: xp ~/ xpPerLevel + 1,
      current: xp % xpPerLevel,
      per: xpPerLevel,
    );
  }

  /// نسبة التزام مهمة واحدة خلال شهر معيّن.
  int taskCommitment(TaskItem task, int year, int month) {
    final dim = daysInMonth(year, month);
    int applicable = 0, done = 0;
    for (var d = 1; d <= dim; d++) {
      final date = DateTime(year, month, d);
      if (!task.isApplicableOn(date)) continue;
      applicable++;
      if (task.statusOn(date) == TaskStatus.done) done++;
    }
    return applicable > 0 ? ((done / applicable) * 100).round() : 0;
  }

  /// عدد المهام المنجزة لكل يوم من الشهر (لرسم منحنى الإنجازات).
  List<int> dailyDoneCounts(int year, int month) {
    final dim = daysInMonth(year, month);
    return List.generate(dim, (i) {
      final date = DateTime(year, month, i + 1);
      return tasks.where((t) => t.statusOn(date) == TaskStatus.done).length;
    });
  }

  /// نسبة إنجاز يوم واحد (لخريطة السنة الحرارية).
  /// ترجع -1 إذا لم تكن هناك مهام مستحقة في ذلك اليوم.
  int dailyCompletionPct(DateTime date) {
    var applicable = 0, done = 0;
    for (final task in tasks) {
      if (!task.isApplicableOn(date)) continue;
      applicable++;
      if (task.statusOn(date) == TaskStatus.done) done++;
    }
    if (applicable == 0) return -1;
    return ((done / applicable) * 100).round();
  }

  /// نسب الإنجاز الأسبوعية (كل 7 أيام من الشهر).
  List<({String label, int pct})> weeklyBuckets(int year, int month) {
    final dim = daysInMonth(year, month);
    final buckets = <({String label, int pct})>[];
    for (var start = 1; start <= dim; start += 7) {
      final end = (start + 6).clamp(1, dim);
      int applicable = 0, done = 0;
      for (final task in tasks) {
        for (var d = start; d <= end; d++) {
          final date = DateTime(year, month, d);
          if (!task.isApplicableOn(date)) continue;
          applicable++;
          if (task.statusOn(date) == TaskStatus.done) done++;
        }
      }
      buckets.add((
        label: '$start-$end',
        pct: applicable > 0 ? ((done / applicable) * 100).round() : 0,
      ));
    }
    return buckets;
  }

  ({TaskItem task, int pct})? bestHabit(int year, int month) =>
      _extremeHabit(year, month, best: true);

  ({TaskItem task, int pct})? worstHabit(int year, int month) =>
      _extremeHabit(year, month, best: false);

  ({TaskItem task, int pct})? _extremeHabit(
    int year,
    int month, {
    required bool best,
  }) {
    if (tasks.isEmpty) return null;
    final ranked =
        tasks
            .map((t) => (task: t, pct: taskCommitment(t, year, month)))
            .toList()
          ..sort((a, b) => b.pct.compareTo(a.pct));
    return best ? ranked.first : ranked.last;
  }

  // =======================================================================
  // تصدير واستيراد البيانات
  // =======================================================================

  String exportJson() {
    final payload = {
      'app': 'waqti',
      'version': 1,
      'exportedAt': DateTime.now().toIso8601String(),
      'categories': categories.map((c) => c.toJson()).toList(),
      'tasks': tasks.map((t) => t.toJson()).toList(),
    };
    return const JsonEncoder.withIndent('  ').convert(payload);
  }

  /// يرجع `true` عند نجاح الاستيراد.
  bool importJson(String raw) {
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      final newCategories = ((json['categories'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(TaskCategory.fromJson)
          .toList();
      final newTasks = ((json['tasks'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(TaskItem.fromJson)
          .toList();
      if (newCategories.isEmpty && newTasks.isEmpty) return false;
      if (newCategories.isNotEmpty) categories = newCategories;
      if (newTasks.isNotEmpty) tasks = newTasks;
      _commit();
      return true;
    } catch (_) {
      return false;
    }
  }
}
