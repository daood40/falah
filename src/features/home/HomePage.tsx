/** Home: greeting, quick actions, verse of the day, recent work, upcoming scheduled. */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@core/i18n';
import type { ContentProject, ScheduledPost } from '@core/models/content';
import { EmptyState, SkeletonList } from '@core/ui/primitives';
import {
  IconBook,
  IconCalendar,
  IconEdit,
  IconImage,
  IconScroll,
  IconStory,
  IconVideo,
} from '@core/ui/icons';
import { useAuth } from '@features/auth/authStore';
import { listProjects } from '@features/library/data/libraryRepository';
import { TEMPLATES } from '@features/templates/templates';
import { listScheduled } from '@features/scheduler/domain/scheduler';
import { getSurahAyahs, listSurahs } from '@features/quran/data/quranRepository';
import type { CachedAyah } from '@features/quran/domain/types';
import './home.css';

const QUICK_ACTIONS = [
  { key: 'home.quickQuran', icon: IconBook, to: '/create/quran' },
  { key: 'home.quickHadith', icon: IconScroll, to: '/create/hadith' },
  { key: 'home.quickVideo', icon: IconVideo, to: '/create/quran?video=1' },
  { key: 'home.quickStory', icon: IconStory, to: '/create/quran?format=ig-story' },
];

/** Deterministic "verse of the day": rotates through short verified surahs. */
async function verseOfDay(): Promise<{ ayah: CachedAyah; surahName: string } | null> {
  try {
    const surahs = listSurahs();
    const shortSurahs = surahs.filter((s) => s.ayahCount <= 12 && s.number >= 90);
    const day = Math.floor(Date.now() / 86_400_000);
    const surah = shortSurahs[day % shortSurahs.length];
    if (!surah) return null;
    const ayahs = await getSurahAyahs(surah.number);
    const ayah = ayahs[day % ayahs.length];
    return ayah ? { ayah, surahName: surah.name } : null;
  } catch {
    return null;
  }
}

