/** PNG provenance metadata (v2 §4.4): write + read back tEXt chunks. */
import { describe, expect, it } from 'vitest';
import { readPngMetadata, withPngMetadata } from './pngMetadata';

/** Minimal valid PNG: signature + IHDR(1x1) + IEND (no IDAT needed for chunk math). */
function tinyPng(): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdr = [
    0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0x1f, 0x15, 0xc4,
    0x89,
  ];
  const iend = [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
  return new Uint8Array([...sig, ...ihdr, ...iend]);
}

describe('png source metadata', () => {
  it('embeds and reads back source ids and hashes', () => {
    const out = withPngMetadata(tinyPng(), {
      'falah:source_ids': 'tanzil-uthmani',
      'falah:content_hashes': 'abc123,def456',
    });
    const meta = readPngMetadata(out);
    expect(meta['falah:source_ids']).toBe('tanzil-uthmani');
    expect(meta['falah:content_hashes']).toBe('abc123,def456');
    // Still ends with a valid IEND chunk.
    expect([...out.subarray(out.length - 8, out.length - 4)]).toEqual([0x49, 0x45, 0x4e, 0x44]);
  });

  it('leaves non-PNG bytes untouched', () => {
    const junk = new Uint8Array([1, 2, 3, 4]);
    expect(withPngMetadata(junk, { a: 'b' })).toBe(junk);
  });
});
