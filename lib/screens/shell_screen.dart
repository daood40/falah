import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/l10n.dart';
import '../core/theme.dart';
import '../state/app_state.dart';
import '../widgets/task_editor_sheet.dart';
import 'tabs/achievements_tab.dart';
import 'tabs/calendar_tab.dart';
import 'tabs/home_tab.dart';
import 'tabs/settings_tab.dart';
import 'tabs/stats_tab.dart';
import 'tabs/tasks_tab.dart';

/// مؤشر الشهر المعروض، مشترك بين تبويبات الرئيسية والتقويم والإحصائيات.
class MonthCursor extends ChangeNotifier {
  MonthCursor() : year = DateTime.now().year, month = DateTime.now().month;

  int year;
  int month;

  bool get isCurrentMonth {
    final now = DateTime.now();
    return year == now.year && month == now.month;
  }

  void shift(int delta) {
    final shifted = DateTime(year, month + delta);
    year = shifted.year;
    month = shifted.month;
    notifyListeners();
  }
}

/// الهيكل الرئيسي: شريط علوي (شعار + بحث)، التبويبات،
/// وشريط تنقل سفلي بزر إضافة مركزي.
class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  int _tabIndex = 0;
  final _searchController = TextEditingController();
  final _monthCursor = MonthCursor();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    _monthCursor.dispose();
    super.dispose();
  }

  void _selectTab(int index) {
    setState(() {
      _tabIndex = index;
      _query = '';
      _searchController.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final s = AppStrings.of(state.lang);
    final wq = context.wq;

    final tabs = [
      HomeTab(query: _query),
      const CalendarTab(),
      const StatsTab(),
      TasksTab(query: _query),
      const AchievementsTab(),
      const SettingsTab(),
    ];

    return ChangeNotifierProvider.value(
      value: _monthCursor,
      child: Scaffold(
        body: SafeArea(
          bottom: false,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 8),
                child: Row(
                  children: [
                    _Brand(appName: s.appName),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Container(
                        constraints: const BoxConstraints(maxWidth: 260),
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        decoration: BoxDecoration(
                          color: wq.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: wq.border),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.search, size: 18, color: wq.textMuted),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextField(
                                controller: _searchController,
                                onChanged: (value) =>
                                    setState(() => _query = value),
                                style: const TextStyle(fontSize: 14),
                                decoration: InputDecoration(
                                  hintText: s.search,
                                  filled: false,
                                  border: InputBorder.none,
                                  enabledBorder: InputBorder.none,
                                  focusedBorder: InputBorder.none,
                                  isDense: true,
                                  contentPadding: const EdgeInsets.symmetric(
                                    vertical: 10,
                                  ),
                                ),
                              ),
                            ),
                            if (_query.isNotEmpty)
                              GestureDetector(
                                onTap: () {
                                  _searchController.clear();
                                  setState(() => _query = '');
                                },
                                child: Icon(
                                  Icons.close,
                                  size: 16,
                                  color: wq.textMuted,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: IndexedStack(index: _tabIndex, children: tabs),
              ),
            ],
          ),
        ),
        bottomNavigationBar: _BottomNav(
          selectedIndex: _tabIndex,
          onSelected: _selectTab,
          onAdd: () => showTaskEditorSheet(context),
          labels: [
            s.home,
            s.calendar,
            s.stats,
            s.tasks,
            s.achievements,
            s.settings,
          ],
          addLabel: s.addTask,
        ),
      ),
    );
  }
}

class _Brand extends StatelessWidget {
  const _Brand({required this.appName});

  final String appName;

  @override
  Widget build(BuildContext context) {
    final wq = context.wq;
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [wq.primary, wq.primaryDark],
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Text('⏳', style: TextStyle(fontSize: 19)),
        ),
        const SizedBox(width: 10),
        Text(
          appName,
          style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800),
        ),
      ],
    );
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav({
    required this.selectedIndex,
    required this.onSelected,
    required this.onAdd,
    required this.labels,
    required this.addLabel,
  });

  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final VoidCallback onAdd;
  final List<String> labels;
  final String addLabel;

  static const _icons = [
    Icons.home_rounded,
    Icons.calendar_month_rounded,
    Icons.bar_chart_rounded,
    Icons.checklist_rounded,
    Icons.emoji_events_rounded,
    Icons.settings_rounded,
  ];

  @override
  Widget build(BuildContext context) {
    final wq = context.wq;
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    Widget navButton(int index) {
      final selected = index == selectedIndex;
      return Tooltip(
        message: labels[index],
        child: Material(
          color: selected ? wq.primaryLight : Colors.transparent,
          borderRadius: BorderRadius.circular(13),
          child: InkWell(
            borderRadius: BorderRadius.circular(13),
            onTap: () => onSelected(index),
            child: SizedBox(
              width: 46,
              height: 46,
              child: Icon(
                _icons[index],
                size: 23,
                color: selected ? wq.primaryDark : wq.textMuted,
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      height: 66 + bottomInset,
      padding: EdgeInsets.only(bottom: bottomInset, left: 6, right: 6),
      decoration: BoxDecoration(
        color: wq.surface,
        border: Border(top: BorderSide(color: wq.border)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F1E281E),
            blurRadius: 18,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          navButton(0),
          navButton(1),
          navButton(2),
          Transform.translate(
            offset: const Offset(0, -14),
            child: Tooltip(
              message: addLabel,
              child: Material(
                shape: CircleBorder(
                  side: BorderSide(color: wq.background, width: 4),
                ),
                color: wq.primary,
                elevation: 4,
                shadowColor: wq.primaryDark.withValues(alpha: .4),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: onAdd,
                  child: const SizedBox(
                    width: 56,
                    height: 56,
                    child: Icon(Icons.add, color: Colors.white, size: 28),
                  ),
                ),
              ),
            ),
          ),
          navButton(3),
          navButton(4),
          navButton(5),
        ],
      ),
    );
  }
}
