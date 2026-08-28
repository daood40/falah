/**
 * Design templates — professional, data-driven looks applied to any project.
 * A template restyles a design (background, palette, decorative frame) WITHOUT
 * ever touching sacred text content (Source Lock: styling only).
 */
import type {
  CanvasBackground,
  CanvasElement,
  ContentProject,
  ShapeElement,
} from '@core/models/content';
import { newId } from '@core/utils/id';

export interface DesignTemplate {
  id: string;
  nameAr: string;
  nameEn: string;
  premium: boolean;
  background: CanvasBackground;
  /** Color for primary (sacred/heading) text. */
  textColor: string;
  /** Color for secondary text (translation/tafsir). */
  secondaryColor: string;
  /** Color for the reference line + decorations. */
  accentColor: string;
  /** Decorative frame style. */
  frame: 'none' | 'thin-border' | 'double-border' | 'corner-lines' | 'divider';
}

export const TEMPLATES: DesignTemplate[] = [
  {
    id: 'emerald-classic',
    nameAr: 'زمردي كلاسيكي',
    nameEn: 'Emerald Classic',
    premium: false,
    background: { type: 'gradient', color: '#083b2d', gradientTo: '#06281f', gradientAngle: 160 },
    textColor: '#f5f1e6',
    secondaryColor: '#cfe0d7',
    accentColor: '#d4af37',
    frame: 'thin-border',
  },
  {
    id: 'night',
    nameAr: 'ليلي',
    nameEn: 'Night',
    premium: false,
    background: { type: 'gradient', color: '#101423', gradientTo: '#05060d', gradientAngle: 180 },
    textColor: '#eef1ff',
    secondaryColor: '#aeb6d8',
    accentColor: '#8ea6ff',
    frame: 'corner-lines',
  },
  {
    id: 'sand',
    nameAr: 'رملي دافئ',
    nameEn: 'Warm Sand',
    premium: false,
    background: { type: 'gradient', color: '#f3ead8', gradientTo: '#e4d3b3', gradientAngle: 140 },
    textColor: '#3d2f1a',
    secondaryColor: '#6d5a3a',
    accentColor: '#8a6d1f',
    frame: 'double-border',
  },
  {
    id: 'pure',
    nameAr: 'نقي أبيض',
    nameEn: 'Pure White',
    premium: false,
    background: { type: 'solid', color: '#fafaf7' },
    textColor: '#14201b',
    secondaryColor: '#4c5a53',
    accentColor: '#0e5c46',
    frame: 'divider',
  },
  {
    id: 'charcoal-gold',
    nameAr: 'فحمي ذهبي',
    nameEn: 'Charcoal Gold',
    premium: false,
    background: { type: 'gradient', color: '#1c1c1c', gradientTo: '#0a0a0a', gradientAngle: 135 },
    textColor: '#f2e9d5',
    secondaryColor: '#b8b0a0',
    accentColor: '#d4af37',
    frame: 'double-border',
  },
  {
    id: 'dawn',
    nameAr: 'فجر بنفسجي',
    nameEn: 'Violet Dawn',
    premium: true,
    background: { type: 'gradient', color: '#3b2b52', gradientTo: '#1b1230', gradientAngle: 200 },
    textColor: '#f4efff',
    secondaryColor: '#c9bde6',
    accentColor: '#e8b86d',
    frame: 'corner-lines',
  },
  {
    id: 'teal-sea',
    nameAr: 'بحري هادئ',
    nameEn: 'Calm Sea',
    premium: true,
    background: { type: 'gradient', color: '#0f3f43', gradientTo: '#071e21', gradientAngle: 170 },
    textColor: '#e9f6f4',
    secondaryColor: '#a9cdc8',
    accentColor: '#6fd0c0',
    frame: 'thin-border',
  },
  {
    id: 'olive',
    nameAr: 'زيتوني',
    nameEn: 'Olive',
    premium: true,
    background: { type: 'gradient', color: '#3a4a2e', gradientTo: '#1e2817', gradientAngle: 150 },
    textColor: '#f2f4e9',
    secondaryColor: '#c4ccb0',
    accentColor: '#d9c869',
    frame: 'divider',
  },
];

export function templateById(id: string): DesignTemplate | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

const DECORATION_PREFIX = 'tpl-deco-';

function frameElements(template: DesignTemplate): ShapeElement[] {
  const base = {
    rotation: 0,
    opacity: 1,
    fill: 'transparent',
    borderColor: template.accentColor,
    cornerRadius: 0,
  };
  const shape = (partial: Partial<ShapeElement>): ShapeElement => ({
    id: `${DECORATION_PREFIX}${newId()}`,
    kind: 'shape',
    shape: 'rect',
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    borderWidth: 0.003,
    ...base,
    ...partial,
  });

  switch (template.frame) {
    case 'thin-border':
      return [shape({ x: 0.04, y: 0.03, w: 0.92, h: 0.94, borderWidth: 0.0025 })];
    case 'double-border':
      return [
        shape({ x: 0.035, y: 0.025, w: 0.93, h: 0.95, borderWidth: 0.0018 }),
        shape({ x: 0.055, y: 0.04, w: 0.89, h: 0.92, borderWidth: 0.0035 }),
      ];
    case 'corner-lines':
      return [
        shape({ shape: 'line', x: 0.06, y: 0.055, w: 0.25, h: 0.002, borderWidth: 0.004 }),
        shape({ shape: 'line', x: 0.69, y: 0.055, w: 0.25, h: 0.002, borderWidth: 0.004 }),
        shape({ shape: 'line', x: 0.06, y: 0.94, w: 0.25, h: 0.002, borderWidth: 0.004 }),
        shape({ shape: 'line', x: 0.69, y: 0.94, w: 0.25, h: 0.002, borderWidth: 0.004 }),
      ];
    case 'divider':
      return [shape({ shape: 'line', x: 0.3, y: 0.79, w: 0.4, h: 0.002, borderWidth: 0.004 })];
    case 'none':
      return [];
  }
}

function isDecoration(el: CanvasElement): boolean {
  return el.id.startsWith(DECORATION_PREFIX);
}

/**
 * Apply a template to a project: replaces background + decorations and recolors
 * text elements by role. Sacred TEXT CONTENT and element geometry are untouched.
 */
export function applyTemplate(project: ContentProject, template: DesignTemplate): ContentProject {
  const kept = project.elements.filter((el) => !isDecoration(el));
  const recolored = kept.map((el): CanvasElement => {
    if (el.kind === 'shape' || el.kind === 'image') return el;
    if (el.kind === 'reference') return { ...el, color: template.accentColor };
    if (el.kind === 'sacred-text') {
      const isSecondary =
        el.sacred?.sacredKind === 'translation' || el.sacred?.sacredKind === 'tafsir';
      return { ...el, color: isSecondary ? template.secondaryColor : template.textColor };
    }
    return { ...el, color: template.textColor };
  });
  // Decorations render behind content: prepend them.
  return {
    ...project,
    background: { ...template.background },
    elements: [...frameElements(template), ...recolored],
  };
}
