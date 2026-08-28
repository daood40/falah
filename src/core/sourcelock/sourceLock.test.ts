/** Source Lock: the most critical logic in FALAH. */
import { describe, expect, it } from 'vitest';
import {
  assertPublishable,
  checksumOf,
  combineReviewStatus,
  lockText,
  normalizeSacredText,
  verifyLockedText,
} from './sourceLock';
import type { SourceMetadata } from './types';

const SOURCE: SourceMetadata = {
  source_id: 'tanzil-uthmani',
  source_name: 'Tanzil',
  source_url: 'https://tanzil.net',
  source_version: '1.1',
  verified_at: new Date().toISOString(),
  review_status: 'verified',
};

describe('sourceLock', () => {
  it('locks text with checksum and freezes the payload', async () => {
    const locked = await lockText('بسم الله الرحمن الرحيم', SOURCE);
    expect(locked.checksum).toHaveLength(64);
    expect(Object.isFrozen(locked)).toBe(true);
    expect(await verifyLockedText(locked)).toBe(true);
  });

  it('refuses empty text and missing source metadata', async () => {
    await expect(lockText('   ', SOURCE)).rejects.toMatchObject({ kind: 'source_lock' });
    await expect(lockText('نص', { ...SOURCE, source_id: '' })).rejects.toMatchObject({
      kind: 'source_lock',
    });
  });

  it('detects tampering via checksum mismatch', async () => {
    const locked = await lockText('إنما الأعمال بالنيات', SOURCE);
    const tampered = { ...locked, text: 'نص مزور' };
    expect(await verifyLockedText(tampered)).toBe(false);
    await expect(assertPublishable(tampered, true)).rejects.toMatchObject({ kind: 'source_lock' });
  });

  it('blocks publish without user approval', async () => {
    const locked = await lockText('نص موثق', SOURCE);
    await expect(assertPublishable(locked, false)).rejects.toMatchObject({ kind: 'source_lock' });
    await expect(assertPublishable(locked, true)).resolves.toBeUndefined();
  });

  it('blocks publish for blocked sources', async () => {
    const locked = await lockText('نص', { ...SOURCE, review_status: 'blocked' });
    await expect(assertPublishable(locked, true)).rejects.toMatchObject({ kind: 'source_lock' });
  });

  it('normalizes whitespace only, never letters', () => {
    expect(normalizeSacredText('  الحمد   لله  ')).toBe('الحمد لله');
    expect(normalizeSacredText('سطر\n  سطر')).toBe('سطر\nسطر');
  });

  it('combines review statuses with worst-wins precedence', () => {
    expect(combineReviewStatus(['verified', 'verified'])).toBe('verified');
    expect(combineReviewStatus(['verified', 'pending_review'])).toBe('pending_review');
    expect(combineReviewStatus(['pending_review', 'blocked'])).toBe('blocked');
  });

  it('produces stable checksums', async () => {
    expect(await checksumOf('نص')).toBe(await checksumOf('نص'));
    expect(await checksumOf('نص')).not.toBe(await checksumOf('نص آخر'));
  });
});
