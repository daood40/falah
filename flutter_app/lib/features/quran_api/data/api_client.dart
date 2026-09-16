/// Thin HTTP client for the FALAH Quran API.
///
/// Responsibilities: build `/api/v1` URLs, attach the Supabase access token,
/// unwrap the `{ success, data, meta }` envelope and turn API errors into
/// [QuranApiException]. It never mutates returned text (SOURCE_LOCK).
library;

import 'dart:async';
import 'dart:convert';

import '../domain/models.dart';

/// Transport port — keeps the client testable and web/mobile agnostic.
abstract class HttpTransport {
  Future<HttpTransportResponse> send(
    String method,
    Uri url, {
    Map<String, String> headers = const {},
    String? body,
  });
}

class HttpTransportResponse {
  const HttpTransportResponse(this.statusCode, this.body);
  final int statusCode;
  final String body;
}

class QuranApiException implements Exception {
  const QuranApiException(this.code, this.message, {this.statusCode});

  final String code;
  final String message;
  final int? statusCode;

  bool get isUnauthorized => code == 'UNAUTHORIZED';

  /// The API withholds content until redistribution rights are confirmed.
  bool get isLicenseRestricted => code == 'LICENSE_RESTRICTED';

  bool get isNotFound => code == 'NOT_FOUND';

  @override
  String toString() => 'QuranApiException($code): $message';
}

typedef TokenProvider = FutureOr<String?> Function();

class QuranApiClient {
  QuranApiClient({
    required this.baseUrl,
    required HttpTransport transport,
    TokenProvider? tokenProvider,
  }) : _transport = transport,
       _tokenProvider = tokenProvider;

  /// e.g. `https://api.example.com` — the client appends `/api/v1/...`.
  final String baseUrl;
  final HttpTransport _transport;
  final TokenProvider? _tokenProvider;

  Uri _uri(String path, [Map<String, String?> query = const {}]) {
    final cleaned = <String, String>{
      for (final entry in query.entries)
        if (entry.value != null && entry.value!.isNotEmpty)
          entry.key: entry.value!,
    };
    final base = Uri.parse('$baseUrl/api/v1$path');
    return cleaned.isEmpty ? base : base.replace(queryParameters: cleaned);
  }

  Future<ApiEnvelope<T>> get<T>(
    String path, {
    Map<String, String?> query = const {},
    required T Function(Object? data) parse,
  }) => _send('GET', path, query: query, parse: parse);

  Future<ApiEnvelope<T>> post<T>(
    String path, {
    Map<String, dynamic> body = const {},
    required T Function(Object? data) parse,
  }) => _send('POST', path, body: body, parse: parse);

  Future<ApiEnvelope<T>> put<T>(
    String path, {
    Map<String, dynamic> body = const {},
    required T Function(Object? data) parse,
  }) => _send('PUT', path, body: body, parse: parse);

  Future<ApiEnvelope<T>> delete<T>(
    String path, {
    required T Function(Object? data) parse,
  }) => _send('DELETE', path, parse: parse);

  Future<ApiEnvelope<T>> _send<T>(
    String method,
    String path, {
    Map<String, String?> query = const {},
    Map<String, dynamic>? body,
    required T Function(Object? data) parse,
  }) async {
    final token = await _tokenProvider?.call();
    final response = await _transport.send(
      method,
      _uri(path, query),
      headers: {
        'accept': 'application/json',
        if (body != null) 'content-type': 'application/json',
        if (token != null && token.isNotEmpty) 'authorization': 'Bearer $token',
      },
      body: body == null ? null : jsonEncode(body),
    );

    Map<String, dynamic> decoded;
    try {
      decoded = (jsonDecode(response.body) as Map).cast<String, dynamic>();
    } on FormatException {
      throw QuranApiException(
        'INVALID_RESPONSE',
        'Unexpected response from the server',
        statusCode: response.statusCode,
      );
    }

    if (decoded['success'] != true) {
      final error = (decoded['error'] as Map?)?.cast<String, dynamic>() ?? const {};
      throw QuranApiException(
        error['code'] as String? ?? 'INTERNAL_ERROR',
        error['message'] as String? ?? 'Request failed',
        statusCode: response.statusCode,
      );
    }

    return ApiEnvelope<T>(
      data: parse(decoded['data']),
      meta: (decoded['meta'] as Map?)?.cast<String, dynamic>() ?? const {},
    );
  }
}

/// Helper for list endpoints.
List<T> parseList<T>(Object? data, T Function(Map<String, dynamic>) item) =>
    (data as List? ?? const [])
        .cast<Map<String, dynamic>>()
        .map(item)
        .toList(growable: false);
