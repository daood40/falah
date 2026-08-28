/**
 * Source Lock service: verification pipeline for religious text.
 *
 * Pipeline: SOURCE → FETCH → NORMALIZE → VERIFY → DISPLAY → USER APPROVAL → EXPORT/PUBLISH
 * A text that fails verification is BLOCKED and cannot be exported or published.
 */
import { AppError } from '../errors/errors';
import type { LockedText, ReviewStatus, SourceMetadata } from './types';

/** SHA-256 hex digest. Falls back to a stable FNV-1a hash where SubtleCrypto is unavailable (tests/http). */
export async function checksumOf(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const digest = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      /* fall through to FNV */
    }
  }
  let hash = 0x811c9dc5;
  for (const byte of data) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a-${hash.toString(16).padStart(8, '0')}`;
}

/** Normalize whitespace only — the text itself is NEVER altered. */
export function normalizeSacredText(raw: string): string {
  return raw
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** Wrap fetched source text into an immutable LockedText with checksum. */
export async function lockText(rawText: string, source: SourceMetadata): Promise<LockedText> {
  const text = normalizeSacredText(rawText);
  if (text.length === 0) {
    throw new AppError('source_lock', 'Refusing to lock empty religious text');
  }
  if (!source.source_id || !source.source_name) {
    throw new AppError('source_lock', 'Religious text requires source_id and source_name');
  }
  const checksum = await checksumOf(text);
  return Object.freeze({ text, checksum, source: Object.freeze({ ...source }) });
}

/** Verify a LockedText has not been tampered with since it was locked. */
export async function verifyLockedText(locked: LockedText): Promise<boolean> {
  const expected = await checksumOf(locked.text);
  return expected === locked.checksum;
}

/**
 * Publish/export gate. Throws AppError('source_lock') when the content must be blocked.
 * `userApproved` is the explicit human approval step of the pipeline.
 */
export async function assertPublishable(locked: LockedText, userApproved: boolean): Promise<void> {
  if (locked.source.review_status === 'blocked') {
    throw new AppError('source_lock', `Source ${locked.source.source_id} is blocked`);
  }
  if (!(await verifyLockedText(locked))) {
    throw new AppError('source_lock', 'Checksum mismatch — text was modified after verification');
  }
  if (!userApproved) {
    throw new AppError('source_lock', 'User approval is required before export/publish');
  }
}

/** Status precedence when combining multiple sacred texts in one design. */
export function combineReviewStatus(statuses: ReviewStatus[]): ReviewStatus {
  if (statuses.includes('blocked')) return 'blocked';
  if (statuses.includes('pending_review')) return 'pending_review';
  return 'verified';
}
