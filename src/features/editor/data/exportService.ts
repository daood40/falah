/** Export a project to PNG (full resolution) or a small thumbnail. */
import type { ContentProject } from '@core/models/content';
import { formatById } from '@core/models/content';
import { AppError } from '@core/errors/errors';
import { assertPublishable, combineReviewStatus } from '@core/sourcelock/sourceLock';
import { withPngMetadata } from '@core/sourcelock/pngMetadata';
import type { LockedText } from '@core/sourcelock/types';
import { preloadImages, renderFrame } from '../domain/renderEngine';

export function sacredTexts(project: ContentProject): LockedText[] {
  return project.elements.flatMap((el) =>
    el.kind === 'sacred-text' && 'sacred' in el && el.sacred ? [el.sacred.locked] : [],
  );
}

/** Verify every sacred text in the project before export/publish (Source Lock gate). */
export async function assertProjectPublishable(
  project: ContentProject,
  userApproved: boolean,
): Promise<void> {
  const texts = sacredTexts(project);
  const status = combineReviewStatus(texts.map((t) => t.source.review_status));
  if (status === 'blocked') {
    throw new AppError('source_lock', 'Project contains blocked religious text');
  }
  for (const locked of texts) {
    await assertPublishable(locked, userApproved);
  }
}

async function renderToCanvas(
  project: ContentProject,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AppError('rendering', 'Canvas 2D context unavailable');
  const images = await preloadImages(project);
  renderFrame(ctx, project, { width, height, images });
  return canvas;
}

/**
 * Full-resolution PNG blob. Runs the Source Lock gate first, then embeds the
 * sources + content hashes of every sacred text as PNG tEXt metadata
 * (v2 §4.4: exports carry their provenance).
 */
export async function exportPng(project: ContentProject, userApproved: boolean): Promise<Blob> {
  await assertProjectPublishable(project, userApproved);
  const format = formatById(project.format_id);
  const canvas = await renderToCanvas(project, format.width, format.height);
  const raw = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new AppError('rendering', 'canvas.toBlob returned null')),
      'image/png',
    );
  });
  const texts = sacredTexts(project);
  if (texts.length === 0) return raw;
  const bytes = withPngMetadata(new Uint8Array(await raw.arrayBuffer()), {
    'falah:generator': 'FALAH',
    'falah:source_ids': texts.map((t) => t.source.source_id).join(','),
    'falah:source_names': [...new Set(texts.map((t) => t.source.source_name))].join(' | '),
    'falah:content_hashes': texts.map((t) => t.checksum).join(','),
  });
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'image/png' });
}

/** Small JPEG thumbnail (data URI) for the library grid. */
export async function renderThumbnail(project: ContentProject, maxDim = 360): Promise<string> {
  const format = formatById(project.format_id);
  const scale = maxDim / Math.max(format.width, format.height);
  const canvas = await renderToCanvas(
    project,
    Math.round(format.width * scale),
    Math.round(format.height * scale),
  );
  return canvas.toDataURL('image/jpeg', 0.8);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
