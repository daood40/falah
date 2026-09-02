/**
 * Ayah favorites — the "bookmark" feature every leading Quran app has,
 * here offline-first and per user, pointing at the verified cached text.
 */
import { db } from '@core/db/localdb';

export interface FavoriteAyah {
  id: string; // `${user_id}:${surah}:${ayah}`
  user_id: string;
  surah: number;
  ayah: number;
  surahName: string;
  /** First 90 chars of the verified text, for the picker chip. */
  snippet: string;
  added_at: string;
}

const idOf = (userId: string, surah: number, ayah: number) => `${userId}:${surah}:${ayah}`;

export async function listFavoriteAyahs(userId: string): Promise<FavoriteAyah[]> {
  const all = await db.ayahFavorites.where('user_id').equals(userId).toArray();
  return all.sort((a, b) => b.added_at.localeCompare(a.added_at));
}

export async function isFavoriteAyah(
  userId: string,
  surah: number,
  ayah: number,
): Promise<boolean> {
  return (await db.ayahFavorites.get(idOf(userId, surah, ayah))) !== undefined;
}

/** Toggle; returns the new state (true = now favorited). */
export async function toggleFavoriteAyah(
  userId: string,
  input: { surah: number; ayah: number; surahName: string; text: string },
): Promise<boolean> {
  const id = idOf(userId, input.surah, input.ayah);
  const existing = await db.ayahFavorites.get(id);
  if (existing) {
    await db.ayahFavorites.delete(id);
    return false;
  }
  await db.ayahFavorites.add({
    id,
    user_id: userId,
    surah: input.surah,
    ayah: input.ayah,
    surahName: input.surahName,
    snippet: input.text.slice(0, 90),
    added_at: new Date().toISOString(),
  });
  return true;
}
