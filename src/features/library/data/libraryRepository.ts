/** Library repository: offline-first CRUD over content projects (+ Supabase sync hook). */
import { db } from '@core/db/localdb';
import { auditLog } from '@core/audit/audit';
import { toAppError } from '@core/errors/errors';
import type { ContentProject, ContentType, ProjectStatus } from '@core/models/content';
import { newId } from '@core/utils/id';

export type LibraryFilter =
  | 'all'
  | 'posts'
  | 'videos'
  | 'stories'
  | 'reels'
  | 'drafts'
  | 'scheduled'
  | 'published'
  | 'favorites';

export type LibrarySort = 'newest' | 'oldest' | 'name';

const FILTER_TYPE: Partial<Record<LibraryFilter, ContentType>> = {
  posts: 'post',
  videos: 'video',
  stories: 'story',
  reels: 'reel',
};

const FILTER_STATUS: Partial<Record<LibraryFilter, ProjectStatus>> = {
  drafts: 'draft',
  scheduled: 'scheduled',
  published: 'published',
};

export async function saveProject(project: ContentProject): Promise<void> {
  try {
    const exists = await db.projects.get(project.id);
    await db.projects.put({ ...project, updated_at: new Date().toISOString() });
    await auditLog(project.user_id, exists ? 'content_updated' : 'content_created', {
      project_id: project.id,
      title: project.title,
      type: project.type,
    });
  } catch (error) {
    throw toAppError(error, 'storage');
  }
}

export async function getProject(id: string): Promise<ContentProject | null> {
  return (await db.projects.get(id)) ?? null;
}

export async function countProjects(userId: string): Promise<number> {
  return db.projects.where('user_id').equals(userId).count();
}

export async function listProjects(
  userId: string,
  filter: LibraryFilter = 'all',
  search = '',
  sort: LibrarySort = 'newest',
): Promise<ContentProject[]> {
  let projects = await db.projects.where('user_id').equals(userId).toArray();

  const type = FILTER_TYPE[filter];
  const status = FILTER_STATUS[filter];
  if (type) projects = projects.filter((p) => p.type === type);
  if (status) projects = projects.filter((p) => p.status === status);
  if (filter === 'favorites') projects = projects.filter((p) => p.favorite);

  const query = search.trim().toLowerCase();
  if (query.length > 0) {
    projects = projects.filter((p) => p.title.toLowerCase().includes(query));
  }

  projects.sort((a, b) => {
    if (sort === 'name') return a.title.localeCompare(b.title, 'ar');
    const diff = a.updated_at.localeCompare(b.updated_at);
    return sort === 'newest' ? -diff : diff;
  });
  return projects;
}

export async function deleteProject(id: string): Promise<void> {
  const project = await db.projects.get(id);
  if (!project) return;
  await db.transaction('rw', db.projects, db.scheduledPosts, async () => {
    await db.projects.delete(id);
    await db.scheduledPosts.where('project_id').equals(id).delete();
  });
  await auditLog(project.user_id, 'content_deleted', { project_id: id, title: project.title });
}

export async function duplicateProject(id: string): Promise<ContentProject | null> {
  const project = await db.projects.get(id);
  if (!project) return null;
  const now = new Date().toISOString();
  const copy: ContentProject = {
    ...structuredClone(project),
    id: newId(),
    title: `${project.title} (نسخة)`,
    status: 'draft',
    created_at: now,
    updated_at: now,
  };
  await db.projects.add(copy);
  await auditLog(project.user_id, 'content_created', { project_id: copy.id, duplicated_from: id });
  return copy;
}

export async function toggleFavorite(id: string): Promise<void> {
  const project = await db.projects.get(id);
  if (!project) return;
  await db.projects.update(id, { favorite: !project.favorite });
}

export async function setProjectStatus(id: string, status: ProjectStatus): Promise<void> {
  await db.projects.update(id, { status, updated_at: new Date().toISOString() });
}
