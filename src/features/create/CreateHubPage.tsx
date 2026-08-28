/** Create hub: choose Quran or Hadith as the (verified) content source. */
import { Link } from 'react-router-dom';
import { useI18n } from '@core/i18n';
import './create.css';

export function CreateHubPage() {
  const t = useI18n((s) => s.t);
  return (
    <div className="fl-col" style={{ gap: 'var(--fl-sp-5)' }}>
      <h1 className="fl-title">{t('create.title')}</h1>
      <div className="create-hub">
        <Link to="/create/quran" className="fl-card create-hub__card create-hub__card--quran">
          <span className="create-hub__icon" aria-hidden>
            📖
          </span>
          <h2>{t('create.quran')}</h2>
          <p className="fl-muted">{t('create.quranDesc')}</p>
        </Link>
        <Link to="/create/hadith" className="fl-card create-hub__card create-hub__card--hadith">
          <span className="create-hub__icon" aria-hidden>
            📜
          </span>
          <h2>{t('create.hadith')}</h2>
          <p className="fl-muted">{t('create.hadithDesc')}</p>
        </Link>
      </div>
      <p className="fl-muted" style={{ textAlign: 'center' }}>
        {t('ai.disclaimer')}
      </p>
    </div>
  );
}
