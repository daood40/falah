// Widget tests: shell navigation, four states, RTL, persistence, a11y scale.
import 'package:falah/app/providers.dart';
import 'package:falah/core/settings/settings.dart';
import 'package:falah/features/quran/data/quran_repository.dart';
import 'package:falah/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<SharedPreferences> _mockPrefs() async {
  SharedPreferences.setMockInitialValues({});
  return SharedPreferences.getInstance();
}

/// One shared, pre-warmed repository: real rootBundle loads only work
/// reliably in the first test of a file, so all 114 surahs are cached in
/// setUpAll and every pump gets cache hits (no I/O inside the pump loop).
final _repo = QuranRepository();

/// Bounded settle: real async I/O (asset loads) runs inside runAsync, and the
/// looping spinner would make pumpAndSettle hang forever (see flutter-testing).
Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 100; i++) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 50)),
    );
    await tester.pump(const Duration(milliseconds: 50));
    final loading = tester
        .widgetList<CircularProgressIndicator>(
          find.byType(CircularProgressIndicator),
        )
        .any((w) => w.value == null);
    if (!loading && i >= 3) break;
  }
}

Future<SharedPreferences> _pumpApp(WidgetTester tester) async {
  final prefs = await _mockPrefs();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        prefsProvider.overrideWithValue(prefs),
        quranRepositoryProvider.overrideWithValue(_repo),
      ],
      child: const FalahApp(),
    ),
  );
  await _settle(tester);
  return prefs;
}

Finder _navIcon(IconData icon) => find.descendant(
  of: find.byType(NavigationBar),
  matching: find.byIcon(icon),
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await _repo.listSurahs();
    for (var n = 1; n <= 114; n++) {
      await _repo.getSurahAyahs(n);
    }
  });

  testWidgets('shell renders 4 destinations in Arabic RTL', (tester) async {
    await _pumpApp(tester);

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('الرئيسية'), findsOneWidget);
    expect(find.text('السبحة'), findsWidgets);
    expect(find.text('الإعدادات'), findsOneWidget);
    final context = tester.element(find.byType(NavigationBar));
    expect(Directionality.of(context), TextDirection.rtl);
  });

  testWidgets('home shows the verified verse of the day', (tester) async {
    await _pumpApp(tester);

    expect(find.text('آية اليوم'), findsOneWidget);
    expect(find.textContaining('موثّق'), findsWidgets);
    expect(find.textContaining('﴿'), findsOneWidget);
  });

  testWidgets('quran tab lists 114 surahs and opens the reader', (
    tester,
  ) async {
    await _pumpApp(tester);

    await tester.tap(_navIcon(Icons.menu_book_outlined));
    await _settle(tester);
    expect(find.text('الفاتحة'), findsOneWidget);

    await tester.tap(find.text('الفاتحة'));
    await _settle(tester);
    expect(find.textContaining('﴿1﴾'), findsOneWidget);
    expect(find.textContaining('بِسۡمِ'), findsWidgets);
  });

  testWidgets('quran search resolves a direct reference', (tester) async {
    await _pumpApp(tester);

    await tester.tap(_navIcon(Icons.menu_book_outlined));
    await _settle(tester);

    await tester.enterText(find.byType(TextField), '2:255');
    await _settle(tester);
    expect(find.textContaining('255'), findsWidgets);
    expect(find.textContaining('موثّق'), findsWidgets);

    await tester.enterText(find.byType(TextField), 'zzzzzz');
    await _settle(tester);
    expect(find.text('لا توجد نتائج'), findsOneWidget);
  });

  testWidgets('tasbih ticks, persists the daily total and resets', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final prefs = await _pumpApp(tester);

    await tester.tap(_navIcon(Icons.radio_button_unchecked));
    await _settle(tester);
    expect(find.text('0'), findsWidgets);

    await tester.tap(find.text('0').first);
    await tester.pump();
    await tester.tap(find.text('1').first);
    await tester.pump();
    expect(find.text('2'), findsWidgets);

    final today = prefs
        .getKeys()
        .where((k) => k.startsWith('tasbih.total.'))
        .toList();
    expect(today, hasLength(1));
    expect(prefs.getInt(today.first), 2);

    await tester.ensureVisible(find.text('تصفير'));
    await tester.tap(find.text('تصفير'));
    await tester.pump();
    expect(find.text('0'), findsWidgets);

    await tester.ensureVisible(find.text('100'));
    await tester.tap(find.text('100'));
    await tester.pump();
    expect(prefs.getInt('tasbih.target'), 100);
  });

  testWidgets('settings persist theme mode and switch language live', (
    tester,
  ) async {
    final prefs = await _pumpApp(tester);

    await tester.tap(_navIcon(Icons.settings_outlined));
    await _settle(tester);

    await tester.tap(find.text('داكن'));
    await _settle(tester);
    expect(prefs.getString('settings.themeMode'), 'dark');

    await tester.tap(find.text('English'));
    await _settle(tester);
    expect(prefs.getString('settings.locale'), 'en');
    expect(find.text('Settings'), findsWidgets);
    final context = tester.element(find.byType(NavigationBar));
    expect(Directionality.of(context), TextDirection.ltr);
  });

  testWidgets('home survives 1.3x text scale without overflow', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.platformDispatcher.clearAllTestValues);

    await _pumpApp(tester);
    expect(tester.takeException(), isNull);
    expect(find.text('آية اليوم'), findsOneWidget);
  });
}
