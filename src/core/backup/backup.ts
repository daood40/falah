/**
 * Full local backup & restore — the answer to a chronic competitor problem
 * ("reinstalled the app and lost everything"). Exports every user-owned
 * table to a single JSON file and restores it additively (existing rows
 * with the same ids are overwritten, nothing else is deleted).
 * Sacred payloads travel as-is; checksums keep protecting them after import.
 */
import { db } from '@core/db/localdb';

const BACKUP_VERSION = 1;
const TABLES = [
  'projects',
  'scheduledPosts',
  'userTemplates',
  'ayahFavorites',
  'projectVersions',
  'notifications',
] as const;

export interface BackupFile {
  app: 'falah';
  backup_version: number;
  created_at: string;
  data: Record<string, unknown[]>;
}

export async function createBackup(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    data[table] = await db.table(table).toArray();
  }
  return {
    app: 'falah',
    backup_version: BACKUP_VERSION,
    created_at: new Date().toISOString(),
    data,
  };
}

/** Returns the number of restored rows. Throws on a non-FALAH file. */
export async function restoreBackup(raw: unknown): Promise<number> {
  const file = raw as BackupFile;
  if (!file || file.app !== 'falah' || typeof file.data !== 'object') {
    throw new Error('Not a FALAH backup file');
  }
  let restored = 0;
  for (const table of TABLES) {
    const rows = file.data[table];
    if (Array.isArray(rows) && rows.length > 0) {
      await db.table(table).bulkPut(rows);
      restored += rows.length;
    }
  }
  return restored;
}
