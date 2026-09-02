/** Ayah favorites: per-user toggle/list, offline. */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@core/db/localdb';
import { isFavoriteAyah, listFavoriteAyahs, toggleFavoriteAyah } from './data/favoritesRepository';

const USER = 'fav-user';

beforeEach(async () => {
  await db.ayahFavorites.clear();
});

describe('ayah favorites', () => {
  it('toggles on and off and lists per user', async () => {
    const input = {
      surah: 2,
      ayah: 255,
      surahName: 'البقرة',
      text: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ',
    };
    expect(await toggleFavoriteAyah(USER, input)).toBe(true);
    expect(await isFavoriteAyah(USER, 2, 255)).toBe(true);
    await toggleFavoriteAyah('someone-else', { ...input, surah: 1, ayah: 1 });

    const mine = await listFavoriteAyahs(USER);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.surahName).toBe('البقرة');

    expect(await toggleFavoriteAyah(USER, input)).toBe(false);
    expect(await listFavoriteAyahs(USER)).toHaveLength(0);
  });
});
