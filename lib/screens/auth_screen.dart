import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/l10n.dart';
import '../core/theme.dart';
import '../state/app_state.dart';
import '../widgets/common.dart';

/// شاشة تسجيل الدخول/إنشاء الحساب.
///
/// المصادقة محاكاة محلية (كما في النموذج الأصلي): لا يوجد خادم،
/// والبيانات تُحفظ على الجهاز فقط.
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _isSignup = false;
  bool _obscurePassword = true;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _submit() {
    final state = context.read<AppState>();
    final s = AppStrings.of(state.lang);
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || password.isEmpty || (_isSignup && name.isEmpty)) {
      setState(() => _error = s.fillFields);
      return;
    }
    final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
    if (!emailRegex.hasMatch(email)) {
      setState(() => _error = s.invalidEmail);
      return;
    }
    if (password.length < 6) {
      setState(() => _error = s.shortPassword);
      return;
    }
    state.signIn(name: _isSignup ? name : email.split('@').first, email: email);
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final s = AppStrings.of(state.lang);
    final wq = context.wq;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(26),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: Column(
                children: [
                  _Logo(appName: s.appName, subtitle: s.authSubtitle),
                  const SizedBox(height: 26),
                  WqCard(
                    padding: const EdgeInsets.all(22),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SegmentedPills(
                          options: [s.login, s.signup],
                          selectedIndex: _isSignup ? 1 : 0,
                          onSelected: (i) => setState(() {
                            _isSignup = i == 1;
                            _error = null;
                          }),
                        ),
                        const SizedBox(height: 18),
                        Text(
                          _isSignup ? s.createAccountTitle : s.welcomeBack,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 14),
                        if (_isSignup) ...[
                          _label(s.fullName, wq),
                          TextField(
                            controller: _nameController,
                            textInputAction: TextInputAction.next,
                          ),
                          const SizedBox(height: 14),
                        ],
                        _label(s.email, wq),
                        TextField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          textDirection: TextDirection.ltr,
                          decoration: const InputDecoration(
                            hintText: 'name@example.com',
                            hintTextDirection: TextDirection.ltr,
                          ),
                        ),
                        const SizedBox(height: 14),
                        _label(s.password, wq),
                        TextField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          textInputAction: TextInputAction.done,
                          onSubmitted: (_) => _submit(),
                          decoration: InputDecoration(
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                                size: 19,
                                color: wq.textMuted,
                              ),
                              onPressed: () => setState(
                                () => _obscurePassword = !_obscurePassword,
                              ),
                            ),
                          ),
                        ),
                        if (!_isSignup)
                          Align(
                            alignment: AlignmentDirectional.centerEnd,
                            child: TextButton(
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(s.resetLinkSent)),
                                );
                              },
                              child: Text(
                                s.forgotPassword,
                                style: const TextStyle(fontSize: 12),
                              ),
                            ),
                          )
                        else
                          const SizedBox(height: 14),
                        if (_error != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Text(
                              _error!,
                              style: TextStyle(
                                color: wq.missed,
                                fontSize: 11.5,
                              ),
                            ),
                          ),
                        ElevatedButton(
                          onPressed: _submit,
                          child: Text(_isSignup ? s.signup : s.login),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(child: Divider(color: wq.border)),
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                              ),
                              child: Text(
                                s.orContinueWith,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: wq.textMuted,
                                ),
                              ),
                            ),
                            Expanded(child: Divider(color: wq.border)),
                          ],
                        ),
                        const SizedBox(height: 16),
                        _OAuthButton(
                          label: s.continueGoogle,
                          icon: '🔴',
                          onTap: () =>
                              state.signIn(name: 'Google User', email: ''),
                        ),
                        const SizedBox(height: 9),
                        _OAuthButton(
                          label: s.continueApple,
                          icon: '🍎',
                          onTap: () =>
                              state.signIn(name: 'Apple User', email: ''),
                        ),
                        const SizedBox(height: 14),
                        TextButton(
                          onPressed: () => setState(() {
                            _isSignup = !_isSignup;
                            _error = null;
                          }),
                          child: Text(
                            '${_isSignup ? s.haveAccount : s.noAccount} '
                            '${_isSignup ? s.login : s.signup}',
                          ),
                        ),
                        TextButton(
                          onPressed: () => state.signInAsGuest(s.guestUser),
                          style: TextButton.styleFrom(
                            foregroundColor: wq.textMuted,
                          ),
                          child: Text(
                            s.continueGuest,
                            style: const TextStyle(
                              fontWeight: FontWeight.w400,
                              fontSize: 12.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _label(String text, WaqtiColors wq) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(
      text,
      style: TextStyle(
        fontSize: 12.5,
        fontWeight: FontWeight.w600,
        color: wq.textMuted,
      ),
    ),
  );
}

class _Logo extends StatelessWidget {
  const _Logo({required this.appName, required this.subtitle});

  final String appName;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final wq = context.wq;
    return Column(
      children: [
        Container(
          width: 64,
          height: 64,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [wq.primary, wq.primaryDark],
            ),
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: wq.primaryDark.withValues(alpha: .3),
                blurRadius: 24,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: const Text('⏳', style: TextStyle(fontSize: 30)),
        ),
        const SizedBox(height: 10),
        Text(
          appName,
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 4),
        Text(subtitle, style: TextStyle(fontSize: 12.5, color: wq.textMuted)),
      ],
    );
  }
}

class _OAuthButton extends StatelessWidget {
  const _OAuthButton({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final String icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final wq = context.wq;
    return Material(
      color: wq.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: wq.border),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 11),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(icon, style: const TextStyle(fontSize: 14)),
              const SizedBox(width: 8),
              Text(
                label,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
