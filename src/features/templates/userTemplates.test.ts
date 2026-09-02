/** User templates: reusable structure that NEVER touches sacred content. */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@core/db/localdb';
import { verifyLockedText } from '@core/sourcelock/sourceLock';
import { emptyProject, sacredTextElement } from '@features/editor/domain/projectFactory';
import type { TextElement } from '@core/models/content';
import {
  applyUserTemplate,
  deleteUserTemplate,
  listUserTemplates,
  saveUserTemplate,
  templateFromProject,
} from './userTemplates';
import { lockText } from '@core/sourcelock/sourceLock';

const USER = 'tpl-user';

async function sacredProject() {
  const project = emptyProject(USER, 'ig-post', 'قالبي');
  const locked = await lockText('إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ', {
    source_id: 'test-src',
    source_name: 'مصدر اختبار',
    source_url: 'https://example.com',
    source_version: '1',
    verified_at: new Date().toISOString(),
    review_status: 'verified',
  });
  project.elements.push(sacredTextElement(locked, 'hadith'));
  return project;
}

beforeEach(async () => {
  await db.userTemplates.clear();
});

describe('user templates', () => {
  it('captures structure and applies it without touching sacred text or checksums', async () => {
    const source = await sacredProject();
    const sacredBefore = source.elements.find((el) => el.kind === 'sacred-text') as TextElement;

    const tpl = templateFromProject(source, USER, 'هويتي');
    expect(tpl.roles.sacred).toBeDefined();
    expect(JSON.stringify(tpl)).not.toContain(sacredBefore.text.slice(0, 10));

    const target = await sacredProject();
    const styledTarget = applyUserTemplate(target, tpl);
    const sacredAfter = styledTarget.elements.find(
      (el) => el.kind === 'sacred-text',
    ) as TextElement;

    // Content and lock untouched, byte for byte — Source Lock still verifies.
    expect(sacredAfter.text).toBe(sacredBefore.text);
    expect(sacredAfter.sacred).toBeDefined();
    await expect(verifyLockedText(sacredAfter.sacred!.locked)).resolves.toBe(true);
    // Geometry/styling followed the template slot.
    expect(sacredAfter.x).toBe(tpl.roles.sacred!.x);
    expect(sacredAfter.fontFamily).toBe(tpl.roles.sacred!.fontFamily);
    expect(styledTarget.background).toEqual(tpl.background);
  });

  it('persists per user with save/list/delete', async () => {
    const tpl = templateFromProject(await sacredProject(), USER, 'قالب ١');
    await saveUserTemplate(tpl);
    await saveUserTemplate(templateFromProject(await sacredProject(), 'other-user', 'غيري'));
    const mine = await listUserTemplates(USER);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.name).toBe('قالب ١');
    await deleteUserTemplate(tpl.id);
    expect(await listUserTemplates(USER)).toHaveLength(0);
  });
});
