/**
 * السبحة — offline dhikr counter. One giant tap surface, preset adhkar with
 * Quran references where the phrase occurs verbatim in the verified text,
 * daily total persisted locally. No ads, no tracking, no notifications.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@core/i18n';
import { IconRepeat, IconUndo } from '@core/ui/icons';
import { DHIKR_PRESETS, useTasbih } from '../domain/tasbihStore';
import './tasbih.css';

export function TasbihPage() {
  const t = useI18n((s) => s.t);
  const { presetId, count, target, todayTotal, init, tap, reset, setPreset } = useTasbih();
  const preset = DHIKR_PRESETS.find((p) => p.id === presetId) ?? DHIKR_PRESETS[0]!;
  const progress = count / target;

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className="fl-col tasbih" style={{ gap: 'var(--fl-sp-5)' }}>
      <header style={{ textAlign: 'center' }}>
        <h1 className="fl-title">{t('tasbih.title')}</h1>
        <p className="fl-muted">{t('tasbih.subtitle')}</p>
      </header>

      <div
        className="fl-row fl-wrap"
        style={{ justifyContent: 'center' }}
        role="radiogroup"
        aria-label={t('tasbih.title')}
      >
        {DHIKR_PRESETS.map((p) => (
          <button
            key={p.id}
            className={`fl-chip ${p.id === presetId ? 'fl-chip--active' : ''}`}
            role="radio"
            aria-checked={p.id === presetId}
            onClick={() => setPreset(p.id)}
          >
            {p.text}
          </button>
        ))}
      </div>

      <button
        className="tasbih__pad"
        onClick={() => void tap()}
        aria-label={`${preset.text} — ${count} / ${target}`}
        style={{ ['--tasbih-progress' as string]: String(progress) }}
      >
        <span className="tasbih__dhikr fl-naskh" lang="ar">
          {preset.text}
        </span>
        <span className="tasbih__count" aria-hidden>
          {count}
        </span>
        <span className="tasbih__target fl-muted" aria-hidden>
          / {target}
        </span>
      </button>

      <div className="fl-row" style={{ justifyContent: 'center', gap: 'var(--fl-sp-3)' }}>
        <button className="fl-btn fl-btn--ghost fl-btn--sm" onClick={reset}>
          <IconUndo size={15} /> {t('tasbih.reset')}
        </button>
        <span className="fl-badge fl-badge--verified">
          <IconRepeat size={13} /> {t('tasbih.today')}: {todayTotal}
        </span>
      </div>

      {preset.quranRef && (
        <p className="fl-muted" style={{ textAlign: 'center', fontSize: 'var(--fl-fs-xs)' }}>
          {t('tasbih.sourceNote')}{' '}
          <Link
            to={`/create/quran?surah=${preset.quranRef.split(':')[0]}&ayah=${preset.quranRef.split(':')[1]}`}
          >
            {preset.quranRef}
          </Link>
        </p>
      )}
    </div>
  );
}
