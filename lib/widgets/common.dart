import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/l10n.dart';
import '../core/theme.dart';
import '../models/models.dart';

/// بطاقة بنمط "وقتي" — سطح أبيض بحواف ناعمة وحد خفيف وظل هادئ.
class WqCard extends StatelessWidget {
  const WqCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.borderColor,
    this.borderWidth = 1,
    this.dashedBorder = false,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? borderColor;
  final double borderWidth;
  final bool dashedBorder;

  @override
  Widget build(BuildContext context) {
    final wq = context.wq;
    final card = Container(
      decoration: BoxDecoration(
        color: wq.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: borderColor ?? wq.border, width: borderWidth),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).brightness == Brightness.light
                ? const Color(0x14283728)
                : const Color(0x59000000),
            blurRadius: 24,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Padding(padding: padding, child: child),
    );
    if (onTap == null) return card;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: card,
      ),
    );
  }
}

/// عنوان قسم بخط عريض.
class SectionTitle extends StatelessWidget {
  const SectionTitle(
    this.text, {
    super.key,
    this.trailing,
    this.topPadding = 26,
  });

  final String text;
  final Widget? trailing;
  final double topPadding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: topPadding, bottom: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            text,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// نص إرشادي يظهر عندما لا توجد بيانات.
class EmptyHint extends StatelessWidget {
  const EmptyHint(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(30),
      child: Center(
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(color: context.wq.textMuted, fontSize: 13.5),
        ),
      ),
    );
  }
}

/// أيقونة مهمة داخل مربع ملوّن بلون المهمة.
class TaskIconBox extends StatelessWidget {
  const TaskIconBox({
    super.key,
    required this.task,
    this.size = 28,
    this.fontSize = 14,
    this.onTap,
  });

  final TaskItem task;
  final double size;
  final double fontSize;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = Color(task.colorValue);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: color.withValues(alpha: .13),
          borderRadius: BorderRadius.circular(size * 0.32),
        ),
        child: Text(task.icon, style: TextStyle(fontSize: fontSize)),
      ),
    );
  }
}

/// نقطة حالة الإنجاز — تعرض ✓ / ! / ✕ أو دائرة فارغة.
class StatusDot extends StatelessWidget {
  const StatusDot({
    super.key,
    required this.status,
    this.applicable = true,
    this.size = 28,
    this.onTap,
  });

  final TaskStatus? status;
  final bool applicable;
  final double size;
  final VoidCallback? onTap;

  /// وصف الحالة لقارئات الشاشة.
  String _semanticLabel(AppStrings s) => switch (status) {
    TaskStatus.done => s.done,
    TaskStatus.doneLate => s.late,
    TaskStatus.missed => s.missed,
    null => applicable ? s.remaining : s.none,
  };

  @override
  Widget build(BuildContext context) {
    final wq = context.wq;
    final (Color bg, Color borderColor, IconData? icon) = switch (status) {
      TaskStatus.done => (wq.done, Colors.transparent, Icons.check_rounded),
      TaskStatus.doneLate => (
        wq.late,
        Colors.transparent,
        Icons.priority_high_rounded,
      ),
      TaskStatus.missed => (wq.missed, Colors.transparent, Icons.close_rounded),
      null => (Colors.transparent, wq.none, null),
    };

    final dot = AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: applicable ? bg : Colors.transparent,
        shape: BoxShape.circle,
        border: Border.all(
          color: applicable ? borderColor : wq.none.withValues(alpha: .5),
          width: 2,
        ),
      ),
      child: applicable && icon != null
          ? Icon(icon, size: size * 0.58, color: Colors.white)
          : null,
    );

    final strings = AppStrings.of(
      Directionality.of(context) == TextDirection.rtl ? 'ar' : 'en',
    );
    if (!applicable || onTap == null) {
      return Semantics(
        label: _semanticLabel(strings),
        child: Opacity(opacity: applicable ? 1 : .5, child: dot),
      );
    }
    return Semantics(
      label: _semanticLabel(strings),
      button: true,
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap!();
        },
        child: dot,
      ),
    );
  }
}

