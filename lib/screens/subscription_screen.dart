import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/l10n.dart';
import '../core/theme.dart';
import '../state/app_state.dart';
import '../widgets/common.dart';

/// شاشة الاشتراك المميز — مقارنة الخطط والاشتراك/الإلغاء (محاكاة).
class SubscriptionScreen extends StatelessWidget {
  const SubscriptionScreen({super.key});

  static Future<void> push(BuildContext context) {
    return Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const SubscriptionScreen()));
  }

  void _togglePremium(BuildContext context, AppState state, AppStrings s) {
    final activating = !state.isPremium;
    state.setPremium(activating);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(activating ? s.subscribedMsg : s.cancelledMsg)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final s = AppStrings.of(state.lang);
    final wq = context.wq;
    final yearly = state.billingCycle == 'yearly';
    final price = yearly ? r'$39.99' : r'$4.99';
    final per = yearly ? s.perYear : s.perMonth;
    final premiumFeatures = [
      s.featAds,
      s.featUnlimited,
      s.featSync,
      s.featBackup,
      s.featStats,
      s.featThemes,
      s.featExport,
      s.featGoals,
      s.featFuture,
    ];

    return Scaffold(
      appBar: AppBar(title: Text(s.subscription)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 260),
              child: SegmentedPills(
                options: [s.monthlyPlan, '${s.yearlyPlan} · ${s.saveBadge}'],
                selectedIndex: yearly ? 1 : 0,
                onSelected: (i) =>
                    state.setBillingCycle(i == 1 ? 'yearly' : 'monthly'),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // ---------- الخطة المجانية ----------
          _PlanCard(
            highlighted: !state.isPremium,
            tag: !state.isPremium ? s.currentPlanTag : null,
            title: s.freePlan,
            price: r'$0',
            per: '',
            children: [
              _FeatureRow(text: s.freeFeat1, included: true),
              _FeatureRow(text: s.freeFeat2, included: true),
              _FeatureRow(text: s.freeFeat3, included: false),
            ],
          ),
          const SizedBox(height: 16),

          // ---------- الخطة المميزة ----------
          _PlanCard(
            highlighted: state.isPremium,
            tag: state.isPremium ? s.currentPlanTag : s.mostPopular,
            title: '👑 ${s.premiumPlan}',
            price: price,
            per: per,
            children: [
              for (final feature in premiumFeatures)
                _FeatureRow(text: feature, included: true),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => _togglePremium(context, state, s),
                style: state.isPremium
                    ? ElevatedButton.styleFrom(backgroundColor: wq.missed)
                    : null,
                child: Text(
                  state.isPremium ? s.cancelSubscription : s.subscribeNow,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(
              s.simulatedNote,
              style: TextStyle(fontSize: 11.5, color: wq.textMuted),
            ),
          ),
        ],
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.highlighted,
    required this.tag,
    required this.title,
    required this.price,
    required this.per,
    required this.children,
  });

  final bool highlighted;
  final String? tag;
  final String title;
  final String price;
  final String per;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final wq = context.wq;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        WqCard(
          padding: const EdgeInsets.all(22),
          borderColor: highlighted ? wq.primary : null,
          borderWidth: highlighted ? 2 : 1,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    price,
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (per.isNotEmpty) ...[
                    const SizedBox(width: 4),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        per,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: wq.textMuted,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 14),
              ...children,
            ],
          ),
        ),
        if (tag != null)
          PositionedDirectional(
            top: -11,
            start: 20,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: BoxDecoration(
                color: wq.primary,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                tag!,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({required this.text, required this.included});

  final String text;
  final bool included;

  @override
  Widget build(BuildContext context) {
    final wq = context.wq;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.5),
      child: Row(
        children: [
          Icon(
            included ? Icons.check_circle : Icons.cancel_outlined,
            size: 16,
            color: included ? wq.done : wq.textMuted,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 12.5,
                color: included ? wq.text : wq.textMuted,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
