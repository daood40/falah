/**
 * Version history (v2 §15): every save keeps a restorable snapshot,
 * capped per project, stored offline. Restoring never touches sacred
 * payloads — snapshots are byte-identical copies of past states.
 */
import { db } from '@core/db/localdb';
import type { ContentProject } from '@core/models/content';
import { newId } from '@core/utils/id';

export interface ProjectVersion {
  id: string;
  project_id: string;
  saved_at: string;
  snapshot: ContentProject;
}

const KEEP = 15;
/** Don't snapshot more than once per minute of continuous editing. */
const MIN_GAP_MS = 60_000;

export async function saveVersion(project: ContentProject, force = false): Promise<void> {
  const latest = await db.projectVersions
    .where('project_id')
    .equals(project.id)
    .reverse()
    .sortBy('saved_at');
  const last = latest[0];
  if (!force && last && Date.now() - new Date(last.saved_at).getTime() < MIN_GAP_MS) return;
  await db.projectVersions.add({
    id: newId(),
    project_id: project.id,
    saved_at: new Date().toISOString(),
    snapshot: structuredClone(project),
  });
  const all = await db.projectVersions.where('project_id').equals(project.id).sortBy('saved_at');
  for (const old of all.slice(0, Math.max(0, all.length - KEEP))) {
    await db.projectVersions.delete(old.id);
  }
}

export async function listVersions(projectId: string): Promise<ProjectVersion[]> {
  const all = await db.projectVersions.where('project_id').equals(projectId).sortBy('saved_at');
  return all.reverse();
}

export async function getVersion(id: string): Promise<ProjectVersion | undefined> {
  return db.projectVersions.get(id);
}
