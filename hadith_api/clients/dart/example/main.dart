/// A minimal, runnable example: read the dataset identity, then one page and
/// one record. Nothing here writes, and nothing substitutes withheld text.
///
///   dart run example/main.dart http://127.0.0.1:8787
library;

import 'package:falah_hadith_api/falah_hadith_api.dart';

Future<void> main(List<String> args) async {
  final baseUrl = args.isNotEmpty ? args.first : 'http://127.0.0.1:8787';
  final repo = HadithRepository(HadithApiClient(baseUrl: baseUrl));

  final version = await repo.getVersion();
  print('dataset ${version.datasetVersion} · ${version.recordCount} records');
  print('text published: ${version.contentLicenseConfirmed}');

  final page = await repo.getHadiths(limit: 5);
  print('page 1 of ${page.totalPages} · ${page.total} records');

  final hadith = await repo.getHadith(
    page.items.first.id,
    include: const ['takhrij', 'gradings', 'verification'],
  );
  print('locator     ${hadith.location.locator}');
  print('book        ${hadith.book?.name}');
  print('grading     ${hadith.gradings.isEmpty ? '—' : hadith.gradings.first.text}');
  print('takhrij     ${hadith.takhrij?.sources.join('، ') ?? '—'}');
  print('verified    ${hadith.verification.verified}');
  print('text        ${hadith.textAvailable ? hadith.displayText : '(withheld by licence gate)'}');
}
