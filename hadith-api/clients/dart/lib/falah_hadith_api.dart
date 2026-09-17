/// Dart client for the FALAH Hadith API.
///
/// SOURCE_LOCK: every field is exactly what the API returned. Text fields are
/// null while the server withholds them; nothing is ever substituted.
library falah_hadith_api;

export 'src/client.dart';
export 'src/models.dart';
export 'src/repository.dart';
