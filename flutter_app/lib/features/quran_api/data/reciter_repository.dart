/// Reciter repository. Returns exactly what the API holds — an empty list when
/// no licensed reciter has been imported, never a placeholder reciter.
library;

import '../domain/models.dart';
import '../domain/repositories.dart';
import 'audio_api_data_source.dart';

class ReciterRepository implements ReciterRepositoryContract {
  const ReciterRepository(this._remote);

  final AudioApiDataSource _remote;

  @override
  Future<List<QuranReciter>> getReciters({String? search}) async {
    final result = await _remote.listReciters(search: search, limit: 100);
    return result.items;
  }

  @override
  Future<QuranReciter> getReciter(String idOrSlug) =>
      _remote.getReciter(idOrSlug);

  @override
  Future<List<QuranRiwayah>> getRiwayat(String idOrSlug) =>
      _remote.getReciterRiwayat(idOrSlug);

  @override
  Future<List<QuranRecitation>> getRecitations(String idOrSlug) =>
      _remote.getRecitations(idOrSlug);
}
