import { describe, expect, it } from 'vitest';
import { contractIssues, loadSpec, validateSpec } from '../scripts/validate-openapi.ts';

const spec = loadSpec();

describe('OpenAPI contract', () => {
  it('is a structurally valid 3.1 document with resolvable refs', () => {
    expect(validateSpec(spec)).toEqual([]);
  });

  it('documents exactly the implemented routes', () => {
    expect(contractIssues(spec)).toEqual([]);
  });

  it('declares the required endpoints from the project brief', () => {
    const required = [
      '/api/v1/health', '/api/v1/stats', '/api/v1/sources', '/api/v1/editions',
      '/api/v1/surahs', '/api/v1/surahs/{id}', '/api/v1/surahs/{id}/ayahs',
      '/api/v1/ayahs/{id}', '/api/v1/ayahs/by-key/{key}', '/api/v1/juzs',
      '/api/v1/juzs/{number}', '/api/v1/juzs/{number}/ayahs', '/api/v1/hizbs',
      '/api/v1/hizbs/{number}', '/api/v1/hizbs/{number}/ayahs', '/api/v1/pages/{page}',
      '/api/v1/pages/{page}/ayahs', '/api/v1/sajdahs', '/api/v1/manzils', '/api/v1/search',
      '/api/v1/translations', '/api/v1/reciters', '/api/v1/reciters/{id}',
      '/api/v1/reciters/{id}/riwayat', '/api/v1/reciters/{id}/recitations',
      '/api/v1/reciters/{id}/surahs', '/api/v1/reciters/{id}/surahs/{surah_id}',
      '/api/v1/reciters/{id}/juzs/{juz_number}', '/api/v1/reciters/{id}/full-quran',
      '/api/v1/ayahs/{id}/audio', '/api/v1/surahs/{id}/audio', '/api/v1/audio/search',
      '/api/v1/qiraat', '/api/v1/riwayat', '/api/v1/downloads/quran',
      '/api/v1/downloads/reciters/{id}/surah/{surah_id}', '/api/v1/me/bookmarks',
      '/api/v1/me/bookmarks/{ayah_id}', '/api/v1/me/favorites', '/api/v1/me/favorites/{ayah_id}',
      '/api/v1/me/progress', '/api/v1/me/favorite-reciters', '/api/v1/me/favorite-reciters/{id}',
    ];
    for (const path of required) expect(Object.keys(spec.paths)).toContain(path);
  });
});
