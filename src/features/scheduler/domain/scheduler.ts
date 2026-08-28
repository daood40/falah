/**
 * Scheduler: content → date/time → platform, with repeat rules and the full
 * status lifecycle draft → scheduled → publishing → published | failed.
 * A background tick (runs while the app is open; in production also a server
 * cron — see docs/DEPLOYMENT.md) picks up due posts and hands them to the
 * SocialPublisher through the Source Lock gate.
 */
import { db } from '@core/db/localdb';
import { auditLog } from '@core/audit/audit';
import { notify } from '@core/notifications/notifications';
import { AppError, reportError } from '@core/errors/errors';
import type { Platform, RepeatRule, ScheduledPost } from '@core/models/content';
import { newId } from '@core/utils/id';
import { publisherFor } from '@features/publishing/domain/socialPublisher';
import { setProjectStatus } from '@features/library/data/libraryRepository';

export async function schedulePost(input: {
  userId: string;
  projectId: string;
  platform: Platform;
  scheduledAt: Date;
  repeat: RepeatRule;
}): Promise<ScheduledPost> {
  if (input.scheduledAt.getTime() <= Date.now()) {
    throw new AppError('validation', 'Scheduled time must be in the future');
  }
  const post: ScheduledPost = {
    id: newId(),
    user_id: input.userId,
    project_id: input.projectId,
    platform: input.platform,
    scheduled_at: input.scheduledAt.toISOString(),
    repeat: input.repeat,
    status: 'scheduled',
    last_error: null,
    attempts: 0,
    idempotency_key: newId(),
    created_at: new Date().toISOString(),
  };
  await db.scheduledPosts.add(post);
  await setProjectStatus(input.projectId, 'scheduled');
  await notify(input.userId, 'schedule_created', `${input.platform} — ${post.scheduled_at}`);
  await auditLog(input.userId, 'schedule_created', {
    post_id: post.id,
    project_id: input.projectId,
    platform: input.platform,
    at: post.scheduled_at,
  });
  return post;
}

export async function listScheduled(userId: string): Promise<ScheduledPost[]> {
  const posts = await db.scheduledPosts.where('user_id').equals(userId).toArray();
  return posts.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
}

export async function cancelScheduled(id: string): Promise<void> {
  const post = await db.scheduledPosts.get(id);
  if (!post) return;
  await db.scheduledPosts.delete(id);
  const remaining = await db.scheduledPosts.where('project_id').equals(post.project_id).count();
  if (remaining === 0) await setProjectStatus(post.project_id, 'draft');
  await auditLog(post.user_id, 'schedule_cancelled', { post_id: id });
}

export async function updateScheduled(
  id: string,
  patch: Partial<Pick<ScheduledPost, 'scheduled_at' | 'platform' | 'repeat'>>,
): Promise<void> {
  if (patch.scheduled_at && new Date(patch.scheduled_at).getTime() <= Date.now()) {
    throw new AppError('validation', 'Scheduled time must be in the future');
  }
  await db.scheduledPosts.update(id, patch);
}

/** v2 §20: exponential backoff, at most 3 attempts per post. */
export const MAX_PUBLISH_ATTEMPTS = 3;
const RETRY_BACKOFF_MINUTES = [1, 5];

function nextOccurrence(iso: string, repeat: RepeatRule): string | null {
  if (repeat === 'none') return null;
  const date = new Date(iso);
  date.setDate(date.getDate() + (repeat === 'daily' ? 1 : 7));
  return date.toISOString();
}

/**
 * Process due posts once. Media is re-exported at publish time so it always
 * passes the current Source Lock verification.
 */
export async function processDuePosts(
  exportMedia: (projectId: string) => Promise<{ media: Blob; caption: string } | null>,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const due = await db.scheduledPosts
    .where('status')
    .equals('scheduled')
    .and((p) => p.scheduled_at <= nowIso)
    .toArray();

  for (const post of due) {
    await db.scheduledPosts.update(post.id, { status: 'publishing' });
    await setProjectStatus(post.project_id, 'publishing');
    try {
      const exported = await exportMedia(post.project_id);
      if (!exported) throw new AppError('validation', `Project ${post.project_id} missing`);
      const project = await db.projects.get(post.project_id);
      const result = await publisherFor(post.platform).publish({
        project: project!,
        media: exported.media,
        caption: exported.caption,
        idempotencyKey: post.idempotency_key,
      });
      await db.scheduledPosts.update(post.id, { status: 'published', last_error: null });
      await setProjectStatus(post.project_id, 'published');
      await notify(post.user_id, 'publish_success', post.platform);
      await auditLog(post.user_id, 'content_published', {
        post_id: post.id,
        platform: post.platform,
        remote_id: result.remoteId,
      });
      const next = nextOccurrence(post.scheduled_at, post.repeat);
      if (next) {
        await db.scheduledPosts.add({
          ...post,
          id: newId(),
          scheduled_at: next,
          status: 'scheduled',
          attempts: 0,
          idempotency_key: newId(),
          last_error: null,
        });
      }
    } catch (error) {
      const appError = reportError(error, 'publishing');
      const attempts = (post.attempts ?? 0) + 1;
      // Misconfiguration and Source-Lock rejections can't heal on their own —
      // retrying would just repeat the same honest failure.
      const permanent =
        appError.kind === 'not_configured' ||
        appError.kind === 'source_lock' ||
        appError.kind === 'validation';
      if (!permanent && attempts < MAX_PUBLISH_ATTEMPTS) {
        const backoffMs = RETRY_BACKOFF_MINUTES[attempts - 1]! * 60_000;
        await db.scheduledPosts.update(post.id, {
          status: 'scheduled',
          attempts,
          last_error: appError.message,
          scheduled_at: new Date(Date.now() + backoffMs).toISOString(),
        });
        await setProjectStatus(post.project_id, 'scheduled');
        await auditLog(post.user_id, 'publish_retry_scheduled', {
          post_id: post.id,
          attempt: attempts,
          error: appError.message,
        });
        continue;
      }
      await db.scheduledPosts.update(post.id, {
        status: 'failed',
        attempts,
        last_error: appError.message,
      });
      await setProjectStatus(post.project_id, 'failed');
      await notify(post.user_id, 'publish_failed', post.platform);
      await auditLog(post.user_id, 'publish_failed', { post_id: post.id, error: appError.message });
    }
  }
}
