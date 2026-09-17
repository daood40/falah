/// Thin HTTP client for the FALAH Hadith API.
///
/// It talks ONLY to the FALAH API — never to ketabonline.com or any other
/// source site, and never with a service-role key. The app ships no secret:
/// the public endpoints need no credential at all.
library;

import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiException implements Exception {
  ApiException(this.code, this.message, {this.statusCode});

  final String code;
  final String message;
  final int? statusCode;

  bool get isNotFound => code == 'NOT_FOUND';

  @override
  String toString() => 'ApiException($code): $message';
}

class ApiResponse {
  const ApiResponse(this.data, this.meta);

  final Object? data;
  final Map<String, dynamic> meta;
}

class HadithApiClient {
  HadithApiClient({required this.baseUrl, http.Client? client, this.timeout = const Duration(seconds: 15)})
      : _client = client ?? http.Client();

  final String baseUrl;
  final Duration timeout;
  final http.Client _client;

  Future<ApiResponse> get(String path, {Map<String, dynamic>? query}) async {
    final uri = Uri.parse('$baseUrl$path').replace(
      queryParameters: query?.map((k, v) => MapEntry(k, '$v'))
        ?..removeWhere((_, v) => v.isEmpty),
    );

    final http.Response response;
    try {
      response = await _client.get(uri, headers: const {'accept': 'application/json'}).timeout(timeout);
    } on Exception catch (e) {
      throw ApiException('NETWORK_ERROR', e.toString());
    }

    Map<String, dynamic> body;
    try {
      body = jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
    } on FormatException {
      throw ApiException('INVALID_RESPONSE', 'Response was not JSON', statusCode: response.statusCode);
    }

    if (body['success'] != true) {
      final error = body['error'] as Map<String, dynamic>?;
      throw ApiException(
        error?['code'] as String? ?? 'INTERNAL_ERROR',
        error?['message'] as String? ?? 'Request failed',
        statusCode: response.statusCode,
      );
    }
    return ApiResponse(body['data'], (body['meta'] as Map<String, dynamic>?) ?? const {});
  }

  void close() => _client.close();
}