export function HomePage() {
  const t = useI18n((s) => s.t);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recent, setRecent] = useState<ContentProject[] | null>(null);
  const [drafts, setDrafts] = useState<ContentProject[]>([]);
  const [stats, setStats] = useState<{
    drafts: number;
    scheduled: number;
    published: number;
    total: number;
  } | null>(null);
  const [upcoming, setUpcoming] = useState<ScheduledPost[]>([]);
  const [verse, setVerse] = useState<{ ayah: CachedAyah; surahName: string } | null>(null);

  useEffect(() => {
    void verseOfDay().then(setVerse);
  }, []);

  useEffect(() => {
    if (!user) {
      setRecent([]);
      return;
    }
    void listProjects(user.id).then((projects) => {
      setRecent(projects.slice(0, 6));
      setDrafts(projects.filter((p) => p.status === 'draft').slice(0, 3));
      setStats({
        drafts: projects.filter((p) => p.status === 'draft').length,
        scheduled: projects.filter((p) => p.status === 'scheduled' || p.status === 'publishing')
          .length,
        published: projects.filter((p) => p.status === 'published').length,
        total: projects.length,
      });
    });
    void listScheduled(user.id).then((posts) =>
      setUpcoming(posts.filter((p) => p.status === 'scheduled').slice(0, 3)),
    );
  }, [user]);

  return (
    <div className="fl-col" style={{ gap: 'var(--fl-sp-5)' }}>
      <header className="home-hero">
        <h1>{t('home.welcome')}</h1>
        <p>
          {user?.displayName ? `${user.displayName} — ` : ''}
          {t('home.subtitle')}
        </p>
      </header>

      {stats !== null && stats.total > 0 && (
        <section className="home-stats" aria-label={t('home.stats.total')}>
          {(
            [
              ['drafts', stats.drafts],
              ['scheduled', stats.scheduled],
              ['published', stats.published],
              ['total', stats.total],
            ] as const
          ).map(([key, value]) => (
            <Link
              key={key}
              to={key === 'scheduled' ? '/publish' : '/library'}
              className="fl-card home-stat"
            >
              <strong className="home-stat__value">{value}</strong>
              <span className="fl-muted">{t(`home.stats.${key}`)}</span>
            </Link>
          ))}
        </section>
      )}

      <section className="home-quick" aria-label={t('home.subtitle')}>
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.key} to={action.to} className="fl-card home-quick__item">
            <span className="home-quick__icon" aria-hidden>
              <action.icon size={32} />
            </span>
            <span>{t(action.key)}</span>
          </Link>
        ))}
      </section>

      {drafts.length > 0 && (
        <section aria-label={t('home.continue')}>
          <h2 className="fl-subtitle" style={{ marginBottom: 'var(--fl-sp-3)' }}>
            {t('home.continue')}
          </h2>
          <div className="fl-col">
            {drafts.map((project) => (
              <button
                key={project.id}
                className="fl-card fl-row home-draft"
                onClick={() => navigate(`/editor/${project.id}`)}
              >
                {project.thumbnail ? (
                  <img
                    src={project.thumbnail}
                    alt=""
                    className="home-draft__thumb"
                    loading="lazy"
                  />
                ) : (
                  <span className="home-draft__thumb home-draft__thumb--empty" aria-hidden>
                    <IconImage size={20} />
                  </span>
                )}
                <span className="fl-grow" style={{ textAlign: 'start' }}>
                  <strong>{project.title}</strong>
                  <span
                    className="fl-muted"
                    style={{ display: 'block', fontSize: 'var(--fl-fs-xs)' }}
                    dir="ltr"
                  >
                    {new Date(project.updated_at).toLocaleString()}
                  </span>
                </span>
                <span className="fl-badge fl-badge--pending">{t('schedule.status.draft')}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {verse && (
        <section
          className="fl-card home-verse"
          onClick={() =>
            navigate(`/create/quran?surah=${verse.ayah.surah}&ayah=${verse.ayah.ayah}`)
          }
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              navigate(`/create/quran?surah=${verse.ayah.surah}&ayah=${verse.ayah.ayah}`);
            }
          }}
        >
          <div className="fl-muted">{t('home.verseOfDay')}</div>
          <p className="fl-quran-text" lang="ar" dir="rtl">
            {verse.ayah.text}
          </p>
          <div className="home-verse__ref">
            سورة {verse.surahName} — {verse.ayah.ayah}
            <span className="fl-badge fl-badge--verified">{t('source.verified')}</span>
          </div>
        </section>
      )}

      <section>
        <h2 className="fl-subtitle" style={{ marginBottom: 'var(--fl-sp-3)' }}>
          {t('home.templates')}
        </h2>
        <div className="home-tpl-row">
          {TEMPLATES.map((tpl) => (
            <Link
              key={tpl.id}
              to={`/create/quran?template=${tpl.id}`}
              className="home-tpl"
              style={
                tpl.background.type === 'gradient' && tpl.background.gradientTo
                  ? {
                      background: `linear-gradient(${tpl.background.gradientAngle ?? 135}deg, ${tpl.background.color}, ${tpl.background.gradientTo})`,
                    }
                  : { background: tpl.background.color }
              }
            >
              <span className="home-tpl__line" style={{ background: tpl.textColor }} />
              <span
                className="home-tpl__line home-tpl__line--short"
                style={{ background: tpl.accentColor }}
              />
              <span className="home-tpl__name" style={{ color: tpl.textColor }}>
                {tpl.nameAr}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="fl-row" style={{ marginBottom: 'var(--fl-sp-3)' }}>
          <h2 className="fl-subtitle fl-grow">{t('home.recent')}</h2>
          <Link to="/library" className="fl-btn fl-btn--ghost fl-btn--sm">
            {t('home.viewAll')}
          </Link>
        </div>
        {recent === null ? (
          <SkeletonList count={2} />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={<IconEdit size={44} />}
            text={t('home.noRecent')}
            action={
              <Link to="/create" className="fl-btn fl-btn--primary">
                {t('create.title')}
              </Link>
            }
          />
        ) : (
          <div className="home-grid">
            {recent.map((project) => (
              <button
                key={project.id}
                className="fl-card home-grid__item"
                onClick={() => navigate(`/editor/${project.id}`)}
              >
                {project.thumbnail ? (
                  <img src={project.thumbnail} alt={project.title} loading="lazy" />
                ) : (
                  <div className="home-grid__placeholder" aria-hidden>
                    <IconImage size={30} />
                  </div>
                )}
                <span className="home-grid__title">{project.title}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section>
          <div className="fl-row" style={{ marginBottom: 'var(--fl-sp-3)' }}>
            <h2 className="fl-subtitle fl-grow">{t('home.scheduled')}</h2>
            <Link to="/publish" className="fl-btn fl-btn--ghost fl-btn--sm">
              {t('home.managePublishing')}
            </Link>
          </div>
          <div className="fl-col">
            {upcoming.map((post) => (
              <div key={post.id} className="fl-card fl-row">
                <span aria-hidden>
                  <IconCalendar size={18} />
                </span>
                <span className="fl-grow">
                  {new Date(post.scheduled_at).toLocaleString()} — {post.platform}
                </span>
                <span className="fl-badge fl-badge--pending">{t('schedule.status.scheduled')}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
