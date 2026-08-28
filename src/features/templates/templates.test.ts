/** Templates: styling-only guarantee (Source Lock), decoration replacement. */
import { describe, expect, it } from 'vitest';
import { TEMPLATES, applyTemplate, templateById } from './templates';
import { projectFromAyahs } from '@features/editor/domain/projectFactory';
import { assertProjectPublishable } from '@features/editor/data/exportService';
import { getAyah } from '@features/quran/data/quranRepository';
import type { TextElement } from '@core/models/content';

async function sampleProject() {
  const ayah = (await getAyah(1, 1))!;
  return projectFromAyahs('u1', 'ig-post', [ayah], {
    includeTranslation: true,
    includeTafsir: false,
  });
}

describe('design templates', () => {
  it('ships a professional catalog with free and premium looks', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(8);
    expect(TEMPLATES.some((t) => t.premium)).toBe(true);
    expect(TEMPLATES.some((t) => !t.premium)).toBe(true);
    expect(templateById('emerald-classic')).not.toBeNull();
    expect(templateById('missing')).toBeNull();
  });

  it('restyles background and colors WITHOUT touching sacred text (still publishable)', async () => {
    const project = await sampleProject();
    const template = templateById('charcoal-gold')!;
    const styled = applyTemplate(project, template);

    expect(styled.background.color).toBe(template.background.color);

    const sacredBefore = project.elements.find((e) => e.kind === 'sacred-text') as TextElement;
    const sacredAfter = styled.elements.find((e) => e.kind === 'sacred-text') as TextElement;
    expect(sacredAfter.text).toBe(sacredBefore.text);
    expect(sacredAfter.sacred!.locked.checksum).toBe(sacredBefore.sacred!.locked.checksum);
    expect(sacredAfter.color).toBe(template.textColor);

    const reference = styled.elements.find((e) => e.kind === 'reference') as TextElement;
    expect(reference.color).toBe(template.accentColor);

    // The checksum still verifies → the styled project passes the publish gate.
    await expect(assertProjectPublishable(styled, true)).resolves.toBeUndefined();
  });

  it('recolors translation as secondary text', async () => {
    const project = await sampleProject();
    const template = templateById('sand')!;
    const styled = applyTemplate(project, template);
    const translation = styled.elements.find(
      (e) => e.kind === 'sacred-text' && (e as TextElement).sacred?.sacredKind === 'translation',
    ) as TextElement;
    expect(translation.color).toBe(template.secondaryColor);
  });

  it('replaces decorations on re-apply instead of stacking them', async () => {
    const project = await sampleProject();
    const first = applyTemplate(project, templateById('emerald-classic')!); // 1 frame shape
    const second = applyTemplate(first, templateById('night')!); // 4 corner lines
    const third = applyTemplate(second, templateById('emerald-classic')!);
    const decoCount = (p: typeof project) =>
      p.elements.filter((e) => e.id.startsWith('tpl-deco-')).length;
    expect(decoCount(first)).toBe(1);
    expect(decoCount(second)).toBe(4);
    expect(decoCount(third)).toBe(1);
    // Content elements survive every application.
    expect(third.elements.filter((e) => e.kind !== 'shape').length).toBe(
      project.elements.filter((e) => e.kind !== 'shape').length,
    );
  });
});
