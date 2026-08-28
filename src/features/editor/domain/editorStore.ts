/** Editor state: current project, selection, undo/redo history. */
import { create } from 'zustand';
import type { CanvasBackground, CanvasElement, ContentProject } from '@core/models/content';
import { newId } from '@core/utils/id';

const HISTORY_LIMIT = 50;

interface EditorState {
  project: ContentProject | null;
  selectedId: string | null;
  past: ContentProject[];
  future: ContentProject[];
  dirty: boolean;

  load: (project: ContentProject) => void;
  close: () => void;
  select: (id: string | null) => void;
  updateProject: (patch: Partial<ContentProject>) => void;
  setBackground: (bg: CanvasBackground) => void;
  addElement: (el: CanvasElement) => void;
  updateElement: (id: string, patch: Partial<CanvasElement>) => void;
  /** Geometry-only updates during drag — no history entry per pixel. */
  moveElement: (id: string, patch: Partial<CanvasElement>) => void;
  commitGesture: () => void;
  removeElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  reorderElement: (id: string, direction: 1 | -1) => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
}

function touch(project: ContentProject): ContentProject {
  return { ...project, updated_at: new Date().toISOString() };
}

/** Sacred text content is immutable: strip any attempt to change it. */
function guardSacred(el: CanvasElement, patch: Partial<CanvasElement>): Partial<CanvasElement> {
  if (el.kind === 'sacred-text' && 'text' in patch) {
    const rest: Record<string, unknown> = { ...(patch as Record<string, unknown>) };
    delete rest['text'];
    return rest as Partial<CanvasElement>;
  }
  return patch;
}

export const useEditor = create<EditorState>((set, get) => {
  const pushHistory = (mutate: (p: ContentProject) => ContentProject) => {
    const { project, past } = get();
    if (!project) return;
    set({
      past: [...past.slice(-HISTORY_LIMIT + 1), project],
      future: [],
      project: touch(mutate(project)),
      dirty: true,
    });
  };

  return {
    project: null,
    selectedId: null,
    past: [],
    future: [],
    dirty: false,

    load: (project) => set({ project, selectedId: null, past: [], future: [], dirty: false }),
    close: () => set({ project: null, selectedId: null, past: [], future: [], dirty: false }),
    select: (id) => set({ selectedId: id }),

    updateProject: (patch) => pushHistory((p) => ({ ...p, ...patch })),
    setBackground: (bg) => pushHistory((p) => ({ ...p, background: bg })),
    addElement: (el) => pushHistory((p) => ({ ...p, elements: [...p.elements, el] })),

    updateElement: (id, patch) =>
      pushHistory((p) => ({
        ...p,
        elements: p.elements.map((el) =>
          el.id === id ? ({ ...el, ...guardSacred(el, patch) } as CanvasElement) : el,
        ),
      })),

    moveElement: (id, patch) => {
      const { project } = get();
      if (!project) return;
      set({
        project: {
          ...project,
          elements: project.elements.map((el) =>
            el.id === id ? ({ ...el, ...guardSacred(el, patch) } as CanvasElement) : el,
          ),
        },
        dirty: true,
      });
    },

    commitGesture: () => {
      const { project, past } = get();
      if (!project) return;
      set({ past: [...past.slice(-HISTORY_LIMIT + 1), project], future: [] });
    },

    removeElement: (id) => {
      pushHistory((p) => ({ ...p, elements: p.elements.filter((el) => el.id !== id) }));
      if (get().selectedId === id) set({ selectedId: null });
    },

    duplicateElement: (id) =>
      pushHistory((p) => {
        const el = p.elements.find((e) => e.id === id);
        if (!el) return p;
        const copy = {
          ...structuredClone(el),
          id: newId(),
          x: Math.min(el.x + 0.04, 0.9),
          y: Math.min(el.y + 0.04, 0.9),
        };
        return { ...p, elements: [...p.elements, copy] };
      }),

    reorderElement: (id, direction) =>
      pushHistory((p) => {
        const index = p.elements.findIndex((e) => e.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= p.elements.length) return p;
        const elements = [...p.elements];
        const [moved] = elements.splice(index, 1);
        elements.splice(target, 0, moved!);
        return { ...p, elements };
      }),

    undo: () => {
      const { past, project, future } = get();
      const previous = past[past.length - 1];
      if (!previous || !project) return;
      set({
        past: past.slice(0, -1),
        future: [project, ...future].slice(0, HISTORY_LIMIT),
        project: previous,
        dirty: true,
      });
    },

    redo: () => {
      const { future, project, past } = get();
      const next = future[0];
      if (!next || !project) return;
      set({
        future: future.slice(1),
        past: [...past, project].slice(-HISTORY_LIMIT),
        project: next,
        dirty: true,
      });
    },

    markSaved: () => set({ dirty: false }),
  };
});
