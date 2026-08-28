/** Quran content creation: search/select verified ayahs, choose format, listen, open in editor. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '@core/i18n';
import { CONTENT_FORMATS } from '@core/models/content';
import { debounce } from '@core/utils/debounce';
import { EmptyState, Field, Spinner } from '@core/ui/primitives';
import { toast } from '@core/ui/Toast';
import { useAuth } from '@features/auth/authStore';
import { useAudio } from '@features/audio/audioStore';
import { IconPause, IconPlay, IconSearch, IconVideo } from '@core/ui/icons';
import {
  ayahAudioUrl,
  getAyahRange,
  listSurahs,
  searchQuran,
  surahByNumber,
} from '@features/quran/data/quranRepository';
import { enrichAyah } from '@features/quran/data/quranApi';
import { RECITERS, RIWAYAT, type CachedAyah } from '@features/quran/domain/types';
import { projectFromAyahs } from '@features/editor/domain/projectFactory';
import { saveProject } from '@features/library/data/libraryRepository';
import { applyTemplate, templateById } from '@features/templates/templates';
import './create.css';

export function QuranCreatePage() {
  const t = useI18n((s) => s.t);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const audio = useAudio();

  const surahs = useMemo(() => listSurahs(), []);
  const [surah, setSurah] = useState(() => Number(params.get('surah')) || 1);
  const [fromAyah, setFromAyah] = useState(() => Number(params.get('ayah')) || 1);
  const [count, setCount] = useState(1);
  const [formatId, setFormatId] = useState(() => params.get('format') ?? 'ig-post');
  const [reciterId, setReciterId] = useState(RECITERS[0]!.id);
  const [includeTranslation, setIncludeTranslation] = useState(true);
  const [includeTafsir, setIncludeTafsir] = useState(false);
  const [asVideo, setAsVideo] = useState(() => params.get('video') === '1');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchQuran>> | null>(null);
  const [searching, setSearching] = useState(false);
  const [preview, setPreview] = useState<CachedAyah[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [creating, setCreating] = useState(false);

  const surahMeta = surahByNumber(surah);
  const maxAyah = surahMeta?.ayahCount ?? 1;

  // Load selected range preview (+ tafsir enrichment when online).
  useEffect(() => {
    let cancelled = false;
    setLoadingPreview(true);
    const from = Math.min(fromAyah, maxAyah);
    const to = Math.min(from + count - 1, maxAyah);
    void getAyahRange({ surah, from, to })
      .then(async (ayahs) => {
        if (cancelled) return;
        setPreview(ayahs);
        setLoadingPreview(false);
        const enriched = await Promise.all(ayahs.map(enrichAyah));
        if (!cancelled) setPreview(enriched);
      })
      .catch(() => !cancelled && setLoadingPreview(false));
    return () => {
      cancelled = true;
    };
  }, [surah, fromAyah, count, maxAyah]);

  const runSearch = useMemo(
    () =>
      debounce((text: string) => {
        if (text.trim().length === 0) {
          setResults(null);
          setSearching(false);
          return;
        }
        void searchQuran(text, 20).then((r) => {
          setResults(r);
          setSearching(false);
        });
      }, 300),
    [],
  );

  const onQueryChange = (text: string) => {
    setQuery(text);
    setSearching(true);
    runSearch(text);
  };

  const pickResult = (ayah: CachedAyah) => {
    setSurah(ayah.surah);
    setFromAyah(ayah.ayah);
    setCount(1);
    setResults(null);
    setQuery('');
  };

  const reciter = RECITERS.find((r) => r.id === reciterId) ?? RECITERS[0]!;
  const firstAyah = preview[0];

  const listen = () => {
    if (!firstAyah) return;
    if (audio.playing && audio.track?.ayahKey === firstAyah.key) {
      audio.pause();
      return;
    }
    audio.play({
      url: ayahAudioUrl(reciter, firstAyah.surah, firstAyah.ayah),
      title: `${surahMeta?.name ?? ''} ${firstAyah.ayah}`,
      ayahKey: firstAyah.key,
    });
  };

  const openInEditor = useCallback(async () => {
    if (!user || preview.length === 0) return;
    setCreating(true);
    try {
      let project = await projectFromAyahs(user.id, formatId, preview, {
        includeTranslation,
        includeTafsir,
      });
      const template = templateById(params.get('template') ?? '');
      if (template) project = applyTemplate(project, template);
      if (asVideo) {
        project.type = 'video';
        project.video = {
          durationSec: 10,
          animation: 'fade',
          showSubtitles: includeTranslation,
          audioAyahKey: firstAyah?.key,
          reciterId,
        };
      }
      await saveProject(project);
      navigate(`/editor/${project.id}`);
    } catch {
      toast('error', t('errors.rendering'));
    } finally {
      setCreating(false);
    }
  }, [
    user,
    preview,
    formatId,
    includeTranslation,
    includeTafsir,
    asVideo,
    firstAyah,
    reciterId,
    params,
    navigate,
    t,
  ]);

  return (
    <div className="fl-col" style={{ gap: 'var(--fl-sp-4)' }}>
      <h1 className="fl-title">{t('create.quran')}</h1>

      <input
        className="fl-input"
        type="search"
        placeholder={t('create.searchQuran')}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        aria-label={t('create.searchQuran')}
      />

      {searching && <Spinner label={t('common.loading')} />}
      {results !== null && !searching && (
        <div className="fl-col">
          {results.length === 0 ? (
            <EmptyState icon={<IconSearch size={44} />} text={t('common.noResults')} />
          ) : (
            results.map((r) => (
              <button
                key={r.ayah.key}
                className="fl-card ayah-card"
                onClick={() => pickResult(r.ayah)}
                style={{ textAlign: 'start', cursor: 'pointer', font: 'inherit' }}
              >
                <div className="fl-quran-text" lang="ar" dir="rtl">
                  {r.ayah.text}
                </div>
                <div className="ayah-card__meta">
                  <span>
                    سورة {r.surahName} — {r.ayah.ayah}
                  </span>
                  <span className="fl-badge fl-badge--verified">{t('source.verified')}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      <div className="create-controls">
        <Field label={t('create.surah')}>
          <select
            className="fl-select"
            value={surah}
            onChange={(e) => {
              setSurah(Number(e.target.value));
              setFromAyah(1);
            }}
          >
            {surahs.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('create.ayah')}>
          <input
            className="fl-input"
            type="number"
            min={1}
            max={maxAyah}
            value={fromAyah}
            onChange={(e) =>
              setFromAyah(Math.max(1, Math.min(maxAyah, Number(e.target.value) || 1)))
            }
          />
        </Field>
        <Field label={t('create.ayahCount')}>
          <input
            className="fl-input"
            type="number"
            min={1}
            max={Math.min(10, maxAyah - fromAyah + 1)}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
          />
        </Field>
        <Field label={t('create.reciter')}>
          <select
            className="fl-select"
            value={reciterId}
            onChange={(e) => setReciterId(e.target.value)}
          >
            {RECITERS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nameAr}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="fl-row fl-wrap">
        <span className="fl-chip">{RIWAYAT[0]!.nameAr}</span>
        {surahMeta && (
          <>
            <span className="fl-chip">
              {t('create.ayahCount')}: {surahMeta.ayahCount}
            </span>
            {firstAyah?.juz != null && (
              <span className="fl-chip">
                {t('create.juz')}: {firstAyah.juz}
              </span>
            )}
            {firstAyah?.page != null && (
              <span className="fl-chip">
                {t('create.page')}: {firstAyah.page}
              </span>
            )}
          </>
        )}
        <label className="fl-chip" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={includeTranslation}
            onChange={(e) => setIncludeTranslation(e.target.checked)}
          />
          {t('create.translation')}
        </label>
        <label className="fl-chip" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={includeTafsir}
            onChange={(e) => setIncludeTafsir(e.target.checked)}
            disabled={!firstAyah?.tafsir}
          />
          {t('create.tafsir')}
        </label>
        <label className="fl-chip" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={asVideo} onChange={(e) => setAsVideo(e.target.checked)} />
          <IconVideo size={15} /> {t('create.makeVideo')}
        </label>
      </div>

      {loadingPreview ? (
        <Spinner label={t('common.loading')} />
      ) : (
        preview.length > 0 && (
          <div className="fl-card ayah-card">
            <div className="fl-quran-text" lang="ar" dir="rtl">
              {preview.map((a) => `${a.text} ﴿${a.ayah}﴾`).join(' ')}
            </div>
            {includeTranslation && preview[0]?.translation && (
              <p className="fl-muted" dir="ltr" lang="en">
                {preview.map((a) => a.translation).join(' ')}
              </p>
            )}
            {includeTafsir && preview[0]?.tafsir && (
              <p className="fl-naskh fl-muted" lang="ar">
                {preview[0].tafsir}
              </p>
            )}
            <div className="ayah-card__meta">
              <span>{preview[0]?.source.source_name}</span>
              <span className="fl-badge fl-badge--verified">{t('source.verified')}</span>
            </div>
          </div>
        )
      )}

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

      <div className="fl-row fl-wrap">
        <button className="fl-btn" onClick={listen} disabled={preview.length === 0}>
          {audio.playing && audio.track?.ayahKey === firstAyah?.key ? (
            <IconPause size={15} />
          ) : (
            <IconPlay size={15} />
          )}{' '}
          {t('create.listen')}
        </button>
        <button
          className="fl-btn fl-btn--primary fl-grow"
          onClick={openInEditor}
          disabled={creating || preview.length === 0 || !user}
        >
          {creating
            ? t('common.loading')
            : asVideo
              ? t('create.makeVideo')
              : t('create.openInEditor')}
        </button>
      </div>
    </div>
  );
}
