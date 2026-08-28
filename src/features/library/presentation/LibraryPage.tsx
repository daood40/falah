/** Library: filter tabs, search, sort, and per-item actions. */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@core/i18n';
import type { ContentProject, ScheduledPost } from '@core/models/content';
import { ConfirmDialog, EmptyState, SkeletonList } from '@core/ui/primitives';
import { toast } from '@core/ui/Toast';
import { useAuth } from '@features/auth/authStore';
import {
  deleteProject,
  duplicateProject,
  listProjects,
  toggleFavorite,
  type LibraryFilter,
  type LibrarySort,
} from '../data/libraryRepository';
import { cancelScheduled, listScheduled } from '@features/scheduler/domain/scheduler';
import {
  IconCopy,
  IconDownload,
  IconEdit,
  IconImage,
  IconLibrary,
  IconShare,
  IconStar,
  IconTrash,
} from '@core/ui/icons';
import { Modal } from '@core/ui/primitives';
import { downloadBlob, exportPng, sacredTexts } from '@features/editor/data/exportService';
import { notify } from '@core/notifications/notifications';
import { reportError } from '@core/errors/errors';
import './library.css';

const FILTERS: LibraryFilter[] = [
  'all',
  'posts',
  'videos',
  'stories',
  'reels',
  'drafts',
  'scheduled',
  'published',
  'favorites',
];
const FILTER_KEY: Record<LibraryFilter, string> = {
  all: 'library.all',
  posts: 'library.posts',
  videos: 'library.videos',
  stories: 'library.stories',
  reels: 'library.reels',
  drafts: 'library.drafts',
  scheduled: 'library.scheduled',
  published: 'library.published',
  favorites: 'library.favorites',
};

