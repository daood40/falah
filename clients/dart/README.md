# FALAH Hadith API — Dart / Flutter client

Three files, one dependency (`http`). Works in Flutter and in plain Dart.

```yaml
dependencies:
  http: ^1.2.2
```

```bash
cp models.dart hadith_api_client.dart hadith_repository.dart lib/hadith_api/
```

```dart
final repo = HadithRepository(HadithApiClient(baseUrl: 'http://127.0.0.1:8787'));

final page = await repo.listHadiths(limit: 20);
final hit  = await repo.search('إنما الأعمال بالنيات');
final books = await repo.catalog(chapters: true);
final checks = await repo.crossChecks(page.items.first.id);

for (final h in page.items) {
  // null while the server withholds the text — show nothing rather than guess
  if (h.textAvailable) print(h.rawText);
  print('${h.book?.name} · ج${h.volume} ص${h.page} · ${h.grading}');
}
```

Errors arrive as `ApiException` carrying the API's own `code`.
The Flutter app in this repository uses the same three files through Riverpod —
see `flutter_app/lib/features/hadith/`.
