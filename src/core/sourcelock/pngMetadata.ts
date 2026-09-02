/**
 * Embed Source Lock provenance inside exported PNG files (v2 §4.4):
 * every exported image carries the source ids and content hashes of the
 * sacred texts it renders, as standard PNG tEXt chunks. Anyone can verify
 * a design's origin with any PNG inspector; nothing is invented client-side.
 */

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function textChunk(keyword: string, value: string): Uint8Array {
  const encoder = new TextEncoder();
  const key = encoder.encode(keyword);
  const val = encoder.encode(value);
  const data = new Uint8Array(key.length + 1 + val.length);
  data.set(key, 0);
  data[key.length] = 0;
  data.set(val, key.length + 1);

  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set([0x74, 0x45, 0x58, 0x74], 4); // "tEXt"
  chunk.set(data, 8);
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(chunk.subarray(4, 8), 0);
  crcInput.set(data, 4);
  view.setUint32(8 + data.length, crc32(crcInput));
  return chunk;
}

/** Insert tEXt metadata chunks right before IEND. Returns a new PNG buffer. */
export function withPngMetadata(png: Uint8Array, entries: Record<string, string>): Uint8Array {
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (png[i] !== SIGNATURE[i]) return png; // not a PNG: leave untouched
  }
  // IEND is always the final 12 bytes of a well-formed PNG.
  const iendStart = png.length - 12;
  const chunks = Object.entries(entries).map(([k, v]) => textChunk(k, v));
  const extra = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(png.length + extra);
  out.set(png.subarray(0, iendStart), 0);
  let offset = iendStart;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  out.set(png.subarray(iendStart), offset);
  return out;
}

/** Read back all tEXt chunks (used by tests and future verification tools). */
export function readPngMetadata(png: Uint8Array): Record<string, string> {
  const decoder = new TextDecoder();
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const result: Record<string, string> = {};
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = view.getUint32(offset);
    const type = decoder.decode(png.subarray(offset + 4, offset + 8));
    if (type === 'tEXt') {
      const data = png.subarray(offset + 8, offset + 8 + length);
      const sep = data.indexOf(0);
      if (sep > 0) {
        result[decoder.decode(data.subarray(0, sep))] = decoder.decode(data.subarray(sep + 1));
      }
    }
    if (type === 'IEND') break;
    offset += 12 + length;
  }
  return result;
}