export function LibraryPage() {
  const t = useI18n((s) => s.t);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<LibrarySort>('newest');
  const [projects, setProjects] = useState<ContentProject[] | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledPost[]>([]);
  const [deleting, setDeleting] = useState<ContentProject | null>(null);
  const [exporting, setExporting] = useState<{ project: ContentProject; share: boolean } | null>(
    null,
  );
  const [approved, setApproved] = useState(false);

  /** Export/share through the Source Lock gate (explicit approval when sacred text present). */
  const runExport = async () => {
    if (!exporting || !user) return;
    const { project, share } = exporting;
    setExporting(null);
    setApproved(false);
    try {
      const blob = await exportPng(project, true);
      const filename = `${project.title || 'falah-design'}.png`;
      const file = new File([blob], filename, { type: 'image/png' });
      const canShare =
        share &&
        typeof navigator.share === 'function' &&
        (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }));
      if (canShare) {
        await navigator.share({ files: [file], title: project.title });
        toast('success', t('library.shared'));
      } else {
        if (share) toast('info', t('library.shareUnsupported'));
        downloadBlob(blob, filename);
      }
      await notify(user.id, 'export_done', `${project.title} (PNG)`);
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') reportError(error, 'rendering');
    }
  };

  const reload = useCallback(() => {
    if (!user) return;
    void listProjects(user.id, filter, search, sort).then(setProjects);
    void listScheduled(user.id).then(setScheduled);
  }, [user, filter, search, sort]);

  useEffect(reload, [reload]);

  const statusKey = (p: ContentProject) => `schedule.status.${p.status}`;

  return (
    <div className="fl-col" style={{ gap: 'var(--fl-sp-4)' }}>
      <h1 className="fl-title">{t('library.title')}</h1>

      <div className="fl-row">
        <input
          className="fl-input fl-grow"
          type="search"
          placeholder={t('library.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('library.search')}
        />
        <select
          className="fl-select"
          style={{ width: 'auto' }}
          value={sort}
          onChange={(e) => setSort(e.target.value as LibrarySort)}
          aria-label="sort"
        >
          <option value="newest">{t('library.sortNewest')}</option>
          <option value="oldest">{t('library.sortOldest')}</option>
          <option value="name">{t('library.sortName')}</option>
        </select>
      </div>

      <div className="format-row" role="tablist" aria-label={t('library.title')}>
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`fl-chip ${filter === f ? 'fl-chip--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {t(FILTER_KEY[f])}
          </button>
        ))}
      </div>

      {projects === null ? (
        <SkeletonList count={3} height={96} />
      ) : projects.length === 0 ? (
        <EmptyState icon={<IconLibrary size={44} />} text={t('library.empty')} />
      ) : (
        <div className="library-grid">
          {projects.map((project) => (
            <div key={project.id} className="fl-card library-item">
              <button
                className="library-item__preview"
                onClick={() => navigate(`/editor/${project.id}`)}
                aria-label={project.title}
              >
                {project.thumbnail ? (
                  <img src={project.thumbnail} alt="" loading="lazy" />
                ) : (
                  <span aria-hidden>
                    <IconImage size={26} />
                  </span>
                )}
              </button>
              <div className="library-item__body">
                <strong className="library-item__title">
                  {project.title || t('editor.untitled')}
                </strong>
                <div className="fl-row fl-wrap" style={{ gap: 'var(--fl-sp-1)' }}>
                  <span className="fl-badge fl-badge--pending">{t(statusKey(project))}</span>
                  <span className="fl-muted" style={{ fontSize: 'var(--fl-fs-xs)' }}>
                    {new Date(project.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="fl-row" style={{ gap: 'var(--fl-sp-1)' }}>
                  <button
                    className="fl-btn fl-btn--ghost fl-btn--sm"
                    title={t('library.edit')}
                    onClick={() => navigate(`/editor/${project.id}`)}
                  >
                    <IconEdit size={15} />
                  </button>
                  <button
                    className="fl-btn fl-btn--ghost fl-btn--sm"
                    title={t('library.duplicate')}
                    onClick={async () => {
                      await duplicateProject(project.id);
                      reload();
                    }}
                  >
                    <IconCopy size={15} />
                  </button>
                  <button
                    className="fl-btn fl-btn--ghost fl-btn--sm"
                    title={t('library.favorite')}
                    onClick={async () => {
                      await toggleFavorite(project.id);
                      reload();
                    }}
                  >
                    <IconStar size={15} filled={project.favorite} />
                  </button>
                  <button
                    className="fl-btn fl-btn--ghost fl-btn--sm"
                    title={t('library.export')}
                    onClick={() => setExporting({ project, share: false })}
                  >
                    <IconDownload size={15} />
                  </button>
                  <button
                    className="fl-btn fl-btn--ghost fl-btn--sm"
                    title={t('library.share')}
                    onClick={() => setExporting({ project, share: true })}
                  >
                    <IconShare size={15} />
                  </button>
                  <button
                    className="fl-btn fl-btn--ghost fl-btn--sm"
                    title={t('library.delete')}
                    onClick={() => setDeleting(project)}
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filter === 'scheduled' && scheduled.length > 0 && (
        <section>
          <h2 className="fl-subtitle" style={{ margin: 'var(--fl-sp-3) 0' }}>
            {t('schedule.upcoming')}
          </h2>
          <div className="fl-col">
            {scheduled.map((post) => (
              <div key={post.id} className="fl-card fl-row">
                <span className="fl-grow">
                  {new Date(post.scheduled_at).toLocaleString()} — {post.platform}
                  {post.last_error && (
                    <span
                      className="fl-muted"
                      style={{ display: 'block', fontSize: 'var(--fl-fs-xs)' }}
                    >
                      {t('errors.publishing')}
                    </span>
                  )}
                </span>
                <span
                  className={`fl-badge ${post.status === 'failed' ? 'fl-badge--blocked' : 'fl-badge--pending'}`}
                >
                  {t(`schedule.status.${post.status}`)}
                </span>
                {post.status === 'scheduled' && (
                  <button
                    className="fl-btn fl-btn--sm"
                    onClick={async () => {
                      await cancelScheduled(post.id);
                      reload();
                    }}
                  >
                    {t('schedule.cancel')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <Modal
        open={exporting !== null}
        onClose={() => {
          setExporting(null);
          setApproved(false);
        }}
        title={t('source.approve')}
      >
        {exporting && (
          <div className="fl-col">
            {sacredTexts(exporting.project).map((locked, i) => (
              <div key={i} className="fl-card">
                <p className="fl-naskh" dir="rtl">
                  {locked.text.length > 150 ? `${locked.text.slice(0, 150)}…` : locked.text}
                </p>
                <span className="fl-badge fl-badge--verified">{locked.source.source_name}</span>
              </div>
            ))}
            <label className="fl-row" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
              />
              <span>{t('source.approveDesc')}</span>
            </label>
            <button
              className="fl-btn fl-btn--primary"
              disabled={sacredTexts(exporting.project).length > 0 && !approved}
              onClick={runExport}
            >
              {exporting.share ? t('library.share') : t('library.export')}
            </button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={t('library.delete')}
        text={t('library.deleteConfirm')}
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) {
            await deleteProject(deleting.id);
            toast('info', t('library.deleted'));
            setDeleting(null);
            reload();
          }
        }}
      />
    </div>
  );
}
