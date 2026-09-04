/** Upload validation for user images: raster formats only (SVG is scriptable
 * and deliberately excluded), bounded size so data-URLs cannot bloat memory
 * and IndexedDB. */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export const IMAGE_ACCEPT = ALLOWED_TYPES.join(',');
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type ImageFileError = 'type' | 'size';

export function validateImageFile(file: File): ImageFileError | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'type';
  if (file.size > MAX_IMAGE_BYTES) return 'size';
  return null;
}
