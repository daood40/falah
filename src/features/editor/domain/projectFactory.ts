/** Factories that build editor projects — including source-locked religious content. */
import type {
  CanvasElement,
  ContentProject,
  ShapeElement,
  TextElement,
} from '@core/models/content';
import { formatById } from '@core/models/content';
import { lockText } from '@core/sourcelock/sourceLock';
import type { LockedText, SacredKind } from '@core/sourcelock/types';
import { newId } from '@core/utils/id';
import type { CachedAyah } from '@features/quran/domain/types';
import { surahByNumber } from '@features/quran/data/quranRepository';
import type { HadithRecord } from '@features/hadith/domain/types';

const QURAN_FONT = "'Amiri Quran', 'Scheherazade New', serif";
const NASKH_FONT = "'Scheherazade New', 'Amiri', serif";
const UI_FONT = "'Cairo', sans-serif";

export function newTextElement(text: string, overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: newId(),
    kind: 'text',
    x: 0.1,
    y: 0.4,
    w: 0.8,
    h: 0.2,
    rotation: 0,
    opacity: 1,
    text,
    fontFamily: UI_FONT,
    fontScale: 0.045,
    color: '#ffffff',
    align: 'center',
    bold: false,
    lineHeight: 1.7,
    shadow: false,
    ...overrides,
  };
}

export function newShapeElement(overrides: Partial<ShapeElement> = {}): ShapeElement {
  return {
    id: newId(),
    kind: 'shape',
    x: 0.3,
    y: 0.4,
    w: 0.4,
    h: 0.2,
    rotation: 0,
    opacity: 1,
    shape: 'rect',
    fill: '#0e5c46',
    borderColor: '#d4af37',
    borderWidth: 0,
    cornerRadius: 0.02,
    ...overrides,
  };
}

function sacredTextElement(
  locked: LockedText,
  sacredKind: SacredKind,
  overrides: Partial<TextElement> = {},
): TextElement {
  return {
    ...newTextElement(locked.text, {
      fontFamily: sacredKind === 'quran' ? QURAN_FONT : NASKH_FONT,
      fontScale: 0.05,
      lineHeight: 2,
      align: 'center',
      shadow: true,
      ...overrides,
    }),
    kind: 'sacred-text',
    locked: true,
    sacred: { locked, sacredKind },
  };
}

export function emptyProject(userId: string, formatId: string, title: string): ContentProject {
  const format = formatById(formatId);
  const now = new Date().toISOString();
  return {
    id: newId(),
    user_id: userId,
    title,
    type: format.type,
    format_id: format.id,
    background: {
      type: 'gradient',
      color: '#083b2d',
      gradientTo: '#06281f',
      gradientAngle: 160,
    },
    elements: [],
    status: 'draft',
    favorite: false,
    thumbnail: null,
    created_at: now,
    updated_at: now,
  };
}

/** Build a ready-to-edit design from verified ayahs (text + translation + reference). */
export async function projectFromAyahs(
  userId: string,
  formatId: string,
  ayahs: CachedAyah[],
  options: { includeTranslation: boolean; includeTafsir: boolean },
): Promise<ContentProject> {
  const first = ayahs[0];
  if (!first) throw new Error('projectFromAyahs requires at least one ayah');
  const surah = surahByNumber(first.surah);
  const surahName = surah?.name ?? String(first.surah);
  const arabicText = ayahs.map((a) => `${a.text} ﴿${a.ayah}﴾`).join(' ');
  const locked = await lockText(arabicText, first.source);

  const elements: CanvasElement[] = [sacredTextElement(locked, 'quran', { y: 0.18, h: 0.4 })];

  if (options.includeTranslation && first.translation) {
    const translationText = ayahs
      .map((a) => a.translation)
      .filter((t): t is string => t !== null)
      .join(' ');
    const lockedTr = await lockText(translationText, {
      ...first.source,
      source_id: `${first.source.source_id}-translation`,
    });
    elements.push(
      sacredTextElement(lockedTr, 'translation', {
        y: 0.6,
        h: 0.18,
        fontFamily: UI_FONT,
        fontScale: 0.03,
        lineHeight: 1.6,
        color: '#e8e2cf',
      }),
    );
  }

  if (options.includeTafsir && first.tafsir) {
    const lockedTafsir = await lockText(first.tafsir, {
      ...first.source,
      source_id: `${first.source.source_id}-tafsir`,
    });
    elements.push(
      sacredTextElement(lockedTafsir, 'tafsir', {
        y: 0.62,
        h: 0.2,
        fontFamily: NASKH_FONT,
        fontScale: 0.028,
        color: '#e8e2cf',
      }),
    );
  }

  const reference =
    ayahs.length === 1
      ? `سورة ${surahName} — الآية ${first.ayah}`
      : `سورة ${surahName} — الآيات ${first.ayah}-${ayahs[ayahs.length - 1]!.ayah}`;
  elements.push(
    newTextElement(reference, {
      kind: 'reference',
      y: 0.86,
      h: 0.08,
      fontScale: 0.025,
      color: '#d4af37',
      locked: false,
    }),
  );

  const project = emptyProject(userId, formatId, reference);
  project.elements = elements;
  return project;
}

/** Build a ready-to-edit design from a verified hadith. */
export async function projectFromHadith(
  userId: string,
  formatId: string,
  hadith: HadithRecord,
  options: { includeTranslation: boolean },
): Promise<ContentProject> {
  const locked = await lockText(hadith.arabic, hadith.source);
  const elements: CanvasElement[] = [
    sacredTextElement(locked, 'hadith', {
      y: 0.12,
      h: 0.5,
      fontScale: 0.034,
      lineHeight: 1.9,
    }),
  ];
  if (options.includeTranslation && hadith.english) {
    const lockedEn = await lockText(hadith.english, {
      ...hadith.source,
      source_id: `${hadith.source.source_id}-en`,
    });
    elements.push(
      sacredTextElement(lockedEn, 'translation', {
        y: 0.64,
        h: 0.18,
        fontFamily: UI_FONT,
        fontScale: 0.024,
        lineHeight: 1.5,
        color: '#e8e2cf',
      }),
    );
  }
  const reference = `${hadith.book ?? hadith.collection_id} — حديث ${hadith.number}`;
  elements.push(
    newTextElement(reference, {
      kind: 'reference',
      y: 0.87,
      h: 0.07,
      fontScale: 0.024,
      color: '#d4af37',
    }),
  );
  const project = emptyProject(userId, formatId, reference);
  project.elements = elements;
  return project;
}
