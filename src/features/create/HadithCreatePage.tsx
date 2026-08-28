/** Hadith content creation: browse/search the verified collection, choose format, open in editor. */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '@core/i18n';
import { CONTENT_FORMATS } from '@core/models/content';
import { debounce } from '@core/utils/debounce';
import { EmptyState, Field, Spinner } from '@core/ui/primitives';
import { toast } from '@core/ui/Toast';
import { useAuth } from '@features/auth/authStore';
import { IconSearch } from '@core/ui/icons';
import { searchHadiths, getHadith } from '@features/hadith/data/hadithRepository';
import type { HadithRecord } from '@features/hadith/domain/types';
import { projectFromHadith } from '@features/editor/domain/projectFactory';
import { saveProject } from '@features/library/data/libraryRepository';
import './create.css';

export function HadithCreatePage() {
  const t = useI18n((s) => s.t);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [query, setQuery] = useState('');
  const [hadiths, setHadiths] = useState<HadithRecord[] | null>(null);
  const [selected, setSelected] = useState<HadithRecord | null>(null);
  const [formatId, setFormatId] = useState('ig-post');
  const [includeTranslation, setIncludeTranslation] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const preselect = params.get('id');
    void searchHadiths('').then((all) => {
      setHadiths(all);
      if (preselect) {
        void getHadith(preselect).then((h) => h && setSelected(h));
      }
    });
  }, [params]);

  const runSearch = useMemo(
    () =>
      debounce((text: string) => {
        void searchHadiths(text).then(setHadiths);
      }, 300),
    [],
  );

  const openInEditor = async () => {
    if (!user || !selected) return;
    setCreating(true);
    try {
      const project = await projectFromHadith(user.id, formatId, selected, { includeTranslation });
      await saveProject(project);
      navigate(`/editor/${project.id}`);
    } catch {
      toast('error', t('errors.rendering'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fl-col" style={{ gap: 'var(--fl-sp-4)' }}>
      <h1 className="fl-title">{t('create.hadith')}</h1>

      <input
        className="fl-input"
        type="search"
        placeholder={t('create.searchHadith')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          runSearch(e.target.value);
        }}
        aria-label={t('create.searchHadith')}
      />

      {selected && (
        <div className="fl-card hadith-card">
          <p className="fl-naskh" lang="ar" dir="rtl">
            {selected.arabic}
          </p>
          {includeTranslation && selected.english && (
            <p className="fl-muted" dir="ltr" lang="en">
              {selected.english}
            </p>
          )}
          <div className="ayah-card__meta">
            <span>
              {t('create.book')}: {selected.book}
            </span>
            <span>
              {t('create.hadithNumber')}: {selected.number}
            </span>
            {selected.narrator && (
              <span>
                {t('create.narrator')}: {selected.narrator}
              </span>
            )}
            <span>
              {t('create.grade')}: {selected.grade ?? '—'}
            </span>
            <span className="fl-badge fl-badge--verified">{t('source.verified')}</span>
          </div>
          <div className="fl-row fl-wrap" style={{ marginTop: 'var(--fl-sp-3)' }}>
            <label className="fl-chip" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeTranslation}
                onChange={(e) => setIncludeTranslation(e.target.checked)}
              />
              {t('create.translation')}
            </label>
          </div>
          <Field label={t('create.format')}>
            <div className="format-row" role="radiogroup" aria-label={t('create.format')}>
              {CONTENT_FORMATS.map((f) => (
                <button
                  key={f.id}
                  className={`fl-chip ${formatId === f.id ? 'fl-chip--active' : ''}`}
                  role="radio"
                  aria-checked={formatId === f.id}
                  onClick={() => setFormatId(f.id)}
                >
                  {f.label} · {f.ratio}
                </button>
              ))}
            </div>
          </Field>
          <button
            className="fl-btn fl-btn--primary"
            style={{ marginTop: 'var(--fl-sp-3)', width: '100%' }}
            onClick={openInEditor}
            disabled={creating || !user}
          >
            {creating ? t('common.loading') : t('create.openInEditor')}
          </button>
        </div>
      )}

      {hadiths === null ? (
        <Spinner label={t('common.loading')} />
      ) : hadiths.length === 0 ? (
        <EmptyState icon={<IconSearch size={44} />} text={t('common.noResults')} />
      ) : (
        <div className="fl-col">
          {hadiths.map((h) => (
            <button
              key={h.id}
              className="fl-card hadith-card"
              style={{ textAlign: 'start', cursor: 'pointer', font: 'inherit' }}
              onClick={() => setSelected(h)}
            >
              <p className="fl-naskh" lang="ar" dir="rtl">
                {h.arabic.length > 180 ? `${h.arabic.slice(0, 180)}…` : h.arabic}
              </p>
              <div className="ayah-card__meta">
                <span>
                  {t('create.hadithNumber')}: {h.number}
                </span>
                <span className="fl-badge fl-badge--verified">{t('source.verified')}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
