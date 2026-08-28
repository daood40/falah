/** In-app notification center: persistence, badge counting, read/clear. */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/localdb';
import { notify, useNotifications } from './notifications';

const USER = 'notif-user';

beforeEach(async () => {
  await db.notifications.clear();
  useNotifications.setState({ unread: 0, items: [] });
});

describe('notifications', () => {
  it('records notifications and bumps the live unread badge', async () => {
    await notify(USER, 'schedule_created', 'instagram — 2026-09-01');
    await notify(USER, 'publish_failed', 'telegram');
    const state = useNotifications.getState();
    expect(state.unread).toBe(2);
    expect(state.items[0]?.kind).toBe('publish_failed');
    expect(state.items[0]?.titleKey).toBe('notifications.publishFailed');
  });

  it('persists per user and refreshes from the database', async () => {
    await notify(USER, 'export_done', 'تصميم (PNG)');
    await notify('someone-else', 'export_done', 'other');
    useNotifications.setState({ unread: 0, items: [] });
    await useNotifications.getState().refresh(USER);
    const state = useNotifications.getState();
    expect(state.items).toHaveLength(1);
    expect(state.unread).toBe(1);
    expect(state.items[0]?.user_id).toBe(USER);
  });

  it('markAllRead zeroes the badge and clear empties the list', async () => {
    await notify(USER, 'publish_success', 'facebook');
    await useNotifications.getState().markAllRead(USER);
    expect(useNotifications.getState().unread).toBe(0);
    expect((await db.notifications.where('user_id').equals(USER).toArray())[0]?.read).toBe(1);

    await useNotifications.getState().clear(USER);
    expect(await db.notifications.where('user_id').equals(USER).count()).toBe(0);
    expect(useNotifications.getState().items).toHaveLength(0);
  });
});
