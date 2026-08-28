import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n.dart';
import '../../core/theme.dart';
import '../../state/app_state.dart';
import '../../widgets/common.dart';
import '../shell_screen.dart';

/// تبويب الإنجازات: المستوى والنقاط وشبكة الأوسمة.
class AchievementsTab extends StatelessWidget {
  const AchievementsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final cursor = context.watch<MonthCursor>();
    final s = AppStrings.of(state.lang);
    final wq = context.wq;

    final stats = state.monthStats(cursor.year, cursor.month);
    final streak = state.currentStreak();
    final xp = state.totalXp();
    final level = state.levelInfo();
    final isArabic = state.lang == 'ar';

    final achievements = [
      (
        icon: '🔥',
        title: 'Streak 3',
        desc: '3 ${s.streak}',
        unlocked: streak >= 3,
      ),
      (
        icon: '🔥',
        title: 'Streak 7',
        desc: '7 ${s.streak}',
        unlocked: streak >= 7,
      ),
      (
        icon: '🔥',
        title: 'Streak 14',
        desc: '14 ${s.streak}',
        unlocked: streak >= 14,
      ),
      (
        icon: '✅',
        title: '${s.completed} 25',
        desc: '25 ${s.completed}',
        unlocked: stats.done >= 25,
      ),
      (
        icon: '✅',
        title: '${s.completed} 100',
        desc: '100 ${s.completed}',
        unlocked: stats.done >= 100,
      ),
      (icon: '⭐', title: 'XP 500', desc: '500 ${s.xp}', unlocked: xp >= 500),
      (icon: '⭐', title: 'XP 2000', desc: '2000 ${s.xp}', unlocked: xp >= 2000),
      (
        icon: '🏆',
        title: '${s.completion} 80%',
        desc: '80% ${s.completion}',
        unlocked: stats.pct >= 80,
      ),
      (
        icon: '📋',
        title: isArabic ? '10 مهام' : '10 tasks',
        desc: isArabic ? 'أضف 10 مهام' : 'Add 10 tasks',
        unlocked: state.tasks.length >= 10,
      ),
    ];

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        SectionTitle(s.achievements, topPadding: 0),
        WqCard(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        s.yourLevel,
                        style: TextStyle(fontSize: 12.5, color: wq.textMuted),
                      ),
                      Text(
                        '${s.level} ${level.level}',
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        s.totalXp,
                        style: TextStyle(fontSize: 12.5, color: wq.textMuted),
                      ),
                      Text(
                        '$xp ${s.xp}',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),
              LevelBar(pct: level.pct),
              const SizedBox(height: 5),
              Text(
                '${level.current} / ${level.per}',
                style: TextStyle(fontSize: 11, color: wq.textMuted),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(s.achDesc, style: TextStyle(fontSize: 13, color: wq.textMuted)),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 14,
            crossAxisSpacing: 14,
            childAspectRatio: 1.35,
          ),
          itemCount: achievements.length,
          itemBuilder: (context, index) {
            final a = achievements[index];
            return Opacity(
              opacity: a.unlocked ? 1 : .4,
              child: WqCard(
                padding: const EdgeInsets.all(14),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      a.unlocked ? a.icon : '🔒',
                      style: const TextStyle(fontSize: 26),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      a.title,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      a.unlocked ? a.desc : s.lockedTitle,
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 11, color: wq.textMuted),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}
