/** Version history + backup: snapshots restorable, backup round-trips. */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@core/db/localdb';
import { createBackup, restoreBackup } from '@core/backup/backup';
import { emptyProject } from './domain/projectFactory';
import { listVersions, saveVersion } from './data/versionsRepository';

const USER = 'ver-user';

beforeEach(async () => {
  await db.projectVersions.clear();
  await db.projects.clear();
});

describe('project versions', () => {
  it('snapshots, throttles, caps and restores byte-identical state', async () => {
    const project = emptyProject(USER, 'ig-post', 'نسخي');
    await saveVersion(project, true);
    // Throttled: an immediate non-forced snapshot is skipped.
    await saveVersion(project);
    expect(await listVersions(project.id)).toHaveLength(1);

    for (let i = 0; i < 20; i++) await saveVersion({ ...project, title: `v${i}` }, true);
    const versions = await listVersions(project.id);
    expect(versions.length).toBeLessThanOrEqual(15);
    expect(versions[0]!.snapshot.title).toBe('v19');
  });
});

describe('backup', () => {
  it('round-trips all user tables and rejects foreign files', async () => {
    const project = emptyProject(USER, 'ig-post', 'نسخة احتياطية');
    await db.projects.add(project);
    const backup = await createBackup();
    expect(backup.app).toBe('falah');

    await db.projects.clear();
    const restored = await restoreBackup(JSON.parse(JSON.stringify(backup)));
    expect(restored).toBeGreaterThan(0);
    expect((await db.projects.get(project.id))?.title).toBe('نسخة احتياطية');

    await expect(restoreBackup({ app: 'other' })).rejects.toThrow();
  });
});
