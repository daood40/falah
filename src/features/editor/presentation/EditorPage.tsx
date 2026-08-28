/** The content editor page: stage + panels + save/export/video/schedule. */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '@core/i18n';
import { AppError, reportError } from '@core/errors/errors';
import type { Platform, RepeatRule } from '@core/models/content';
import { Modal, Field, Spinner, ErrorState } from '@core/ui/primitives';
import { toast } from '@core/ui/Toast';
import { auditLog } from '@core/audit/audit';
import { useAuth } from '@features/auth/authStore';
import { getProject, saveProject } from '@features/library/data/libraryRepository';
import { schedulePost } from '@features/scheduler/domain/scheduler';
import { renderVideo } from '@features/video/data/videoRenderer';
import { ayahAudioUrl } from '@features/quran/data/quranRepository';
import { RECITERS } from '@features/quran/domain/types';
import type { TextElement } from '@core/models/content';
import {
  IconCalendar,
  IconDownload,
  IconRedo,
  IconSave,
  IconUndo,
  IconVideo,
  IconWatermark,
} from '@core/ui/icons';
import { useEditor } from '../domain/editorStore';
import { newTextElement } from '../domain/projectFactory';
import { exportPng, downloadBlob, renderThumbnail, sacredTexts } from '../data/exportService';
import { CanvasStage } from './CanvasStage';
import { BackgroundPanel, InsertBar, LayersPanel, PropertiesPanel, TemplatesPanel } from './Panels';
import './editor.css';

type PanelTab = 'properties' | 'layers' | 'background' | 'templates';

const TAB_KEYS: Record<PanelTab, string> = {
  properties: 'editor.properties',
  layers: 'editor.layers',
  background: 'editor.background',
  templates: 'editor.templates',
};

const PLATFORMS: Platform[] = ['instagram', 'facebook', 'tiktok', 'youtube', 'telegram', 'x'];

function ApprovalGate({
  open,
  onClose,
  onApproved,
}: {
  open: boolean;
  onClose: () => void;
  onApproved: () => void;
}) {
  const t = useI18n((s) => s.t);
  const { project } = useEditor();
  const [checked, setChecked] = useState(false);
  const texts = project ? sacredTexts(project) : [];
  return (
    <Modal open={open} onClose={onClose} title={t('source.approve')}>
      <div className="fl-col">
        {texts.map((locked, i) => (
          <div key={i} className="fl-card">
            <p className="fl-naskh" dir="rtl">
              {locked.text.length > 150 ? `${locked.text.slice(0, 150)}…` : locked.text}
            </p>
            <div className="fl-row fl-wrap" style={{ fontSize: 'var(--fl-fs-xs)' }}>
              <span className="fl-muted">
                {t('source.title')}: {locked.source.source_name}
              </span>
              <span className="fl-badge fl-badge--verified">{t('source.verified')}</span>
            </div>
          </div>
        ))}
        <label className="fl-row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>{t('source.approveDesc')}</span>
        </label>
        <button
          className="fl-btn fl-btn--primary"
          disabled={texts.length > 0 && !checked}
          onClick={() => {
            setChecked(false);
            onApproved();
          }}
        >
          {t('common.confirm')}
        </button>
      </div>
    </Modal>
  );
}

function VideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useI18n((s) => s.t);
  const { project, updateProject } = useEditor();
  const { user } = useAuth();
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);

  if (!project) return null;
  const settings = project.video ?? {
    durationSec: 10,
    animation: 'fade' as const,
    showSubtitles: true,
  };

  const subtitleText = project.elements.find(
    (el): el is TextElement =>
      el.kind === 'sacred-text' && Boolean(el.sacred?.sacredKind === 'translation'),
  )?.text;

  const audioUrl = settings.audioAyahKey
    ? (() => {
        const [s, a] = settings.audioAyahKey.split(':').map(Number);
        return s && a ? ayahAudioUrl(RECITERS[0]!, s, a) : undefined;
      })()
    : undefined;

  const render = async () => {
    setRendering(true);
    setProgress(0);
    try {
      const result = await renderVideo(project, {
        userApproved: true,
        audioUrl,
        subtitleText: settings.showSubtitles ? subtitleText : undefined,
        onProgress: (p) => setProgress(p.fraction),
      });
      const url = URL.createObjectURL(result.blob);
      setResultUrl(url);
      setResultBlob(result.blob);
      if (user)
        await auditLog(user.id, 'content_exported', { project_id: project.id, kind: 'video' });
      toast('success', t('video.done'));
    } catch (error) {
      if (error instanceof AppError && error.kind === 'rendering') {
        toast('error', t('video.notSupported'));
      } else {
        reportError(error, 'rendering');
      }
    } finally {
      setRendering(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('video.title')}>
      <div className="fl-col">
        <div className="editor__grid">
          <Field label={t('video.duration')}>
            <input
              className="fl-input"
              type="number"
              min={3}
              max={60}
              value={settings.durationSec}
              onChange={(e) =>
                updateProject({
                  video: {
                    ...settings,
                    durationSec: Math.max(3, Math.min(60, Number(e.target.value) || 10)),
                  },
                })
              }
            />
          </Field>
          <Field label={t('video.animation')}>
            <select
              className="fl-select"
              value={settings.animation}
              onChange={(e) =>
                updateProject({
                  video: { ...settings, animation: e.target.value as typeof settings.animation },
                })
              }
            >
              <option value="fade">{t('video.anim.fade')}</option>
              <option value="rise">{t('video.anim.rise')}</option>
              <option value="typewriter">{t('video.anim.typewriter')}</option>
            </select>
          </Field>
        </div>
        <label className="fl-chip" style={{ cursor: 'pointer', alignSelf: 'flex-start' }}>
          <input
            type="checkbox"
            checked={settings.showSubtitles}
            onChange={(e) =>
              updateProject({ video: { ...settings, showSubtitles: e.target.checked } })
            }
          />
          {t('video.subtitles')}
        </label>

        {rendering ? (
          <div className="fl-col" style={{ alignItems: 'center' }}>
            <Spinner label={`${t('video.rendering')} ${Math.round(progress * 100)}%`} />
          </div>
        ) : (
          <button className="fl-btn fl-btn--primary" onClick={render}>
            <IconVideo size={15} /> {t('video.render')}
          </button>
        )}

        {resultUrl && (
          <>
            <video
              src={resultUrl}
              controls
              style={{ width: '100%', borderRadius: 'var(--fl-r-md)' }}
            />
            <button
              className="fl-btn"
              onClick={() =>
                resultBlob && downloadBlob(resultBlob, `${project.title || 'falah-video'}.webm`)
              }
            >
              <IconDownload size={15} /> {t('video.downloadWebm')}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

function ScheduleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useI18n((s) => s.t);
  const { project } = useEditor();
  const { user } = useAuth();
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [repeat, setRepeat] = useState<RepeatRule>('none');

  const submit = async () => {
    if (!project || !user) return;
    const when = new Date(`${date}T${time}`);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      toast('error', t('schedule.pastTime'));
      return;
    }
    try {
      await schedulePost({
        userId: user.id,
        projectId: project.id,
        platform,
        scheduledAt: when,
        repeat,
      });
      toast('success', t('schedule.scheduled'));
      onClose();
    } catch (error) {
      reportError(error, 'validation');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('schedule.title')}>
      <div className="fl-col">
        <Field label={t('schedule.platform')}>
          <select
            className="fl-select"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <div className="editor__grid">
          <Field label={t('schedule.date')}>
            <input
              className="fl-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label={t('schedule.time')}>
            <input
              className="fl-input"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
        </div>
        <Field label={t('schedule.repeat')}>
          <select
            className="fl-select"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as RepeatRule)}
          >
            <option value="none">{t('schedule.repeat.none')}</option>
            <option value="daily">{t('schedule.repeat.daily')}</option>
            <option value="weekly">{t('schedule.repeat.weekly')}</option>
          </select>
        </Field>
        <p className="fl-muted">{t('schedule.notConnected')}</p>
        <button className="fl-btn fl-btn--primary" onClick={submit} disabled={!date || !time}>
          {t('schedule.confirm')}
        </button>
      </div>
    </Modal>
  );
}

