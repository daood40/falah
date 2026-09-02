/**
 * الورد اليومي (ختمة) — reading-progress tracker the category's daily apps
 * (Werd, Quranly, Tarteel Khatmah) are known for: current position, overall
 * percentage of the 6236 ayahs, and a day streak. Text comes exclusively
 * from the verified bundled Quran; everything is offline and on-device.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@core/i18n';
import { kvGet, kvSet } from '@core/db/localdb';
import { SkeletonList } from '@core/ui/primitives';
import { toast } from '@core/ui/Toast';
import { IconBook, IconEdit } from '@core/ui/icons';
import {
  getSurahAyahs,
  globalAyahNumber,
  listSurahs,
  surahByNumber,
} from '@features/quran/data/quranRepository';
import type { CachedAyah } from '@features/quran/domain/types';
import './werd.css';

const TOTAL_AYAHS = 6236;
const KEY = 'werd.progress';

interface WerdProgress {
  surah: number;
  ayah: number;
  /** ISO date (yyyy-mm-dd) of the last day a mark was made. */
  lastDay: string;
  streak: number;
}

const DEFAULT: WerdProgress = { surah: 1, ayah: 0, lastDay: '', streak: 0 };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

export function WerdPage() {
  const t = useI18n((s) => s.t);
  const [progress, setProgress] = useState<WerdProgress | null>(null);
  const [ayahs, setAyahs] = useState<CachedAyah[]>([]);
  const surahs = listSurahs();

  useEffect(() => {
    void kvGet<WerdProgress>(KEY).then((saved) => setProgress(saved ?? DEFAULT));
  }, []);

  useEffect(() => {
    if (!progress) return;
    void getSurahAyahs(progress.surah).then(setAyahs);
  }, [progress?.surah]);

  if (!progress) return <SkeletonList count={3} />;

  const readGlobal = progress.ayah === 0 ? 0 : globalAyahNumber(progress.surah, progress.ayah);
  const percent = Math.min(100, (readGlobal / TOTAL_AYAHS) * 100);
  const meta = surahByNumber(progress.surah);

  const markUpTo = async (ayah: number) => {
    const day = today();
    const streak =
      progress.lastDay === day
        ? progress.streak
        : progress.lastDay === yesterday()
          ? progress.streak + 1
          : 1;
    const next: WerdProgress = { ...progress, ayah, lastDay: day, streak };
    setProgress(next);
    await kvSet(KEY, next);
    toast('success', t('werd.marked'));
  };

  const setSurah = (surah: number) => {
    setProgress({ ...progress, surah, ayah: 0 });
  };

  const finishSurahAndAdvance = async () => {
    const last = meta?.ayahCount ?? 1;
    await markUpTo(last);
    if (progress.surah < 114) {
      const next = { ...progress, surah: progress.surah + 1, ayah: 0 };
      setProgress((p) => (p ? { ...p, surah: next.surah, ayah: 0 } : p));
      await kvSet(KEY, { ...progress, surah: next.surah, ayah: 0 });
    }
  };

  return (
    <div className="fl-col" style={{ gap: 'var(--fl-sp-5)' }}>
      <header>
        <h1 className="fl-title">{t('werd.title')}</h1>
        <p className="fl-muted">{t('werd.subtitle')}</p>
      </header>

      <section className="fl-card fl-col" style={{ gap: 'var(--fl-sp-3)' }}>
        <div className="fl-row">
          <strong className="fl-grow">
            {t('werd.progress')}: {percent.toFixed(1)}%
          </strong>
          <span className="fl-badge fl-badge--verified">
            {t('werd.streak')}: {progress.streak}
          </span>
        </div>
        <div
          className="werd-bar"
          role="progressbar"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        <p className="fl-muted" style={{ margin: 0, fontSize: 'var(--fl-fs-sm)' }}>
          {readGlobal} / {TOTAL_AYAHS} {t('werd.ayahs')}
        </p>
      </section>

      <div className="fl-row fl-wrap">
        <select
          className="fl-select fl-grow"
          value={progress.surah}
          onChange={(e) => setSurah(Number(e.target.value))}
          aria-label={t('create.surah')}
        >
          {surahs.map((s) => (
            <option key={s.number} value={s.number}>
              {s.number}. {s.name}
            </option>
          ))}
        </select>
        <button className="fl-btn fl-btn--sm" onClick={() => void finishSurahAndAdvance()}>
          <IconBook size={15} /> {t('werd.finishSurah')}
        </button>
      </div>

      <div className="fl-col werd-reader" lang="ar" dir="rtl">
        {ayahs.map((a) => (
          <button
            key={a.ayah}
            className={`werd-ayah ${a.ayah <= progress.ayah ? 'werd-ayah--read' : ''}`}
            onClick={() => void markUpTo(a.ayah)}
            title={t('werd.markHere')}
          >
            <span className="fl-quran-text">
              {a.text} ﴿{a.ayah}﴾
            </span>
          </button>
        ))}
      </div>

      <div className="fl-row" style={{ justifyContent: 'center' }}>
        <Link
          to={`/create/quran?surah=${progress.surah}&ayah=${Math.max(1, progress.ayah)}`}
          className="fl-btn fl-btn--ghost fl-btn--sm"
        >
          <IconEdit size={14} /> {t('azkar.design')}
        </Link>
      </div>
    </div>
  );
}
