// Offline cache rules (§23): dataset version, checksum, age.
import 'package:falah_hadith_api/falah_hadith_api.dart';
import 'package:flutter_test/flutter_test.dart';

Hadith _hadith({String id = 'h1', String version = 'V1', String hash = 'a'}) => Hadith.fromJson({
      'id': id,
      'number': '1',
      'text': 'TEST DATA — نصّ اختباري',
      'text_available': true,
      'source': {'id': 's', 'name': 'TEST SOURCE'},
      'book': {'id': 'b', 'name': 'كتاب اختباري'},
      'chapter': {'id': 'c', 'title': 'باب اختباري'},
      'location': {'volume': 1, 'page': 5, 'locator': 'ج1/ص5/#1'},
      'dataset': {'version': version, 'hash': hash * 64, 'dataset_hash': 'd' * 64},
      'verification': {'verified': false, 'status': 'pending'},
      'source_locked': true,
    });

ApiVersion _version({String hash = 'd', String version = 'V1'}) => ApiVersion.fromJson({
      'api_version': 'v1',
      'dataset_version': version,
      'dataset_hash': hash * 64,
      'record_count': 10,
      'status': 'sealed',
      'content_license_confirmed': false,
    });

void main() {
  test('serves a record that still matches the dataset it came from', () {
    final cache = HadithCache()..syncDataset(_version());
    cache.put(_hadith());
    expect(cache.inspect('h1'), CacheVerdict.fresh);
    expect(cache.get('h1')?.id, 'h1');
  });

  test('a changed dataset fingerprint invalidates everything', () {
    final cache = HadithCache()..syncDataset(_version());
    cache.put(_hadith());
    expect(cache.length, 1);

    final changed = cache.syncDataset(_version(hash: 'e', version: 'V2'));
    expect(changed, isTrue);
    expect(cache.length, 0);
    expect(cache.get('h1'), isNull);
  });

  test('a record from another dataset version is rejected, not served', () {
    final cache = HadithCache()..syncDataset(_version(version: 'V2'));
    cache.put(_hadith(version: 'V1'));
    expect(cache.inspect('h1'), CacheVerdict.staleDataset);
    expect(cache.get('h1'), isNull);
    expect(cache.length, 0); // dropped on read
  });

  test('an expired entry is dropped rather than shown', () {
    final cache = HadithCache(maxAge: const Duration(days: 1))..syncDataset(_version());
    cache.put(_hadith());
    final later = DateTime.now().add(const Duration(days: 2));
    expect(cache.inspect('h1', now: later), CacheVerdict.expired);
    expect(cache.get('h1', now: later), isNull);
  });

  test('a server copy with a different hash is reported as a mismatch', () {
    final cache = HadithCache()..syncDataset(_version());
    cache.put(_hadith(hash: 'a'));
    expect(cache.matches(_hadith(hash: 'a')), isTrue);
    expect(cache.matches(_hadith(hash: 'b')), isFalse);
  });

  test('a missing id is a plain miss', () {
    final cache = HadithCache()..syncDataset(_version());
    expect(cache.inspect('nope'), CacheVerdict.missing);
    expect(cache.get('nope'), isNull);
  });

  test('entries round-trip through JSON for persistence', () {
    final entry = CachedEntry<Hadith>(
      key: 'h1', data: _hadith(), datasetVersion: 'V1', contentHash: 'a' * 64,
      fetchedAt: DateTime.utc(2026, 1, 1),
    );
    final json = entry.toJson((h) => {
          'id': h.id, 'number': h.number, 'text': h.text, 'text_available': h.textAvailable,
          'location': {'volume': h.location.volume, 'page': h.location.page},
          'dataset': {'version': h.dataset.version, 'hash': h.dataset.hash},
          'verification': {'verified': false, 'status': 'pending'},
        });
    final back = CachedEntry.fromJson<Hadith>(json, Hadith.fromJson);
    expect(back?.data.id, 'h1');
    expect(back?.contentHash, 'a' * 64);
  });
}
