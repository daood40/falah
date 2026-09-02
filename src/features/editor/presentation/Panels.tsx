/** Editor side panels: insert, layers, element properties, background, templates. */
import { useEffect, useState, type ChangeEvent } from 'react';
import { useI18n } from '@core/i18n';
import type { CanvasElement, ShapeElement, TextElement } from '@core/models/content';
import { Field } from '@core/ui/primitives';
import {
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconImage,
  IconLock,
  IconShapes,
  IconTrash,
  IconType,
} from '@core/ui/icons';
import { newShapeElement, newTextElement } from '../domain/projectFactory';
import { useEditor } from '../domain/editorStore';
import { newId } from '@core/utils/id';
import { TEMPLATES, applyTemplate, type DesignTemplate } from '@features/templates/templates';
import {
  applyUserTemplate,
  deleteUserTemplate,
  listUserTemplates,
  saveUserTemplate,
  templateFromProject,
  type UserTemplate,
} from '@features/templates/userTemplates';
import { toast } from '@core/ui/Toast';
import { useAuth } from '@features/auth/authStore';
import { entitlementsFor } from '@core/entitlements/entitlements';

const FONTS = [
  { label: 'Cairo', value: "'Cairo', sans-serif" },
  { label: 'Amiri Quran', value: "'Amiri Quran', 'Scheherazade New', serif" },
  { label: 'Scheherazade', value: "'Scheherazade New', 'Amiri', serif" },
];

const SWATCHES = [
  '#ffffff',
  '#e8e2cf',
  '#d4af37',
  '#0e5c46',
  '#083b2d',
  '#06281f',
  '#14201b',
  '#000000',
  '#7a1f18',
  '#1a5f8a',
  '#b08d24',
  '#178a60',
];

function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (c: string) => void;
  label: string;
}) {
  return (
    <Field label={label}>
      <div className="swatches">
        {SWATCHES.map((color) => (
          <button
            key={color}
            className={`swatch ${value === color ? 'swatch--active' : ''}`}
            style={{ background: color }}
            aria-label={`${label} ${color}`}
            onClick={() => onChange(color)}
          />
        ))}
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          style={{
            width: 30,
            height: 30,
            padding: 0,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
          }}
        />
      </div>
    </Field>
  );
}

export function InsertBar() {
  const t = useI18n((s) => s.t);
  const { addElement, select } = useEditor();

  const addText = () => {
    const el = newTextElement('نص جديد', { color: '#ffffff', y: 0.45 });
    addElement(el);
    select(el.id);
  };
  const addShape = () => {
    const el = newShapeElement();
    addElement(el);
    select(el.id);
  };
  const addImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const el: CanvasElement = {
        id: newId(),
        kind: 'image',
        x: 0.25,
        y: 0.3,
        w: 0.5,
        h: 0.3,
        rotation: 0,
        opacity: 1,
        src: String(reader.result),
        cornerRadius: 0.01,
      };
      addElement(el);
      select(el.id);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="fl-row fl-wrap">
      <button className="fl-btn fl-btn--sm" onClick={addText}>
        <IconType size={15} /> {t('editor.addText')}
      </button>
      <button className="fl-btn fl-btn--sm" onClick={addShape}>
        <IconShapes size={15} /> {t('editor.addShape')}
      </button>
      <label className="fl-btn fl-btn--sm" style={{ cursor: 'pointer' }}>
        <IconImage size={15} /> {t('editor.addImage')}
        <input type="file" accept="image/*" onChange={addImage} style={{ display: 'none' }} />
      </label>
    </div>
  );
}

function LayerIcon({ el }: { el: CanvasElement }) {
  if (el.kind === 'shape') return <IconShapes size={15} />;
  if (el.kind === 'image') return <IconImage size={15} />;
  if (el.kind === 'sacred-text') return <IconLock size={15} />;
  return <IconType size={15} />;
}

function layerText(el: CanvasElement): string {
  if (el.kind === 'shape') return el.shape;
  if (el.kind === 'image') return 'صورة';
  return (el as TextElement).text.slice(0, 30);
}

