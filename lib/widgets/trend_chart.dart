import 'package:flutter/material.dart';

import '../core/theme.dart';

/// منحنى الإنجازات اليومية على مدار الشهر — مكافئ الرسم البياني SVG
/// في النموذج الأصلي، مرسوم بـ [CustomPainter] وقابل للتمرير أفقيًا.
class DailyTrendChart extends StatelessWidget {
  const DailyTrendChart({
    super.key,
    required this.dailyCounts,
    required this.maxY,
    required this.todayIndex,
    required this.axisLabel,
  });

  /// عدد المهام المنجزة لكل يوم (العنصر 0 = اليوم الأول من الشهر).
  final List<int> dailyCounts;

  /// أقصى قيمة للمحور الرأسي (عدد المهام الكلي).
  final int maxY;

  /// فهرس اليوم الحالي داخل القائمة، أو -1 إذا كان الشهر المعروض غير الحالي.
  final int todayIndex;

  final String axisLabel;

  static const _stepX = 26.0;
  static const _axisReserve = 34.0;
  static const _leftPad = 10.0;
  static const _plotHeight = 190.0;
  static const _topPad = 12.0;
  static const _bottomPad = 28.0;

  @override
  Widget build(BuildContext context) {
    final wq = context.wq;
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    final width = _leftPad + dailyCounts.length * _stepX + _axisReserve;
    const height = _topPad + _plotHeight + _bottomPad;

    return Column(
      children: [
        SizedBox(
          height: height,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            reverse: isRtl,
            child: CustomPaint(
              size: Size(width, height),
              painter: _TrendPainter(
                daily: dailyCounts,
                maxY: maxY < 1 ? 1 : maxY,
                todayIndex: todayIndex,
                isRtl: isRtl,
                lineColor: wq.primary,
                gridColor: wq.border,
                labelColor: wq.textMuted,
                todayColor: wq.primaryDark,
                dotFill: wq.primary,
                dotStroke: wq.surface,
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(axisLabel, style: TextStyle(fontSize: 11, color: wq.textMuted)),
      ],
    );
  }
}

class _TrendPainter extends CustomPainter {
  _TrendPainter({
    required this.daily,
    required this.maxY,
    required this.todayIndex,
    required this.isRtl,
    required this.lineColor,
    required this.gridColor,
    required this.labelColor,
    required this.todayColor,
    required this.dotFill,
    required this.dotStroke,
  });

  final List<int> daily;
  final int maxY;
  final int todayIndex;
  final bool isRtl;
  final Color lineColor;
  final Color gridColor;
  final Color labelColor;
  final Color todayColor;
  final Color dotFill;
  final Color dotStroke;

  @override
  void paint(Canvas canvas, Size size) {
    const stepX = DailyTrendChart._stepX;
    const axisReserve = DailyTrendChart._axisReserve;
    const leftPad = DailyTrendChart._leftPad;
    const topPad = DailyTrendChart._topPad;
    const plotH = DailyTrendChart._plotHeight;

    // في العربية يبدأ اليوم الأول من الجهة اليمنى ومحور الأرقام يساره.
    final axisX = isRtl ? size.width - axisReserve : axisReserve;
    double xFor(int i) =>
        isRtl ? axisX - i * stepX - stepX / 2 : axisX + i * stepX + stepX / 2;
    double yFor(num v) => topPad + plotH - (v / maxY) * plotH;

    // خطوط الشبكة وقيم المحور الرأسي.
    final ticks = <int>[];
    if (maxY <= 12) {
      for (var i = 0; i <= maxY; i++) {
        ticks.add(i);
      }
    } else {
      const steps = 6;
      for (var i = 0; i <= steps; i++) {
        ticks.add(((maxY / steps) * i).round());
      }
    }

    final gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 1;
    final plotStart = isRtl ? leftPad : axisX;
    final plotEnd = isRtl ? axisX : size.width - leftPad;
    for (final v in ticks) {
      final y = yFor(v);
      canvas.drawLine(Offset(plotStart, y), Offset(plotEnd, y), gridPaint);
      _drawText(
        canvas,
        '$v',
        Offset(isRtl ? axisX + 8 : axisX - 8, y),
        color: labelColor,
        fontSize: 10,
        anchor: isRtl ? _Anchor.startCenter : _Anchor.endCenter,
      );
    }

    // خط المحور الرأسي.
    canvas.drawLine(
      Offset(axisX, topPad),
      Offset(axisX, topPad + plotH),
      Paint()
        ..color = gridColor
        ..strokeWidth = 1.5,
    );

    // المنحنى.
    if (daily.isNotEmpty) {
      final path = Path()..moveTo(xFor(0), yFor(daily[0]));
      for (var i = 1; i < daily.length; i++) {
        path.lineTo(xFor(i), yFor(daily[i]));
      }
      canvas.drawPath(
        path,
        Paint()
          ..color = lineColor
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.5
          ..strokeJoin = StrokeJoin.round
          ..strokeCap = StrokeCap.round,
      );
    }

    // النقاط وأرقام الأيام.
    final fill = Paint()..color = dotFill;
    final stroke = Paint()
      ..color = dotStroke
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    for (var i = 0; i < daily.length; i++) {
      final center = Offset(xFor(i), yFor(daily[i]));
      canvas.drawCircle(center, 3.5, fill);
      canvas.drawCircle(center, 3.5, stroke);
      final isToday = i == todayIndex;
      _drawText(
        canvas,
        '${i + 1}',
        Offset(xFor(i), size.height - 8),
        color: isToday ? todayColor : labelColor,
        fontSize: 9.5,
        bold: isToday,
        anchor: _Anchor.centerBottom,
      );
    }
  }

  void _drawText(
    Canvas canvas,
    String text,
    Offset at, {
    required Color color,
    required double fontSize,
    bool bold = false,
    required _Anchor anchor,
  }) {
    final painter = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          color: color,
          fontSize: fontSize,
          fontWeight: bold ? FontWeight.w800 : FontWeight.w400,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final offset = switch (anchor) {
      _Anchor.centerBottom => Offset(
        at.dx - painter.width / 2,
        at.dy - painter.height,
      ),
      _Anchor.startCenter => Offset(at.dx, at.dy - painter.height / 2),
      _Anchor.endCenter => Offset(
        at.dx - painter.width,
        at.dy - painter.height / 2,
      ),
    };
    painter.paint(canvas, offset);
  }

  @override
  bool shouldRepaint(covariant _TrendPainter old) =>
      old.daily != daily ||
      old.maxY != maxY ||
      old.todayIndex != todayIndex ||
      old.isRtl != isRtl ||
      old.lineColor != lineColor ||
      old.gridColor != gridColor;
}

enum _Anchor { centerBottom, startCenter, endCenter }

/// أعمدة الإحصائيات الأسبوعية.
class WeeklyBars extends StatelessWidget {
  const WeeklyBars({super.key, required this.buckets});

  final List<({String label, int pct})> buckets;

  @override
  Widget build(BuildContext context) {
    final wq = context.wq;
    return SizedBox(
      height: 130,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (final bucket in buckets) ...[
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    '${bucket.pct}%',
                    style: TextStyle(fontSize: 10, color: wq.textMuted),
                  ),
                  const SizedBox(height: 4),
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: bucket.pct.clamp(3, 100) / 100),
                    duration: const Duration(milliseconds: 500),
                    curve: Curves.easeOutCubic,
                    builder: (context, value, _) => Container(
                      height: 84 * value,
                      decoration: BoxDecoration(
                        color: wq.primary,
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(6),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    bucket.label,
                    style: TextStyle(fontSize: 10, color: wq.textMuted),
                  ),
                ],
              ),
            ),
            if (bucket != buckets.last) const SizedBox(width: 6),
          ],
        ],
      ),
    );
  }
}
