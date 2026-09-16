/// Default [HttpTransport] backed by `dart:io`. Mobile and desktop only;
/// web builds should provide their own transport implementation.
library;

import 'dart:convert';
import 'dart:io';

import 'api_client.dart';

class IoHttpTransport implements HttpTransport {
  IoHttpTransport({Duration timeout = const Duration(seconds: 15)})
    : _client = HttpClient()..connectionTimeout = timeout;

  final HttpClient _client;

  @override
  Future<HttpTransportResponse> send(
    String method,
    Uri url, {
    Map<String, String> headers = const {},
    String? body,
  }) async {
    final request = await _client.openUrl(method, url);
    headers.forEach(request.headers.set);
    if (body != null) request.add(utf8.encode(body));
    final response = await request.close();
    final text = await response.transform(utf8.decoder).join();
    return HttpTransportResponse(response.statusCode, text);
  }

  void close() => _client.close(force: true);
}
