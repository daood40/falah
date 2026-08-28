/** Scheduler: lifecycle, validation, honest failure when platforms unconfigured. */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@core/db/localdb';
import { emptyProject } from '@features/editor/domain/projectFactory';
import { saveProject, getProject } from '@features/library/data/libraryRepository';
import { cancelScheduled, listScheduled, processDuePosts, schedulePost } from './domain/scheduler';

const USER = 'sched-user';

async function makeProject() {
  const project = emptyProject(USER, 'ig-post', 'مجدول');
  await saveProject(project);
  return project;
}

beforeEach(async () => {
  await db.scheduledPosts.clear();
  await db.projects.clear();
});

describe('scheduler', () => {
  it('rejects past times', async () => {
    const project = await makeProject();
    await expect(
      schedulePost({
        userId: USER,
        projectId: project.id,
        platform: 'instagram',
        scheduledAt: new Date(Date.now() - 1000),
        repeat: 'none',
      }),
    ).rejects.toMatchObject({ kind: 'validation' });
  });

  it('schedules and marks the project scheduled', async () => {
    const project = await makeProject();
    const post = await schedulePost({
      userId: USER,
      projectId: project.id,
      platform: 'instagram',
      scheduledAt: new Date(Date.now() + 60_000),
      repeat: 'none',
    });
    expect(post.status).toBe('scheduled');
    expect((await getProject(project.id))?.status).toBe('scheduled');
    expect(await listScheduled(USER)).toHaveLength(1);
  });

  it('cancel returns the project to draft', async () => {
    const project = await makeProject();
    const post = await schedulePost({
      userId: USER,
      projectId: project.id,
      platform: 'x',
      scheduledAt: new Date(Date.now() + 60_000),
      repeat: 'none',
    });
    await cancelScheduled(post.id);
    expect(await listScheduled(USER)).toHaveLength(0);
    expect((await getProject(project.id))?.status).toBe('draft');
  });

  it('due posts FAIL honestly when the platform is not configured (no fake publishing)', async () => {
    const project = await makeProject();
    const post = await schedulePost({
      userId: USER,
      projectId: project.id,
      platform: 'telegram',
      scheduledAt: new Date(Date.now() + 50),
      repeat: 'none',
    });
    await new Promise((r) => setTimeout(r, 80));
    await processDuePosts(async () => ({ media: new Blob(['x']), caption: 'c' }));
    const updated = await db.scheduledPosts.get(post.id);
    expect(updated?.status).toBe('failed');
    expect(updated?.last_error).toContain('not connected');
    expect((await getProject(project.id))?.status).toBe('failed');
  });
});
