import { createHash } from 'node:crypto';

/**
 * SOURCE_LOCK hashing rule (docs/SOURCE_POLICY.md §"قاعدة التطبيع قبل الهاش"):
 * SHA-256 over the source text with whitespace collapsed only. No letter,
 * diacritic or Quranic mark is ever touched.
 */
export function contentHash(text: string): string {
  return createHash('sha256').update(collapseWhitespace(text), 'utf8').digest('hex');
}

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

export function fileHash(buffer: Buffer | string): string {
  return createHash('sha256').update(buffer).digest('hex');
}
