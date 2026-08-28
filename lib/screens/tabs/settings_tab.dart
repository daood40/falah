import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/app_info.dart';
import '../../core/l10n.dart';
import '../../core/theme.dart';
import '../../state/app_state.dart';
import '../../widgets/common.dart';
import '../subscription_screen.dart';

/// تبويب الإعدادات: الحساب، الاشتراك، اللغة، المظهر،
/// الإشعارات، وإدارة البيانات.
class SettingsTab extends StatelessWidget {
  const SettingsTab({super.key});

  Future<void> _exportData(
    BuildContext context,
    AppState state,
    AppStrings s,
  ) async {
    await Clipboard.setData(ClipboardData(text: state.exportJson()));
    if (!context.mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(s.exportCopied)));
  }

  Future<void> _importData(
    BuildContext context,
    AppState state,
    AppStrings s,
  ) async {
    final controller = TextEditingController();
    final imported = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(s.importData),
        content: TextField(
          controller: controller,
          minLines: 4,
          maxLines: 8,
          decoration: InputDecoration(hintText: s.importHint),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(s.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(
              dialogContext,
            ).pop(state.importJson(controller.text)),
            child: Text(s.importData),
          ),
        ],
      ),
    );
    controller.dispose();
    if (imported == null || !context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(imported ? s.importSuccess : s.invalidFile)),
    );
  }

  Future<void> _logout(
    BuildContext context,
    AppState state,
    AppStrings s,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(s.logout),
        content: Text(s.logoutConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(s.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(s.logout),
          ),
        ],
      ),
    );
    if (confirmed == true) state.signOut();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final s = AppStrings.of(state.lang);
    final wq = context.wq;
    final user = state.user;
    final displayName = (user?.name.isNotEmpty ?? false)
        ? user!.name
        : s.guestUser;
    final initial = displayName.characters.first.toUpperCase();

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        SectionTitle(s.settings, topPadding: 0),

        // ---------- الحساب ----------
        _Group(
          title: s.accountSection,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [wq.primary, wq.primaryDark],
                      ),
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      initial,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                displayName,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 14.5,
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: state.isPremium
                                    ? const Color(0xFFF4DFA0)
                                    : wq.surfaceAlt,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                state.isPremium
                                    ? '👑 ${s.premiumTag}'
                                    : s.freeTag,
                                style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w800,
                                  color: state.isPremium
                                      ? const Color(0xFF8A6A1F)
                                      : wq.textMuted,
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (user != null && user.email.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              user.email,
                              style: TextStyle(
                                fontSize: 12,
                                color: wq.textMuted,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => _logout(context, state, s),
                child: Text('🚪 ${s.logout}'),
              ),
            ],
          ),
        ),

        // ---------- الاشتراك ----------
        _Group(
          title: '',
          onTap: () => SubscriptionScreen.push(context),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '💎 ${s.subscriptionSection}',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Row(
                children: [
                  Text(
                    state.isPremium ? s.manageSubscription : s.upgradeNow,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: wq.primaryDark,
                    ),
                  ),
                  Icon(
                    Directionality.of(context) == TextDirection.rtl
                        ? Icons.chevron_left
                        : Icons.chevron_right,
                    size: 18,
                    color: wq.primaryDark,
                  ),
                ],
              ),
            ],
          ),
        ),

        // ---------- اللغة ----------
        _Group(
          title: s.language,
          child: SegmentedPills(
            options: const ['العربية', 'English'],
            selectedIndex: state.lang == 'ar' ? 0 : 1,
            onSelected: (i) => state.setLang(i == 0 ? 'ar' : 'en'),
          ),
        ),

        // ---------- المظهر ----------
        _Group(
          title: s.theme,
          child: SegmentedPills(
            options: ['☀️ ${s.light}', '🌙 ${s.dark}', '📱 ${s.system}'],
            selectedIndex: switch (state.themeMode) {
              ThemeMode.light => 0,
              ThemeMode.dark => 1,
              ThemeMode.system => 2,
            },
            onSelected: (i) => state.setThemeMode(switch (i) {
              1 => ThemeMode.dark,
              2 => ThemeMode.system,
              _ => ThemeMode.light,
            }),
          ),
        ),

        // ---------- الإشعارات ----------
        _Group(
          title: s.notifSettings,
          child: Column(
            children: [
              _SwitchRow(
                label: s.masterNotif,
                value: state.notifMaster,
                onChanged: state.setNotifMaster,
              ),
              Divider(color: wq.border, height: 1),
              _SwitchRow(
                label: s.morningRecap,
                value: state.morningRecap,
                onChanged: state.notifMaster ? state.setMorningRecap : null,
              ),
              Divider(color: wq.border, height: 1),
              _SwitchRow(
                label: s.eveningRecap,
                value: state.eveningRecap,
                onChanged: state.notifMaster ? state.setEveningRecap : null,
              ),
            ],
          ),
        ),

        // ---------- إدارة البيانات ----------
        _Group(
          title: s.dataMgmt,
          child: Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _exportData(context, state, s),
                  icon: const Icon(Icons.download_rounded, size: 17),
                  label: Text(s.exportData),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => _importData(context, state, s),
                  icon: const Icon(Icons.upload_rounded, size: 17),
                  label: Text(s.importData),
                ),
              ),
            ],
          ),
        ),

        // ---------- حول التطبيق ----------
        _Group(
          title: s.about,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(s.aboutDesc, style: const TextStyle(fontSize: 13)),
              const SizedBox(height: 8),
              Text(
                '${s.aboutVersion}: $kAppVersion',
                style: TextStyle(fontSize: 12, color: wq.textMuted),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({required this.title, required this.child, this.onTap});

  final String title;
  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: WqCard(
        onTap: onTap,
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (title.isNotEmpty) ...[
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
            ],
            child,
          ],
        ),
      ),
    );
  }
}

class _SwitchRow extends StatelessWidget {
  const _SwitchRow({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Opacity(
              opacity: onChanged == null ? .5 : 1,
              child: Text(label, style: const TextStyle(fontSize: 13.5)),
            ),
          ),
          Switch(value: value, onChanged: onChanged),
        ],
      ),
    );
  }
}