export function EditorPage() {
  const t = useI18n((s) => s.t);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const editor = useEditor();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<PanelTab>('properties');
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void getProject(id).then((project) => {
      if (cancelled) return;
      if (!project) setNotFound(true);
      else editor.load(project);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // editor.load is stable (zustand); depending only on `id` is intentional.
  }, [id]);

  // Keyboard shortcuts: Delete removes the selection, Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y)
  // undo/redo, arrow keys nudge the selected element (Shift = larger step).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }
      const state = useEditor.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        state.redo();
        return;
      }
      const selected = state.selectedId;
      if (!selected) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        state.removeElement(selected);
        return;
      }
      const step = e.shiftKey ? 0.02 : 0.005;
      const el = state.project?.elements.find((item) => item.id === selected);
      if (!el) return;
      const nudge: Record<string, Partial<typeof el>> = {
        ArrowUp: { y: el.y - step },
        ArrowDown: { y: el.y + step },
        ArrowLeft: { x: el.x - step },
        ArrowRight: { x: el.x + step },
      };
      const patch = nudge[e.key];
      if (patch) {
        e.preventDefault();
        state.updateElement(selected, patch);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const addWatermark = () => {
    const project = editor.project;
    if (!project) return;
    const watermark = newTextElement(user?.displayName ? `@${user.displayName}` : 'فلاح', {
      x: 0.62,
      y: 0.94,
      w: 0.34,
      h: 0.05,
      fontScale: 0.02,
      color: '#ffffff',
      opacity: 0.45,
      align: 'left',
    });
    editor.addElement(watermark);
    editor.select(watermark.id);
  };

  const save = async () => {
    const project = editor.project;
    if (!project) return;
    setSaving(true);
    try {
      const thumbnail = await renderThumbnail(project).catch(() => null);
      await saveProject({ ...project, thumbnail });
      editor.markSaved();
      toast('success', t('editor.saved'));
    } catch (error) {
      reportError(error, 'storage');
    } finally {
      setSaving(false);
    }
  };

  const doExport = async () => {
    const project = editor.project;
    if (!project) return;
    setApprovalOpen(false);
    try {
      const blob = await exportPng(project, true);
      downloadBlob(blob, `${project.title || 'falah-design'}.png`);
      if (user)
        await auditLog(user.id, 'content_exported', { project_id: project.id, kind: 'png' });
      toast('success', t('editor.export') + ' ✓');
    } catch (error) {
      reportError(error, error instanceof AppError ? error.kind : 'rendering');
    }
  };

  if (loading) return <Spinner label={t('common.loading')} />;
  if (notFound || !editor.project) {
    return <ErrorState text={t('errors.unknown')} onRetry={() => navigate('/library')} />;
  }

  return (
    <div className="editor">
      <div className="editor__stage-col fl-col">
        <div className="editor__toolbar">
          <button
            className="fl-btn fl-btn--ghost fl-btn--icon"
            onClick={() => navigate(-1)}
            aria-label="back"
          >
            ←
          </button>
          <input
            className="editor__name"
            value={editor.project.title}
            placeholder={t('editor.untitled')}
            aria-label={t('editor.projectName')}
            onChange={(e) => editor.updateProject({ title: e.target.value })}
          />
          <button
            className="fl-btn fl-btn--ghost fl-btn--sm"
            onClick={editor.undo}
            disabled={editor.past.length === 0}
            aria-label="undo"
          >
            <IconUndo size={16} />
          </button>
          <button
            className="fl-btn fl-btn--ghost fl-btn--sm"
            onClick={editor.redo}
            disabled={editor.future.length === 0}
            aria-label="redo"
          >
            <IconRedo size={16} />
          </button>
          <button className="fl-btn fl-btn--sm" onClick={save} disabled={saving}>
            <IconSave size={15} /> {t('editor.save')}
          </button>
          <button className="fl-btn fl-btn--sm" onClick={() => setApprovalOpen(true)}>
            <IconDownload size={15} /> {t('editor.exportPng')}
          </button>
          <button className="fl-btn fl-btn--sm" onClick={() => setVideoOpen(true)}>
            <IconVideo size={15} /> {t('video.title')}
          </button>
          <button className="fl-btn fl-btn--sm" onClick={() => setScheduleOpen(true)}>
            <IconCalendar size={15} /> {t('library.schedule')}
          </button>
          <button className="fl-btn fl-btn--sm" onClick={addWatermark}>
            <IconWatermark size={15} /> {t('editor.watermark')}
          </button>
        </div>
        <CanvasStage />
      </div>

      <div className="editor__side">
        <InsertBar />
        <div className="editor__tabs" role="tablist">
          {(['properties', 'layers', 'background', 'templates'] as PanelTab[]).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={tab === p}
              className={`fl-chip ${tab === p ? 'fl-chip--active' : ''}`}
              onClick={() => setTab(p)}
            >
              {t(TAB_KEYS[p])}
            </button>
          ))}
        </div>
        <div className="editor__panel" role="tabpanel">
          {tab === 'properties' && <PropertiesPanel />}
          {tab === 'layers' && <LayersPanel />}
          {tab === 'background' && <BackgroundPanel />}
          {tab === 'templates' && <TemplatesPanel />}
        </div>
      </div>

      <ApprovalGate
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        onApproved={doExport}
      />
      <VideoModal open={videoOpen} onClose={() => setVideoOpen(false)} />
      <ScheduleModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
    </div>
  );
}
