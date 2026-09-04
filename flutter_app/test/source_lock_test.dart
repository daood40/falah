// Source Lock: the most critical logic in FALAH — the migration contract.
// Ported 1:1 from the PWA's sourceLock.test.ts.
import 'package:falah/core/sourcelock/context_validation.dart';
import 'package:falah/core/sourcelock/source_lock.dart';
import 'package:flutter_test/flutter_test.dart';

const source = SourceMetadata(
  sourceId: 'tanzil-uthmani',
  sourceName: 'Tanzil',
  sourceUrl: 'https://tanzil.net',
  sourceVersion: '1.1',
  verifiedAt: '2026-01-01T00:00:00Z',
  reviewStatus: ReviewStatus.verified,
);

void main() {
  group('sourceLock', () {
    test('locks text with a 64-char sha256 checksum that verifies', () {
      final locked = lockText('بسم الله الرحمن الرحيم', source);
      expect(locked.checksum.length, 64);
      expect(verifyLockedText(locked), isTrue);
    });

    test('checksum matches the PWA implementation for identical text', () {
      // Cross-platform contract: same input must hash identically on web
      // (SubtleCrypto) and Dart (package:crypto).
      expect(
        checksumOf('abc'),
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });

    test('refuses empty text and missing source metadata', () {
      expect(() => lockText('   ', source),
          throwsA(isA<SourceLockException>()));
      expect(
        () => lockText('نص', source.copyWith(sourceId: '')),
        throwsA(isA<SourceLockException>()),
      );
    });

    test('detects tampering via checksum mismatch', () {
      final locked = lockText('إنما الأعمال بالنيات', source);
      final tampered = LockedText(
          text: 'نص مزور', checksum: locked.checksum, source: locked.source);
      expect(verifyLockedText(tampered), isFalse);
      expect(() => assertPublishable(tampered, userApproved: true),
          throwsA(isA<SourceLockException>()));
    });

    test('blocks publish without user approval', () {
      final locked = lockText('نص موثق', source);
      expect(() => assertPublishable(locked, userApproved: false),
          throwsA(isA<SourceLockException>()));
      expect(() => assertPublishable(locked, userApproved: true),
          returnsNormally);
    });

    test('blocks publish for blocked sources', () {
      final locked = lockText(
          'نص', source.copyWith(reviewStatus: ReviewStatus.blocked));
      expect(() => assertPublishable(locked, userApproved: true),
          throwsA(isA<SourceLockException>()));
    });

    test('normalizes whitespace only, never letters', () {
      expect(normalizeSacredText('  الحمد   لله  '), 'الحمد لله');
      expect(normalizeSacredText('سطر\n  سطر'), 'سطر\nسطر');
    });

    test('combines review statuses with worst-wins precedence', () {
      expect(
        combineReviewStatus(
            [ReviewStatus.verified, ReviewStatus.pendingReview]),
        ReviewStatus.pendingReview,
      );
      expect(
        combineReviewStatus([ReviewStatus.verified, ReviewStatus.blocked]),
        ReviewStatus.blocked,
      );
      expect(combineReviewStatus([ReviewStatus.verified]),
          ReviewStatus.verified);
    });
  });

  group('checkContext', () {
    test('warns when the next text opens an exception', () {
      final warnings = checkContext(
        firstText: 'جملة تامة المعنى',
        nextText: 'إلا المجتهدين منهم',
        hasPrev: true,
      );
      expect(warnings,
          contains(const ContextWarning(ContextExtend.after, ContextReason.exception)));
    });

    test('warns when the selection itself opens with a relative clause', () {
      final warnings = checkContext(
          firstText: 'الذين اجتهدوا في دروسهم', hasPrev: true);
      expect(warnings,
          contains(const ContextWarning(ContextExtend.before, ContextReason.relative)));
    });

    test('suppresses the before-warning at the start of a surah', () {
      final warnings =
          checkContext(firstText: 'إلا قليلًا منهم', hasPrev: false);
      expect(warnings, isEmpty);
    });

    test('does not confuse the interrogative opener with the exception', () {
      final warnings =
          checkContext(firstText: 'أَلَا بِالصِّدْقِ تُنَالُ', hasPrev: true);
      expect(warnings, isEmpty);
    });
  });
}
