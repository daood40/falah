/**
 * Offline-first local database (IndexedDB via Dexie).
 * Everything the user creates works offline; when Supabase is configured,
 * repositories sync on top of this cache (see docs/ARCHITECTURE.md).
 */
import Dexie, { type Table } from 'dexie';
import type { AuditEntry } from '../audit/audit';
import type { ContentProject, ScheduledPost } from '../models/content';
import type { CachedAyah, CachedSurah } from '@features/quran/domain/types';
import type { HadithRecord } from '@features/hadith/domain/types';
import type { AppNotification } from '../notifications/types';
import type { UserTemplate } from '@features/templates/userTemplates';
import type { FavoriteAyah } from '@features/quran/data/favoritesRepository';

export interface KvEntry {
  key: string;
  value: unknown;
}

export class FalahDb extends Dexie {
  projects!: Table<ContentProject, string>;
  scheduledPosts!: Table<ScheduledPost, string>;
  quranSurahs!: Table<CachedSurah, number>;
  quranAyahs!: Table<CachedAyah, string>;
  hadiths!: Table<HadithRecord, string>;
  auditLogs!: Table<AuditEntry, string>;
  notifications!: Table<AppNotification, string>;
  userTemplates!: Table<UserTemplate, string>;
  ayahFavorites!: Table<FavoriteAyah, string>;
  kv!: Table<KvEntry, string>;

  constructor() {
    super('falah');
    this.version(1).stores({
      projects: 'id, user_id, type, status, favorite, updated_at',
      scheduledPosts: 'id, user_id, project_id, platform, status, scheduled_at',
      quranSurahs: 'number',
      quranAyahs: 'key, surah',
      hadiths: 'id, collection_id, *searchTerms',
      auditLogs: 'id, user_id, action, timestamp',
      kv: 'key',
    });
    this.version(2).stores({
      notifications: 'id, user_id, read, created_at',
    });
    this.version(3).stores({
      userTemplates: 'id, user_id, updated_at',
    });
    this.version(4).stores({
      ayahFavorites: 'id, user_id, added_at',
    });
  }
}

export const db = new FalahDb();

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const entry = await db.kv.get(key);
  return entry?.value as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

/** Rough storage usage for the settings screen. */
export async function estimateStorage(): Promise<{ usedMb: number; quotaMb: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usedMb: usage / (1024 * 1024), quotaMb: quota / (1024 * 1024) };
}
