import 'package:flutter/material.dart';

import '../core/theme.dart';

/// خريطة حرارية سنوية بأسلوب GitHub: عمود لكل أسبوع وصف لكل يوم،
/// وشدة اللون تعكس نسبة إنجاز ذلك اليوم.
class YearHeatmap extends StatelessWidget {
  const YearHeatmap({
    super.key,
    required this.year,
    required this.pctForDate,
    required this.monthLabels,
    required this.lessLabel,
    required this.moreLabel,
  });

  final int year;

  /// نسبة إنجاز يوم واحد (0–100) أو -1 عندما لا توجد مهام مستحقة.
  final int Function(DateTime date) pctForDate;

  final List<String> monthLabels;
  final String lessLabel;
  final String moreLabel;

  static const _cell = 11.0;
  static const _gap = 3.0;
  static const _topLabelH = 16.0;

  @override
  Widget build(BuildContext context) {
    final wq = context.wq;
    final isRtl = Directionality.of(context) == TextDirection.rtl;

    final firstDay = DateTime(year, 1, 1);
    final lastDay = DateTime(year, 12, 31);
    // نبدأ الشبكة من أحد الأسبوع الذي يحوي أول يوم في السنة.
    final gridStart = firstDay.subtract(Duration(days: firstDay.weekday % 7));
    final totalDays = lastDay.difference(gridStart).inDays + 1;
    final weekCount = (totalDays / 7).ceil();

    final width = weekCount * (_cell + _gap);
    const height = _topLabelH + 7 * (_cell + _gap);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: height,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            reverse: isRtl,
            child: CustomPaint(
              size: Size(width, height),
              painter: _HeatmapPainter(
                year: year,
                gridStart: gridStart,
                weekCount: weekCount,
                pctForDate: pctForDate,
                monthLabels: monthLabels,
                isRtl: isRtl,
                baseColor: wq.primary,
                emptyColor: wq.surfaceAlt,
                missedColor: wq.missed,
                labelColor: wq.textMuted,
                todayBorder: wq.text,
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              lessLabel,
              style: TextStyle(fontSize: 10.5, color: wq.textMuted),
            ),
            const SizedBox(width: 6),
            for (final alpha in const [.12, .3, .5, .75, 1.0])
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 1.5),
                child: Container(
                  width: _cell,
                  height: _cell,
                  decoration: BoxDecoration(
                    color: alpha == .12
                        ? wq.surfaceAlt
                        : wq.primary.withValues(alpha: alpha),
                    borderRadius: BorderRadius.circular(2.5),
                  ),
                ),
              ),
            const SizedBox(width: 6),
            Text(
              moreLabel,
              style: TextStyle(fontSize: 10.5, color: wq.textMuted),
            ),
          ],
        ),
      ],
    );
  }
}

class _HeatmapPainter extends CustomPainter {
  _HeatmapPainter({
    required this.year,
    required this.gridStart,
    required this.weekCount,
    required this.pctForDate,
    required this.monthLabels,
    required this.isRtl,
    required this.baseColor,
    required this.emptyColor,
    required this.missedColor,
    required this.labelColor,
    required this.todayBorder,
  });

  final int year;
  final DateTime gridStart;
  final int weekCount;
  final int Function(DateTime date) pctForDate;
  final List<String> monthLabels;
  final bool isRtl;
  final Color baseColor;
  final Color emptyColor;
  final Color missedColor;
  final Color labelColor;
  final Color todayBorder;

  static const _cell = YearHeatmap._cell;
  static const _gap = YearHeatmap._gap;
  static const _topLabelH = YearHeatmap._topLabelH;

  double _weekX(int week, double totalWidth) {
    final x = week * (_cell + _gap);
    return isRtl ? totalWidth - x - _cell : x;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final paint = Paint();
    var lastLabeledMonth = 0;

    for (var week = 0; week < weekCount; week++) {
      final x = _weekX(week, size.width);
      for (var dow = 0; dow < 7; dow++) {
        final date = gridStart.add(Duration(days: week * 7 + dow));
        if (date.year != year) continue;

        final pct = pctForDate(date);
        // الأيام المستقبلية أو بلا مهام: خلية باهتة.
        final isFuture = date.isAfter(today);
        if (pct < 0 || isFuture) {
          paint.color = emptyColor;
        } else if (pct == 0) {
          paint.color = missedColor.withValues(alpha: .25);
        } else {
          paint.color = baseColor.withValues(alpha: .15 + (pct / 100) * .85);
        }

        final rect = RRect.fromRectAndRadius(
          Rect.fromLTWH(x, _topLabelH + dow * (_cell + _gap), _cell, _cell),
          const Radius.circular(2.5),
        );
        canvas.drawRRect(rect, paint);

        if (date == today) {
          canvas.drawRRect(
            rect,
            Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1.4
              ..color = todayBorder,
          );
        }

        // تسمية الشهر فوق أول أسبوع يحتوي يومه الأول.
        if (date.day == 1 && date.month != lastLabeledMonth) {
          lastLabeledMonth = date.month;
          final painter = TextPainter(
            text: TextSpan(
              text: monthLabels[date.month - 1],
              style: TextStyle(fontSize: 9, color: labelColor),
            ),
            textDirection: TextDirection.ltr,
          )..layout();
          final labelX = isRtl ? x + _cell - painter.width : x;
          painter.paint(canvas, Offset(labelX, 0));
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant _HeatmapPainter old) =>
      old.year != year ||
      old.isRtl != isRtl ||
      old.baseColor != baseColor ||
      old.emptyColor != emptyColor;
}
