// §27 — the API base URL comes from the environment, and a release build must
// never ship pointing at a development host.
import 'package:falah/features/hadith/data/hadith_providers.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('development accepts a local host', () {
    expect(isUsableApiBaseUrl('http://127.0.0.1:8787', releaseMode: false), isTrue);
    expect(isUsableApiBaseUrl('http://10.0.2.2:8787', releaseMode: false), isTrue);
  });

  test('release refuses localhost, plain http and an empty value', () {
    for (final url in [
      'http://127.0.0.1:8787',
      'http://localhost:8787',
      'http://10.0.2.2:8787',
      'http://api.falah.app',
      '',
      'not a url',
    ]) {
      expect(isUsableApiBaseUrl(url, releaseMode: true), isFalse, reason: url);
    }
  });

  test('release accepts an https host', () {
    expect(isUsableApiBaseUrl('https://api.falah.app', releaseMode: true), isTrue);
    expect(isUsableApiBaseUrl('https://api.staging.falah.app/', releaseMode: true), isTrue);
  });
}
