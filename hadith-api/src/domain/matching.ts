/**
 * Text matching used ONLY to compare a stored record against an independent
 * corpus. It never touches stored text: both sides are normalized into
 * throw-away token arrays that exist for the duration of the comparison.
 */
import { normalizeArabic } from './normalize.ts';

/** Punctuation, quotation and bracket forms that carry no matching signal. */
const PUNCT = /[.,،؛:!؟"'«»“”‘’()[\]{}<>\-—_/\\|*#@+=~`^%$£¥§©®°·…]/gu;

export function matchTokens(text: string): string[] {
  return normalizeArabic(text)
    .replace(PUNCT, ' ')
    .split(/\s+/u)
    .filter((t) => t.length > 1);
}

/** FNV-1a — a small, fast, dependency-free hash for shingle keys. */
export function hashShingle(tokens: string[], start: number, size: number): number {
  let hash = 0x811c9dc5;
  for (let i = start; i < start + size; i++) {
    const token = tokens[i] as string;
    for (let c = 0; c < token.length; c++) {
      hash ^= token.charCodeAt(c);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= 0x20; // token separator
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Overlapping word windows: the unit of comparison. */
export function shingles(tokens: string[], size = 5): number[] {
  if (tokens.length < size) return tokens.length > 0 ? [hashShingle(tokens, 0, tokens.length)] : [];
  const out: number[] = new Array(tokens.length - size + 1);
  for (let i = 0; i + size <= tokens.length; i++) out[i] = hashShingle(tokens, i, size);
  return out;
}

export function uniqueShingles(tokens: string[], size = 5): number[] {
  return [...new Set(shingles(tokens, size))];
}
