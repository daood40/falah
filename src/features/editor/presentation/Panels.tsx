/** Editor side panels: insert, layers, element properties, background. */
import type { ChangeEvent } from 'react';
import { useI18n } from '@core/i18n';
import type { CanvasElement, ShapeElement, TextElement } from '@core/models/content';
import { Field } from '@core/ui/primitives';
import { newShapeElement, newTextElement } from '../domain/projectFactory';
import { useEditor } from '../domain/editorStore';
import { newId } from '@core/utils/id';

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
        🅰️ {t('editor.addText')}
      </button>
      <button className="fl-btn fl-btn--sm" onClick={addShape}>
        ⬛ {t('editor.addShape')}
      </button>
      <label className="fl-btn fl-btn--sm" style={{ cursor: 'pointer' }}>
        🖼️ {t('editor.addImage')}
        <input type="file" accept="image/*" onChange={addImage} style={{ display: 'none' }} />
      </label>
    </div>
  );
}

function layerLabel(el: CanvasElement): string {
  if (el.kind === 'shape') return `⬛ ${el.shape}`;
  if (el.kind === 'image') return '🖼️ صورة';
  const text = (el as TextElement).text;
  const prefix = el.kind === 'sacred-text' ? '🔒 ' : el.kind === 'reference' ? '📌 ' : '🅰️ ';
  return prefix + text.slice(0, 30);
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
          <span className="layer-row__label">{layerLabel(el)}</span>
          <button
            className="fl-btn fl-btn--ghost fl-btn--sm"
            aria-label={t('editor.moveUp')}
            onClick={(e) => {
              e.stopPropagation();
              reorderElement(el.id, 1);
            }}
          >
            ↑
          </button>
          <button
            className="fl-btn fl-btn--ghost fl-btn--sm"
            aria-label={t('editor.moveDown')}
            onClick={(e) => {
              e.stopPropagation();
              reorderElement(el.id, -1);
            }}
          >
            ↓
          </button>
          <button
            className="fl-btn fl-btn--ghost fl-btn--sm"
            aria-label={t('editor.duplicate')}
            onClick={(e) => {
              e.stopPropagation();
              duplicateElement(el.id);
            }}
          >
            ⧉
          </button>
          <button
            className="fl-btn fl-btn--ghost fl-btn--sm"
            aria-label={t('editor.delete')}
            onClick={(e) => {
              e.stopPropagation();
              removeElement(el.id);
            }}
          >
            🗑️
          </button>
        </div>
      ))}
    </div>
  );
}

export function PropertiesPanel() {
  const t = useI18n((s) => s.t);
  const { project, selectedId, updateElement } = useEditor();
  const el = project?.elements.find((e) => e.id === selectedId);
  if (!el) return <p className="fl-muted">{t('editor.properties')}: —</p>;

  const isText = el.kind === 'text' || el.kind === 'sacred-text' || el.kind === 'reference';

  return (
    <div className="fl-col">
      {isText && (
        <>
          {el.kind === 'sacred-text' ? (
            <p className="fl-badge fl-badge--verified">{t('editor.locked')}</p>
          ) : (
            <Field label={t('editor.addText')}>
              <textarea
                className="fl-textarea"
                rows={2}
                value={(el as TextElement).text}
                onChange={(e) =>
                  updateElement(el.id, { text: e.target.value } as Partial<CanvasElement>)
                }
              />
            </Field>
          )}
          <div className="editor__grid">
            <Field label={t('editor.font')}>
              <select
                className="fl-select"
                value={(el as TextElement).fontFamily}
                onChange={(e) =>
                  updateElement(el.id, { fontFamily: e.target.value } as Partial<CanvasElement>)
                }
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
                onChange={(e) =>
                  updateElement(el.id, {
                    fontScale: Number(e.target.value),
                  } as Partial<CanvasElement>)
                }
              />
            </Field>
            <Field label={t('editor.align')}>
              <select
                className="fl-select"
                value={(el as TextElement).align}
                onChange={(e) =>
                  updateElement(el.id, {
                    align: e.target.value as TextElement['align'],
                  } as Partial<CanvasElement>)
                }
              >
                <option value="center">⬌</option>
                <option value="right">⇤</option>
                <option value="left">⇥</option>
              </select>
            </Field>
          </div>
          <ColorPicker
            label={t('editor.color')}
            value={(el as TextElement).color}
            onChange={(color) => updateElement(el.id, { color } as Partial<CanvasElement>)}
          />
          <div className="fl-row fl-wrap">
            <label className="fl-chip" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={(el as TextElement).bold}
                onChange={(e) =>
                  updateElement(el.id, { bold: e.target.checked } as Partial<CanvasElement>)
                }
              />
              B
            </label>
            <label className="fl-chip" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={(el as TextElement).shadow}
                onChange={(e) =>
                  updateElement(el.id, { shadow: e.target.checked } as Partial<CanvasElement>)
                }
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
                onChange={(e) =>
                  updateElement(el.id, {
                    shape: e.target.value as ShapeElement['shape'],
                  } as Partial<CanvasElement>)
                }
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
                onChange={(e) =>
                  updateElement(el.id, {
                    cornerRadius: Number(e.target.value),
                  } as Partial<CanvasElement>)
                }
              />
            </Field>
          </div>
          <ColorPicker
            label={t('editor.color')}
            value={(el as ShapeElement).fill}
            onChange={(fill) => updateElement(el.id, { fill } as Partial<CanvasElement>)}
          />
          <ColorPicker
            label={t('editor.borderColor')}
            value={(el as ShapeElement).borderColor}
            onChange={(borderColor) =>
              updateElement(el.id, { borderColor } as Partial<CanvasElement>)
            }
          />
        </>
      )}

      <Field label={t('editor.opacity')}>
        <input
          className="fl-input"
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={el.opacity}
          onChange={(e) => updateElement(el.id, { opacity: Number(e.target.value) })}
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
          🖼️ {t('editor.addImage')}
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
