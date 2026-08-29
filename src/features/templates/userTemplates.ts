/**
 * User-saved templates — reusable design STRUCTURE, never content.
 *
 * A user template captures the background, per-role text styling AND geometry
 * (where the verse goes, where the translation goes, where the reference
 * goes), plus decorative shapes/images. Applying one restyles/repositions the
 * target project's elements by role; sacred text payloads and checksums are
 * never touched (Source Lock: styling only), exactly like built-in templates.
 */
import type {
  CanvasBackground,
  CanvasElement,
  ContentProject,
  TextElement,
} from '@core/models/content';
import { db } from '@core/db/localdb';
import { newId } from '@core/utils/id';

export type TemplateRole = 'sacred' | 'secondary' | 'reference' | 'text';

export interface RoleStyle {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  fontFamily: string;
  fontScale: number;
  color: string;
  align: 'right' | 'center' | 'left';
  bold: boolean;
  lineHeight: number;
  shadow: boolean;
}

export interface UserTemplate {
  id: string;
  user_id: string;
  name: string;
  background: CanvasBackground;
  roles: Partial<Record<TemplateRole, RoleStyle>>;
  /** Decorative shapes/images copied verbatim (never sacred text). */
  decorations: CanvasElement[];
  created_at: string;
  updated_at: string;
}

function roleOf(el: TextElement): TemplateRole {
  if (el.kind === 'reference') return 'reference';
  if (el.kind === 'sacred-text') {
    const isSecondary =
      el.sacred?.sacredKind === 'translation' || el.sacred?.sacredKind === 'tafsir';
    return isSecondary ? 'secondary' : 'sacred';
  }
  return 'text';
}

function styleOf(el: TextElement): RoleStyle {
  const { x, y, w, h, rotation, opacity, fontFamily, fontScale, color, align, bold, lineHeight } =
    el;
  return {
    x,
    y,
    w,
    h,
    rotation,
    opacity,
    fontFamily,
    fontScale,
    color,
    align,
    bold,
    lineHeight,
    shadow: el.shadow,
  };
}

/** Capture the current project's look as a reusable template. */
export function templateFromProject(
  project: ContentProject,
  userId: string,
  name: string,
): UserTemplate {
  const roles: UserTemplate['roles'] = {};
  const decorations: CanvasElement[] = [];
  for (const el of project.elements) {
    if (el.kind === 'shape' || el.kind === 'image') {
      decorations.push({ ...el, id: `tpl-deco-${newId()}` });
    } else if (!(roleOf(el) in roles)) {
      // First element of each role defines the slot.
      roles[roleOf(el)] = styleOf(el);
    }
  }
  const now = new Date().toISOString();
  return {
    id: newId(),
    user_id: userId,
    name,
    background: { ...project.background },
    roles,
    decorations,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Apply a user template: restyle + reposition text elements by role, replace
 * decorations, swap the background. Text content, ids and sacred payloads are
 * preserved byte-for-byte.
 */
export function applyUserTemplate(project: ContentProject, tpl: UserTemplate): ContentProject {
  const texts = project.elements.filter(
    (el): el is TextElement =>
      el.kind === 'text' || el.kind === 'sacred-text' || el.kind === 'reference',
  );
  const styled = texts.map((el): TextElement => {
    const slot = tpl.roles[roleOf(el)];
    if (!slot) return el;
    const { shadow, ...rest } = slot;
    return { ...el, ...rest, shadow };
  });
  const decorations = tpl.decorations.map((el) => ({ ...el, id: `tpl-deco-${newId()}` }));
  return {
    ...project,
    background: { ...tpl.background },
    elements: [...decorations, ...styled],
  };
}

/* ---------- Repository (offline-first, per user) ---------- */

export async function listUserTemplates(userId: string): Promise<UserTemplate[]> {
  const all = await db.userTemplates.where('user_id').equals(userId).toArray();
  return all.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function saveUserTemplate(tpl: UserTemplate): Promise<void> {
  await db.userTemplates.put(tpl);
}

export async function deleteUserTemplate(id: string): Promise<void> {
  await db.userTemplates.delete(id);
}
