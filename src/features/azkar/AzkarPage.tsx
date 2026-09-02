/**
 * أذكار قرآنية — the Quranic portions commonly recited morning and evening,
 * served EXCLUSIVELY from the verified bundled Quran text (Source Lock).
 * FALAH does not assert repeat-count rulings; each card has a free counter
 * the user controls. Fully offline.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@core/i18n';
import { SkeletonList } from '@core/ui/primitives';
import { IconEdit, IconRepeat } from '@core/ui/icons';
import { getAyahRange, surahByNumber } from '@features/quran/data/quranRepository';
import type { CachedAyah } from '@features/quran/domain/types';
import './azkar.css';

interface AzkarItem {
  id: string;
  titleKey: string;
  surah: number;
  from: number;
  to: number;
}

const ITEMS: AzkarItem[] = [
  { id: 'kursi', titleKey: 'azkar.kursi', surah: 2, from: 255, to: 255 },
  { id: 'baqarah-end', titleKey: 'azkar.baqarahEnd', surah: 2, from: 285, to: 286 },
  { id: 'ikhlas', titleKey: 'azkar.ikhlas', surah: 112, from: 1, to: 4 },
  { id: 'falaq', titleKey: 'azkar.falaq', surah: 113, from: 1, to: 5 },
  { id: 'nas', titleKey: 'azkar.nas', surah: 114, from: 1, to: 6 },
];

export function AzkarPage() {
  const t = useI18n((s) => s.t);
  const [texts, setTexts] = useState<Record<string, CachedAyah[]> | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    void Promise.all(ITEMS.map(async (item) => [item.id, await getAyahRange(item)] as const)).then(
      (pairs) => setTexts(Object.fromEntries(pairs)),
    );
  }, []);

  const bump = (id: string) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(8);
    setCounts((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  };

  return (
    <div className="fl-col" style={{ gap: 'var(--fl-sp-5)' }}>
      <header>
        <h1 className="fl-title">{t('azkar.title')}</h1>
        <p className="fl-muted">{t('azkar.subtitle')}</p>
      </header>

      {texts === null ? (
        <SkeletonList count={3} />
      ) : (
        ITEMS.map((item) => {
          const ayahs = texts[item.id] ?? [];
          const first = ayahs[0];
          return (
            <section key={item.id} className="fl-card azkar-card" aria-label={t(item.titleKey)}>
              <div className="fl-row">
                <h2 className="fl-subtitle fl-grow">{t(item.titleKey)}</h2>
                <span className="fl-badge fl-badge--verified">{t('source.verified')}</span>
              </div>
              <p className="fl-quran-text" lang="ar" dir="rtl">
                {ayahs.map((a) => `${a.text} ﴿${a.ayah}﴾`).join(' ')}
              </p>
              <div className="fl-row fl-wrap azkar-card__meta">
                <span className="fl-muted" style={{ fontSize: 'var(--fl-fs-xs)' }}>
                  {surahByNumber(item.surah)?.name} {item.from}
                  {item.to > item.from ? `-${item.to}` : ''} · {first?.source.source_name}
                </span>
                <span className="fl-grow" />
                <Link
                  to={`/create/quran?surah=${item.surah}&ayah=${item.from}`}
                  className="fl-btn fl-btn--ghost fl-btn--sm"
                >
                  <IconEdit size={14} /> {t('azkar.design')}
                </Link>
                <button
                  className="fl-btn fl-btn--sm azkar-card__count"
                  onClick={() => bump(item.id)}
                >
                  <IconRepeat size={14} /> {counts[item.id] ?? 0}
                </button>
              </div>
            </section>
          );
        })
      )}

      <p className="fl-muted" style={{ fontSize: 'var(--fl-fs-xs)', textAlign: 'center' }}>
        {t('azkar.note')}
      </p>
    </div>
  );
}
