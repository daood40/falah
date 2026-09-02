/**
 * In-app notification center (Phase 12).
 * Notifications persist in IndexedDB per user; a small zustand store keeps the
 * unread badge live across the app. Publishing results, scheduling, and exports
 * all report here so the user has a durable activity trail.
 */
import { create } from 'zustand';
import { db } from '../db/localdb';
import { newId } from '../utils/id';
import type { AppNotification, NotificationKind } from './types';

const KIND_TITLE_KEY: Record<NotificationKind, string> = {
  publish_success: 'notifications.publishSuccess',
  publish_failed: 'notifications.publishFailed',
  schedule_created: 'notifications.scheduleCreated',
  export_done: 'notifications.exportDone',
};

interface NotificationsState {
  unread: number;
  items: AppNotification[];
  refresh: (userId: string) => Promise<void>;
  markAllRead: (userId: string) => Promise<void>;
  clear: (userId: string) => Promise<void>;
}

export const useNotifications = create<NotificationsState>((set) => ({
  unread: 0,
  items: [],

  refresh: async (userId) => {
    const items = await db.notifications
      .where('user_id')
      .equals(userId)
      .reverse()
      .sortBy('created_at');
    set({
      items: items.slice(0, 50),
      unread: items.filter((n) => n.read === 0).length,
    });
  },

  markAllRead: async (userId) => {
    await db.notifications.where('user_id').equals(userId).modify({ read: 1 });
    set((s) => ({ unread: 0, items: s.items.map((n) => ({ ...n, read: 1 as const })) }));
  },

  clear: async (userId) => {
    await db.notifications.where('user_id').equals(userId).delete();
    set({ unread: 0, items: [] });
  },
}));

/** Record a notification and bump the live badge. Never throws into callers. */
export async function notify(userId: string, kind: NotificationKind, body: string): Promise<void> {
  try {
    const item: AppNotification = {
      id: newId(),
      user_id: userId,
      kind,
      titleKey: KIND_TITLE_KEY[kind],
      body,
      read: 0,
      created_at: new Date().toISOString(),
    };
    await db.notifications.add(item);
    const state = useNotifications.getState();
    useNotifications.setState({
      unread: state.unread + 1,
      items: [item, ...state.items].slice(0, 50),
    });
  } catch (error) {
    console.error('[FALAH:notify]', error);
  }
}
