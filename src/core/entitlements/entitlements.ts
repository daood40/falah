/**
 * Subscription entitlements. Plans and limits are DATA, not UI constants —
 * in production they are served from the backend (`subscriptions` table /
 * remote config) so prices and limits can change without an app release.
 */
export type PlanId = 'free' | 'pro' | 'premium';

export interface Entitlements {
  max_projects: number;
  max_exports_per_month: number;
  max_video_resolution: 720 | 1080 | 2160;
  scheduled_posts: number;
  ai_messages_per_day: number;
  storage_limit_mb: number;
  premium_templates: boolean;
}

export const DEFAULT_ENTITLEMENTS: Record<PlanId, Entitlements> = {
  free: {
    max_projects: 20,
    max_exports_per_month: 30,
    max_video_resolution: 720,
    scheduled_posts: 5,
    ai_messages_per_day: 20,
    storage_limit_mb: 200,
    premium_templates: false,
  },
  pro: {
    max_projects: 200,
    max_exports_per_month: 500,
    max_video_resolution: 1080,
    scheduled_posts: 100,
    ai_messages_per_day: 200,
    storage_limit_mb: 2048,
    premium_templates: true,
  },
  premium: {
    max_projects: Number.POSITIVE_INFINITY,
    max_exports_per_month: Number.POSITIVE_INFINITY,
    max_video_resolution: 2160,
    scheduled_posts: Number.POSITIVE_INFINITY,
    ai_messages_per_day: 1000,
    storage_limit_mb: 10240,
    premium_templates: true,
  },
};

export function entitlementsFor(plan: PlanId, overrides?: Partial<Entitlements>): Entitlements {
  return { ...DEFAULT_ENTITLEMENTS[plan], ...overrides };
}

export function canCreateProject(current: number, ent: Entitlements): boolean {
  return current < ent.max_projects;
}

export function canSchedule(current: number, ent: Entitlements): boolean {
  return current < ent.scheduled_posts;
}