export function LayersPanel() {
  const t = useI18n((s) => s.t);
  const { project, selectedId, select, reorderElement, removeElement, duplicateElement } =
    useEditor();
  if (!project) return null;
  return (
    <div className="fl-col" style={{ gap: 'var(--fl-sp-2)' }}>
      {[...project.elements].reverse().map((el) => (
        <div
          key={el.id}
          className={`layer-row ${el.id === selectedId ? 'layer-row--active' : ''}`}
          onClick={() => select(el.id)}
        >
          <LayerIcon el={el} />
          <span className="layer-row__label">{layerText(el)}</span>
          <button
            className="fl-btn fl-btn--ghost fl-btn--sm"
            aria-label={t('editor.moveUp')}
            onClick={(e) => {
              e.stopPropagation();
              reorderElement(el.id, 1);
            }}
          >
            <IconChevronUp size={15} />
          </button>
          <button
            className="fl-btn fl-btn--ghost fl-btn--sm"
            aria-label={t('editor.moveDown')}
            onClick={(e) => {
              e.stopPropagation();
              reorderElement(el.id, -1);
            }}
          >
            <IconChevronDown size={15} />
          </button>
          <button
            className="fl-btn fl-btn--ghost fl-btn--sm"
            aria-label={t('editor.duplicate')}
            onClick={(e) => {
              e.stopPropagation();
              duplicateElement(el.id);
            }}
          >
            <IconCopy size={15} />
          </button>
          <button
            className="fl-btn fl-btn--ghost fl-btn--sm"
            aria-label={t('editor.delete')}
            onClick={(e) => {
              e.stopPropagation();
              removeElement(el.id);
            }}
          >
            <IconTrash size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Numeric geometry input as percentage of canvas. */
function GeometryInput({
  label,
  value,
  onChange,
  min = -0.5,
  max = 1.5,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <Field label={label}>
      <input
        className="fl-input"
        type="number"
        step={1}
        value={Math.round(value * 100)}
        onChange={(e) => {
          const pct = Number(e.target.value);
          if (Number.isFinite(pct)) onChange(Math.min(max, Math.max(min, pct / 100)));
        }}
      />
    </Field>
  );
}

export function PropertiesPanel() {
  const t = useI18n((s) => s.t);
  const { project, selectedId, updateElement } = useEditor();
  const el = project?.elements.find((e) => e.id === selectedId);
  if (!el) return <p className="fl-muted">{t('editor.properties')}: —</p>;

  const isText = el.kind === 'text' || el.kind === 'sacred-text' || el.kind === 'reference';
  const patch = (p: Partial<TextElement> | Partial<ShapeElement> | Partial<CanvasElement>) =>
    updateElement(el.id, p as Partial<CanvasElement>);

  return (
    <div className="fl-col">
      {isText && (
        <>
          {el.kind === 'sacred-text' ? (
            <p className="fl-badge fl-badge--verified">
              <IconLock size={13} /> {t('editor.locked')}
            </p>
          ) : (
            <Field label={t('editor.addText')}>
              <textarea
                className="fl-textarea"
                rows={2}
                value={(el as TextElement).text}
                onChange={(e) => patch({ text: e.target.value })}
              />
            </Field>
          )}
          <div className="editor__grid">
            <Field label={t('editor.font')}>
              <select
                className="fl-select"
                value={(el as TextElement).fontFamily}
                onChange={(e) => patch({ fontFamily: e.target.value })}
              >
                {FONTS.map((f) => (
                  <option key={f.label} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('editor.fontSize')}>
              <input
                className="fl-input"
                type="range"
                min={0.015}
                max={0.12}
                step={0.002}
                value={(el as TextElement).fontScale}
                onChange={(e) => patch({ fontScale: Number(e.target.value) })}
              />
            </Field>
            <Field label={t('editor.align')}>
              <select
                className="fl-select"
                value={(el as TextElement).align}
                onChange={(e) => patch({ align: e.target.value as TextElement['align'] })}
              >
                <option value="center">{t('editor.alignCenter')}</option>
                <option value="right">{t('editor.alignRight')}</option>
                <option value="left">{t('editor.alignLeft')}</option>
              </select>
            </Field>
            <Field label={t('editor.lineHeight')}>
              <input
                className="fl-input"
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={(el as TextElement).lineHeight}
                onChange={(e) => patch({ lineHeight: Number(e.target.value) })}
              />
            </Field>
          </div>
          <ColorPicker
            label={t('editor.color')}
            value={(el as TextElement).color}
            onChange={(color) => patch({ color })}
          />
          <div className="fl-row fl-wrap">
            <label className="fl-chip" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={(el as TextElement).bold}
                onChange={(e) => patch({ bold: e.target.checked })}
              />
              B
            </label>
            <label className="fl-chip" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={(el as TextElement).shadow}
                onChange={(e) => patch({ shadow: e.target.checked })}
              />
              {t('editor.shadow')}
            </label>
          </div>
        </>
      )}

      {el.kind === 'shape' && (
        <>
          <div className="editor__grid">
            <Field label={t('editor.addShape')}>
              <select
                className="fl-select"
                value={(el as ShapeElement).shape}
                onChange={(e) => patch({ shape: e.target.value as ShapeElement['shape'] })}
              >
                <option value="rect">▭</option>
                <option value="circle">◯</option>
                <option value="line">—</option>
              </select>
            </Field>
            <Field label={t('editor.radius')}>
              <input
                className="fl-input"
                type="range"
                min={0}
                max={0.1}
                step={0.005}
                value={(el as ShapeElement).cornerRadius}
                onChange={(e) => patch({ cornerRadius: Number(e.target.value) })}
              />
            </Field>
          </div>
          <ColorPicker
            label={t('editor.color')}
            value={(el as ShapeElement).fill}
            onChange={(fill) => patch({ fill })}
          />
          <ColorPicker
            label={t('editor.borderColor')}
            value={(el as ShapeElement).borderColor}
            onChange={(borderColor) => patch({ borderColor })}
          />
        </>
      )}

      <div className="editor__grid">
        <GeometryInput label="X %" value={el.x} onChange={(x) => patch({ x })} />
        <GeometryInput label="Y %" value={el.y} onChange={(y) => patch({ y })} />
        <GeometryInput label="W %" value={el.w} min={0.02} onChange={(w) => patch({ w })} />
        <GeometryInput label="H %" value={el.h} min={0.02} onChange={(h) => patch({ h })} />
      </div>

      <Field label={`${t('editor.rotation')} (${Math.round(el.rotation)}°)`}>
        <input
          className="fl-input"
          type="range"
          min={-180}
          max={180}
          step={1}
          value={el.rotation}
          onChange={(e) => patch({ rotation: Number(e.target.value) })}
        />
      </Field>

      <Field label={t('editor.opacity')}>
        <input
          className="fl-input"
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={el.opacity}
          onChange={(e) => patch({ opacity: Number(e.target.value) })}
        />
      </Field>
    </div>
  );
}

export function BackgroundPanel() {
  const t = useI18n((s) => s.t);
  const { project, setBackground } = useEditor();
  if (!project) return null;
  const bg = project.background;

  const setImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBackground({ ...bg, type: 'image', imageSrc: String(reader.result) });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="fl-col">
      <div className="fl-row fl-wrap">
        <button
          className={`fl-chip ${bg.type === 'solid' ? 'fl-chip--active' : ''}`}
          onClick={() => setBackground({ ...bg, type: 'solid' })}
        >
          {t('editor.solid')}
        </button>
        <button
          className={`fl-chip ${bg.type === 'gradient' ? 'fl-chip--active' : ''}`}
          onClick={() =>
            setBackground({ ...bg, type: 'gradient', gradientTo: bg.gradientTo ?? '#06281f' })
          }
        >
          {t('editor.gradient')}
        </button>
        <label
          className={`fl-chip ${bg.type === 'image' ? 'fl-chip--active' : ''}`}
          style={{ cursor: 'pointer' }}
        >
          <IconImage size={15} /> {t('editor.addImage')}
          <input type="file" accept="image/*" onChange={setImage} style={{ display: 'none' }} />
        </label>
      </div>
      <ColorPicker
        label={t('editor.color')}
        value={bg.color}
        onChange={(color) => setBackground({ ...bg, color })}
      />
      {bg.type === 'gradient' && (
        <ColorPicker
          label={`${t('editor.gradient')} 2`}
          value={bg.gradientTo ?? '#06281f'}
          onChange={(gradientTo) => setBackground({ ...bg, gradientTo })}
        />
      )}
    </div>
  );
}

function TemplateSwatch({ template }: { template: DesignTemplate }) {
  const bg = template.background;
  const style =
    bg.type === 'gradient' && bg.gradientTo
      ? {
          background: `linear-gradient(${bg.gradientAngle ?? 135}deg, ${bg.color}, ${bg.gradientTo})`,
        }
      : { background: bg.color };
  return (
    <span className="tpl-swatch" style={style} aria-hidden>
      <span className="tpl-swatch__line" style={{ background: template.textColor }} />
      <span
        className="tpl-swatch__line tpl-swatch__line--short"
        style={{ background: template.accentColor }}
      />
    </span>
  );
}

export function TemplatesPanel() {
  const t = useI18n((s) => s.t);
  const { project, updateProject } = useEditor();
  const { user } = useAuth();
  const [mine, setMine] = useState<UserTemplate[]>([]);
  const [name, setName] = useState('');
  const userId = user?.id;

  useEffect(() => {
    if (userId) void listUserTemplates(userId).then(setMine);
  }, [userId]);

  if (!project) return null;
  const premiumAllowed = entitlementsFor(user?.plan ?? 'free').premium_templates;

  const apply = (template: DesignTemplate) => {
    const styled = applyTemplate(project, template);
    updateProject({ background: styled.background, elements: styled.elements });
  };

  const saveCurrent = async () => {
    if (!userId) return;
    const tpl = templateFromProject(project, userId, name.trim() || project.title);
    await saveUserTemplate(tpl);
    setMine(await listUserTemplates(userId));
    setName('');
    toast('success', t('templates.saved'));
  };

  const applyMine = (tpl: UserTemplate) => {
    const styled = applyUserTemplate(project, tpl);
    updateProject({ background: styled.background, elements: styled.elements });
  };

  const removeMine = async (id: string) => {
    if (!userId) return;
    await deleteUserTemplate(id);
    setMine(await listUserTemplates(userId));
    toast('info', t('templates.deleted'));
  };

  return (
    <div className="fl-col" style={{ gap: 'var(--fl-sp-4)' }}>
      <section aria-label={t('templates.mine')}>
        <h3 className="fl-subtitle" style={{ marginBottom: 'var(--fl-sp-2)' }}>
          {t('templates.mine')}
        </h3>
        <div className="fl-row" style={{ marginBottom: 'var(--fl-sp-2)' }}>
          <input
            className="fl-input fl-grow"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('templates.namePlaceholder')}
            aria-label={t('templates.namePlaceholder')}
          />
          <button className="fl-btn fl-btn--sm fl-btn--primary" onClick={() => void saveCurrent()}>
            {t('editor.save')}
          </button>
        </div>
        {mine.length === 0 ? (
          <p className="fl-muted" style={{ margin: 0, fontSize: 'var(--fl-fs-xs)' }}>
            {t('templates.mineEmpty')}
          </p>
        ) : (
          <div className="fl-col">
            {mine.map((tpl) => (
              <div key={tpl.id} className="fl-row fl-card" style={{ padding: 'var(--fl-sp-2)' }}>
                <button
                  className="fl-btn fl-btn--ghost fl-btn--sm fl-grow"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => applyMine(tpl)}
                >
                  {tpl.name}
                </button>
                <button
                  className="fl-btn fl-btn--ghost fl-btn--icon"
                  aria-label={`${t('editor.delete')} — ${tpl.name}`}
                  onClick={() => void removeMine(tpl.id)}
                >
                  <IconTrash size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-label={t('editor.templates')}>
        <h3 className="fl-subtitle" style={{ marginBottom: 'var(--fl-sp-2)' }}>
          {t('editor.templates')}
        </h3>
        <div className="tpl-grid">
          {TEMPLATES.map((template) => {
            const locked = template.premium && !premiumAllowed;
            return (
              <button
                key={template.id}
                className="tpl-card"
                onClick={() => !locked && apply(template)}
                disabled={locked}
                title={locked ? t('templates.premiumOnly') : template.nameAr}
              >
                <TemplateSwatch template={template} />
                <span className="tpl-card__name">
                  {template.nameAr}
                  {template.premium && (
                    <span className="fl-badge fl-badge--pending">{t('templates.premium')}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
