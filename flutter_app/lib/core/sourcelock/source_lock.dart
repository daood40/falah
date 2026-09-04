/// SOURCE LOCK — the most important rule in FALAH (ported 1:1 from the PWA).
///
/// Religious text may ONLY enter the system attached to verifiable source
/// metadata. Nothing — including the AI assistant — may author, alter, or
/// attribute religious text.
///
/// Pipeline: SOURCE → FETCH → NORMALIZE → VERIFY → DISPLAY → USER APPROVAL
/// → EXPORT/PUBLISH. A text that fails verification is BLOCKED.
library;

import 'dart:convert';

import 'package:crypto/crypto.dart';

enum ReviewStatus { verified, pendingReview, blocked }

class SourceLockException implements Exception {
  final String message;
  const SourceLockException(this.message);
  @override
  String toString() => 'SourceLockException: $message';
}

class SourceMetadata {
  final String sourceId;
  final String sourceName;
  final String sourceUrl;
  final String sourceVersion;
  final String? verifiedAt;
  final ReviewStatus reviewStatus;

  const SourceMetadata({
    required this.sourceId,
    required this.sourceName,
    required this.sourceUrl,
    required this.sourceVersion,
    required this.verifiedAt,
    required this.reviewStatus,
  });

  SourceMetadata copyWith({String? sourceId, ReviewStatus? reviewStatus}) =>
      SourceMetadata(
        sourceId: sourceId ?? this.sourceId,
        sourceName: sourceName,
        sourceUrl: sourceUrl,
        sourceVersion: sourceVersion,
        verifiedAt: verifiedAt,
        reviewStatus: reviewStatus ?? this.reviewStatus,
      );
}

/// A piece of religious text the system is allowed to display/export.
/// Immutable by construction (all fields final, no setters).
class LockedText {
  final String text;
  final String checksum;
  final SourceMetadata source;

  const LockedText({
    required this.text,
    required this.checksum,
    required this.source,
  });
}

/// SHA-256 hex digest of the UTF-8 bytes.
String checksumOf(String text) => sha256.convert(utf8.encode(text)).toString();

final _spaces = RegExp(r'[ \t]+');
final _newlines = RegExp(r'\s*\n\s*');

/// Normalize whitespace only — the text itself is NEVER altered.
String normalizeSacredText(String raw) =>
    raw.replaceAll(_spaces, ' ').replaceAll(_newlines, '\n').trim();

/// Wrap fetched source text into an immutable [LockedText] with checksum.
LockedText lockText(String rawText, SourceMetadata source) {
  final text = normalizeSacredText(rawText);
  if (text.isEmpty) {
    throw const SourceLockException('Refusing to lock empty religious text');
  }
  if (source.sourceId.isEmpty || source.sourceName.isEmpty) {
    throw const SourceLockException(
        'Religious text requires source_id and source_name');
  }
  return LockedText(text: text, checksum: checksumOf(text), source: source);
}

/// Verify a [LockedText] has not been tampered with since it was locked.
bool verifyLockedText(LockedText locked) =>
    checksumOf(locked.text) == locked.checksum;

/// Publish/export gate. Throws [SourceLockException] when content must be
/// blocked. [userApproved] is the explicit human approval pipeline step.
void assertPublishable(LockedText locked, {required bool userApproved}) {
  if (locked.source.reviewStatus == ReviewStatus.blocked) {
    throw SourceLockException('Source ${locked.source.sourceId} is blocked');
  }
  if (!verifyLockedText(locked)) {
    throw const SourceLockException(
        'Checksum mismatch: text was modified after verification');
  }
  if (!userApproved) {
    throw const SourceLockException(
        'User approval is required before export/publish');
  }
}

/// Status precedence when combining multiple sacred texts in one design.
ReviewStatus combineReviewStatus(List<ReviewStatus> statuses) {
  if (statuses.contains(ReviewStatus.blocked)) return ReviewStatus.blocked;
  if (statuses.contains(ReviewStatus.pendingReview)) {
    return ReviewStatus.pendingReview;
  }
  return ReviewStatus.verified;
}
