/**
 * Publishing & scheduling hub: every scheduled post with its live status,
 * cancel/retry actions, and an honest platform-connection panel (no fake
 * integrations — unconfigured platforms say so and point to the setup docs).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@core/i18n';
import { db } from '@core/db/localdb';
import type { ScheduledPost } from '@core/models/content';
import { EmptyState, SkeletonList } from '@core/ui/primitives';
import { toast } from '@core/ui/Toast';
import { IconCalendar, IconClose, IconRepeat } from '@core/ui/icons';
import { useAuth } from '@features/auth/authStore';
import { cancelScheduled, listScheduled } from '@features/scheduler/domain/scheduler';
import { listPublishers } from '@features/publishing/domain/socialPublisher';

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'fl-badge--pending',
  publishing: 'fl-badge--pending',
  published: 'fl-badge--verified',
  failed: 'fl-badge--blocked',
};

export function PublishPage() {
  const t = useI18n((s) => s.t);
  const { user } = useAuth();
  const [posts, setPosts] = useState<ScheduledPost[] | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [connections, setConnections] = useState<{ name: string; configured: boolean }[]>([]);

  const refresh = useCallback(async () => {
    if (!user) {
      setPosts([]);
      return;
    }
    const list = await listScheduled(user.id);
    setPosts(list);
    const projects = await db.projects.bulkGet([...new Set(list.map((p) => p.project_id))]);
    const map: Record<string, string> = {};
    for (const project of projects) {
      if (project) map[project.id] = project.title;
    }
    setTitles(map);
  }, [user]);

  useEffect(() => {
    void refresh();
    void Promise.all(
      listPublishers().map(async (p) => ({
        name: p.displayName,
        configured: await p.isConfigured().catch(() => false),
      })),
    ).then(setConnections);
  }, [refresh]);

  const cancel = async (id: string) => {
    await cancelScheduled(id);
    toast('info', t('schedule.cancel'));
    await refresh();
  };

  const retry = async (post: ScheduledPost) => {
    await db.scheduledPosts.update(post.id, {
      status: 'scheduled',
      scheduled_at: new Date(Date.now() + 5_000).toISOString(),
      attempts: 0,
      last_error: null,
    });
    toast('success', t('publish.retried'));
    await refresh();
  };

  const upcoming = (posts ?? []).filter(
    (p) => p.status === 'scheduled' || p.status === 'publishing',
  );
  const history = (posts ?? []).filter((p) => p.status === 'published' || p.status === 'failed');

  const renderPost = (post: ScheduledPost) => (
    <div key={post.id} className="fl-card fl-col" style={{ gap: 'var(--fl-sp-2)' }}>
      <div className="fl-row">
        <span aria-hidden>
          <IconCalendar size={18} />
        </span>
        <strong className="fl-grow">
          {titles[post.project_id] ?? t('library.title')} — {post.platform}
        </strong>
        <span className={`fl-badge ${STATUS_BADGE[post.status] ?? 'fl-badge--pending'}`}>
          {t(`schedule.status.${post.status}`)}
        </span>
      </div>
      <div className="fl-row fl-wrap">
        <span className="fl-muted" style={{ fontSize: 'var(--fl-fs-sm)' }} dir="ltr">
          {new Date(post.scheduled_at).toLocaleString()}
        </span>
        {post.repeat !== 'none' && (
          <span className="fl-badge fl-badge--pending">{t(`schedule.repeat.${post.repeat}`)}</span>
        )}
        {(post.attempts ?? 0) > 0 && (
          <span className="fl-muted" style={{ fontSize: 'var(--fl-fs-xs)' }}>
            {post.attempts} {t('publish.attempts')}
          </span>
        )}
        <span className="fl-grow" />
        {post.status === 'failed' && (
          <button className="fl-btn fl-btn--sm" onClick={() => void retry(post)}>
            <IconRepeat size={15} /> {t('publish.retry')}
          </button>
        )}
        {(post.status === 'scheduled' || post.status === 'failed') && (
          <button className="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => void cancel(post.id)}>
            <IconClose size={15} /> {t('schedule.cancel')}
          </button>
        )}
      </div>
      {post.last_error && post.status === 'failed' && (
        <p className="fl-muted" style={{ fontSize: 'var(--fl-fs-xs)', margin: 0 }}>
          {post.last_error}
        </p>
      )}
    </div>
  );

  return (
    <div className="fl-col" style={{ gap: 'var(--fl-sp-5)' }}>
      <header>
        <h1 className="fl-title">{t('publish.title')}</h1>
        <p className="fl-muted">{t('publish.subtitle')}</p>
      </header>

      {posts === null ? (
        <SkeletonList count={3} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<IconCalendar size={44} />}
          text={t('publish.empty')}
          action={
            <Link to="/library" className="fl-btn fl-btn--primary">
              {t('nav.library')}
            </Link>
          }
        />
      ) : (
        <>
          {upcoming.length > 0 && (
            <section aria-label={t('publish.upcoming')}>
              <h2 className="fl-subtitle" style={{ marginBottom: 'var(--fl-sp-3)' }}>
                {t('publish.upcoming')}
              </h2>
              <div className="fl-col">{upcoming.map(renderPost)}</div>
            </section>
          )}
          {history.length > 0 && (
            <section aria-label={t('publish.history')}>
              <h2 className="fl-subtitle" style={{ marginBottom: 'var(--fl-sp-3)' }}>
                {t('publish.history')}
              </h2>
              <div className="fl-col">{history.map(renderPost)}</div>
            </section>
          )}
        </>
      )}

      <section aria-label={t('publish.connections')}>
        <h2 className="fl-subtitle" style={{ marginBottom: 'var(--fl-sp-3)' }}>
          {t('publish.connections')}
        </h2>
        <div className="fl-col">
          {connections.map((c) => (
            <div key={c.name} className="fl-card fl-col" style={{ gap: 'var(--fl-sp-1)' }}>
              <div className="fl-row">
                <strong className="fl-grow">{c.name}</strong>
                <span
                  className={`fl-badge ${c.configured ? 'fl-badge--verified' : 'fl-badge--pending'}`}
                >
                  {c.configured ? t('publish.connected') : t('publish.notConnected')}
                </span>
              </div>
              {!c.configured && (
                <span className="fl-muted" style={{ fontSize: 'var(--fl-fs-xs)' }}>
                  {t('publish.notConfigured')}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
