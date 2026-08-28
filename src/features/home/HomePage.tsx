/** Home: greeting, quick actions, verse of the day, recent work, upcoming scheduled. */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@core/i18n';
import type { ContentProject, ScheduledPost } from '@core/models/content';
import { EmptyState, SkeletonList } from '@core/ui/primitives';
import { useAuth } from '@features/auth/authStore';
import { listProjects } from '@features/library/data/libraryRepository';
import { listScheduled } from '@features/scheduler/domain/scheduler';
import { getSurahAyahs, listSurahs } from '@features/quran/data/quranRepository';
import type { CachedAyah } from '@features/quran/domain/types';
import './home.css';

const QUICK_ACTIONS = [
  { key: 'home.quickQuran', icon: '📖', to: '/create/quran' },
  { key: 'home.quickHadith', icon: '📜', to: '/create/hadith' },
  { key: 'home.quickVideo', icon: '🎬', to: '/create/quran?video=1' },
  { key: 'home.quickStory', icon: '📱', to: '/create/quran?format=ig-story' },
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
    void listProjects(user.id).then((projects) => setRecent(projects.slice(0, 6)));
    void listScheduled(user.id).then((posts) =>
      setUpcoming(posts.filter((p) => p.status === 'scheduled').slice(0, 3)),
    );
  }, [user]);

  return (
    <div className="fl-col" style={{ gap: 'var(--fl-sp-5)' }}>
      <header>
        <h1 className="fl-title">{t('home.welcome')} 👋</h1>
        <p className="fl-muted">{t('home.subtitle')}</p>
      </header>

      <section className="home-quick" aria-label={t('home.subtitle')}>
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.key} to={action.to} className="fl-card home-quick__item">
            <span className="home-quick__icon" aria-hidden>
              {action.icon}
            </span>
            <span>{t(action.key)}</span>
          </Link>
        ))}
      </section>

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
            icon="🎨"
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
                    🖼️
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
          <h2 className="fl-subtitle" style={{ marginBottom: 'var(--fl-sp-3)' }}>
            {t('home.scheduled')}
          </h2>
          <div className="fl-col">
            {upcoming.map((post) => (
              <div key={post.id} className="fl-card fl-row">
                <span aria-hidden>🗓️</span>
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
