/** Editor: sacred-text immutability, undo/redo, project factory, publish gate. */
import { beforeEach, describe, expect, it } from 'vitest';
import { useEditor } from './domain/editorStore';
import {
  emptyProject,
  newTextElement,
  projectFromAyahs,
  projectFromHadith,
} from './domain/projectFactory';
import { assertProjectPublishable, sacredTexts } from './data/exportService';
import { getAyah } from '@features/quran/data/quranRepository';
import { listHadiths } from '@features/hadith/data/hadithRepository';
import type { TextElement } from '@core/models/content';

describe('editor store', () => {
  beforeEach(() => {
    useEditor.getState().load(emptyProject('u1', 'ig-post', 'اختبار'));
  });

  it('adds, updates, duplicates, reorders and removes elements', () => {
    const editor = () => useEditor.getState();
    const el = newTextElement('مرحبا');
    editor().addElement(el);
    expect(editor().project?.elements).toHaveLength(1);

    editor().updateElement(el.id, { text: 'أهلا' } as Partial<TextElement>);
    expect((editor().project?.elements[0] as TextElement).text).toBe('أهلا');

    editor().duplicateElement(el.id);
    expect(editor().project?.elements).toHaveLength(2);

    editor().reorderElement(el.id, 1);
    expect(editor().project?.elements[1]?.id).toBe(el.id);

    editor().removeElement(el.id);
    expect(editor().project?.elements).toHaveLength(1);
  });

  it('undo/redo restores state', () => {
    const editor = () => useEditor.getState();
    editor().addElement(newTextElement('١'));
    editor().addElement(newTextElement('٢'));
    editor().undo();
    expect(editor().project?.elements).toHaveLength(1);
    editor().redo();
    expect(editor().project?.elements).toHaveLength(2);
  });

  it('NEVER allows editing the text of a sacred element', async () => {
    const ayah = (await getAyah(112, 1))!;
    const project = await projectFromAyahs('u1', 'ig-post', [ayah], {
      includeTranslation: false,
      includeTafsir: false,
    });
    useEditor.getState().load(project);
    const sacred = project.elements.find((e) => e.kind === 'sacred-text')!;
    const originalText = (sacred as TextElement).text;

    useEditor.getState().updateElement(sacred.id, { text: 'نص محرف' } as Partial<TextElement>);
    const after = useEditor
      .getState()
      .project?.elements.find((e) => e.id === sacred.id) as TextElement;
    expect(after.text).toBe(originalText);

    // Styling/geometry stays editable.
    useEditor.getState().updateElement(sacred.id, { color: '#000000' } as Partial<TextElement>);
    const styled = useEditor
      .getState()
      .project?.elements.find((e) => e.id === sacred.id) as TextElement;
    expect(styled.color).toBe('#000000');
    expect(styled.text).toBe(originalText);
  });
});

describe('project factory + publish gate', () => {
  it('builds a quran project with locked ayah + reference', async () => {
    const ayah = (await getAyah(1, 1))!;
    const project = await projectFromAyahs('u1', 'ig-story', [ayah], {
      includeTranslation: true,
      includeTafsir: false,
    });
    expect(project.type).toBe('story');
    const locked = sacredTexts(project);
    expect(locked.length).toBe(2); // ayah + translation
    expect(locked[0]?.source.review_status).toBe('verified');
    await expect(assertProjectPublishable(project, true)).resolves.toBeUndefined();
    await expect(assertProjectPublishable(project, false)).rejects.toMatchObject({
      kind: 'source_lock',
    });
  });

  it('builds a hadith project with source metadata', async () => {
    const hadith = (await listHadiths())[0]!;
    const project = await projectFromHadith('u1', 'ig-post', hadith, { includeTranslation: true });
    expect(sacredTexts(project)[0]?.source.source_id).toBe('nawawi40');
  });

  it('blocks publishing when a sacred element was tampered with', async () => {
    const ayah = (await getAyah(1, 2))!;
    const project = await projectFromAyahs('u1', 'ig-post', [ayah], {
      includeTranslation: false,
      includeTafsir: false,
    });
    const sacred = project.elements.find((e) => e.kind === 'sacred-text') as TextElement;
    // Simulate direct data tampering (bypassing the store guard).
    sacred.sacred!.locked = { ...sacred.sacred!.locked, text: 'نص محرف' };
    await expect(assertProjectPublishable(project, true)).rejects.toMatchObject({
      kind: 'source_lock',
    });
  });
});