/// شريط تقدم أفقي رفيع (للمستوى والالتزام).
class LevelBar extends StatelessWidget {
  const LevelBar({super.key, required this.pct, this.color, this.height = 10});

  final int pct;
  final Color? color;
  final double height;

  @override
  Widget build(BuildContext context) {
    final wq = context.wq;
    return ClipRRect(
      borderRadius: BorderRadius.circular(height),
      child: Container(
        height: height,
        color: wq.surfaceAlt,
        alignment: AlignmentDirectional.centerStart,
        child: FractionallySizedBox(
          widthFactor: (pct.clamp(0, 100)) / 100,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 350),
            decoration: BoxDecoration(
              gradient: color == null
                  ? LinearGradient(colors: [wq.primary, wq.primaryDark])
                  : null,
              color: color,
              borderRadius: BorderRadius.circular(height),
            ),
          ),
        ),
      ),
    );
  }
}

/// حلقة نسبة الإنجاز الدائرية المتحركة.
class CompletionRing extends StatelessWidget {
  const CompletionRing({
    super.key,
    required this.pct,
    this.size = 110,
    this.strokeWidth = 10,
    this.label,
  });

  final int pct;
  final double size;
  final double strokeWidth;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final wq = context.wq;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: pct / 100),
          duration: const Duration(milliseconds: 700),
          curve: Curves.easeOutCubic,
          builder: (context, value, _) => SizedBox(
            width: size,
            height: size,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox.expand(
                  child: CircularProgressIndicator(
                    value: value,
                    strokeWidth: strokeWidth,
                    strokeCap: StrokeCap.round,
                    color: wq.done,
                    backgroundColor: wq.surfaceAlt,
                  ),
                ),
                Text(
                  '${(value * 100).round()}%',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ),
        if (label != null) ...[
          const SizedBox(height: 6),
          Text(label!, style: TextStyle(fontSize: 12.5, color: wq.textMuted)),
        ],
      ],
    );
  }
}

/// بطاقة إحصائية صغيرة (قيمة + تسمية + أيقونة).
class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.icon,
    required this.value,
    required this.label,
  });

  final String icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return WqCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        children: [
          Text(icon, style: const TextStyle(fontSize: 20)),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: context.wq.textMuted),
          ),
        ],
      ),
    );
  }
}

/// شريحة نصية صغيرة (chip).
class WqChip extends StatelessWidget {
  const WqChip(this.text, {super.key, this.color});

  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final wq = context.wq;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2.5),
      decoration: BoxDecoration(
        color: color?.withValues(alpha: .13) ?? wq.surfaceAlt,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text,
        style: TextStyle(fontSize: 11, color: color ?? wq.textMuted),
      ),
    );
  }
}

/// مبدّل ثنائي/ثلاثي بنمط الأزرار المقسّمة في التصميم الأصلي.
class SegmentedPills extends StatelessWidget {
  const SegmentedPills({
    super.key,
    required this.options,
    required this.selectedIndex,
    required this.onSelected,
  });

  final List<String> options;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final wq = context.wq;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: wq.surfaceAlt,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          for (var i = 0; i < options.length; i++)
            Expanded(
              child: GestureDetector(
                onTap: () => onSelected(i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  decoration: BoxDecoration(
                    color: i == selectedIndex ? wq.primary : Colors.transparent,
                    borderRadius: BorderRadius.circular(9),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    options[i],
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: i == selectedIndex ? Colors.white : wq.textMuted,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// زر أيقونة مربع صغير بحد خفيف.
class WqIconButton extends StatelessWidget {
  const WqIconButton({
    super.key,
    required this.child,
    this.onTap,
    this.tooltip,
    this.size = 34,
  });

  final Widget child;
  final VoidCallback? onTap;
  final String? tooltip;
  final double size;

  @override
  Widget build(BuildContext context) {
    final wq = context.wq;
    Widget button = Material(
      color: wq.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: wq.border),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: SizedBox(
          width: size,
          height: size,
          child: Center(child: child),
        ),
      ),
    );
    if (tooltip != null) {
      button = Tooltip(message: tooltip!, child: button);
    }
    return Opacity(opacity: onTap == null ? .35 : 1, child: button);
  }
}
