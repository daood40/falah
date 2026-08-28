/** Audit log for sensitive operations (stored locally; synced to `audit_logs` when Supabase is configured). */
import { db } from '../db/localdb';
import { newId } from '../utils/id';

export type AuditAction =
  | 'sacred_text_locked'
  | 'source_added'
  | 'source_removed'
  | 'content_created'
  | 'content_updated'
  | 'content_deleted'
  | 'content_exported'
  | 'content_published'
  | 'publish_failed'
  | 'schedule_created'
  | 'schedule_cancelled'
  | 'account_settings_changed'
  | 'auth_login'
  | 'auth_logout'
  | 'data_cleared';

export interface AuditEntry {
  id: string;
  user_id: string;
  action: AuditAction;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export async function auditLog(
  userId: string,
  action: AuditAction,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const entry: AuditEntry = {
    id: newId(),
    user_id: userId,
    action,
    timestamp: new Date().toISOString(),
    metadata,
  };
  try {
    await db.auditLogs.add(entry);
  } catch (error) {
    // Auditing must never break the user flow; log technically only.
    console.error('[FALAH:audit] failed to record entry', error);
  }
}

export async function recentAuditEntries(limit = 100): Promise<AuditEntry[]> {
  return db.auditLogs.orderBy('timestamp').reverse().limit(limit).toArray();
}
