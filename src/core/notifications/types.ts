export type NotificationKind =
  'publish_success' | 'publish_failed' | 'schedule_created' | 'export_done';

export interface AppNotification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  /** i18n key for the title. */
  titleKey: string;
  /** Free-text detail (project title, platform, error summary). */
  body: string;
  read: 0 | 1;
  created_at: string;
}
