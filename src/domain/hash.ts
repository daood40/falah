import { createHash } from 'node:crypto';

/**
 * SOURCE_POLICY hash rule: SHA-256 over the text exactly as it will be stored.
 * The database recomputes the same value as a generated column, so importer and
 * database must always agree — a mismatch means the text changed in transit.
 */
export function contentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function fileHash(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}
