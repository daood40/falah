/**
 * Canvas render engine — the single painter used by:
 *  - the editor's PNG export
 *  - the video renderer (per-frame, with animation progress)
 * Pure drawing logic: given a project + canvas size (+ optional animation state),
 * it paints one frame. No DOM coupling beyond CanvasRenderingContext2D.
 */
import type {
  CanvasBackground,
  CanvasElement,
  ContentProject,
  ImageElement,
  ShapeElement,
  TextAnimation,
  TextElement,
} from '@core/models/content';

export interface FrameOptions {
  width: number;
  height: number;
  /** 0..1 animation progress; undefined = static (final state). */
  progress?: number;
  animation?: TextAnimation;
  /** Preloaded images keyed by element id (canvas cannot await inside draw). */
  images?: Map<string, CanvasImageSource>;
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  bg: CanvasBackground,
  width: number,
  height: number,
  image?: CanvasImageSource,
): void {
  if (bg.type === 'image' && image) {
    drawCover(ctx, image, 0, 0, width, height);
    return;
  }
  if (bg.type === 'gradient' && bg.gradientTo) {
    const angle = ((bg.gradientAngle ?? 135) * Math.PI) / 180;
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.hypot(width, height) / 2;
    const gradient = ctx.createLinearGradient(
      cx - Math.cos(angle) * r,
      cy - Math.sin(angle) * r,
      cx + Math.cos(angle) * r,
      cy + Math.sin(angle) * r,
    );
    gradient.addColorStop(0, bg.color);
    gradient.addColorStop(1, bg.gradientTo);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = bg.color;
  }
  ctx.fillRect(0, 0, width, height);
}

/** object-fit: cover for canvas images. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const iw = 'width' in image ? Number(image.width) : w;
  const ih = 'height' in image ? Number(image.height) : h;
  if (iw <= 0 || ih <= 0) return;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(image, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

/** Greedy word-wrap using real text metrics (works for Arabic + Latin). */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ').filter((w) => w.length > 0);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line.length > 0 ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line.length > 0) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawTextElement(
  ctx: CanvasRenderingContext2D,
  el: TextElement,
  width: number,
  height: number,
  progress: number | undefined,
  animation: TextAnimation | undefined,
): void {
  const boxX = el.x * width;
  const boxY = el.y * height;
  const boxW = el.w * width;
  const boxH = el.h * height;
  const fontSize = el.fontScale * width;
  ctx.font = `${el.bold ? '700' : '400'} ${fontSize}px ${el.fontFamily}`;
  ctx.fillStyle = el.color;
  ctx.textBaseline = 'middle';

  let text = el.text;
  let alpha = el.opacity;
  let offsetY = 0;
  if (progress !== undefined && animation) {
    const eased = Math.min(1, Math.max(0, progress));
    if (animation === 'fade') alpha *= eased;
    if (animation === 'rise') {
      alpha *= eased;
      offsetY = (1 - eased) * fontSize * 1.5;
    }
    if (animation === 'typewriter') {
      text = text.slice(0, Math.ceil(text.length * eased));
    }
  }
  ctx.globalAlpha = alpha;
  if (el.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = fontSize * 0.15;
    ctx.shadowOffsetY = fontSize * 0.05;
  }

  const lines = wrapText(ctx, text, boxW);
  const lineHeight = fontSize * el.lineHeight;
  const totalHeight = lines.length * lineHeight;
  let y = boxY + Math.max(0, (boxH - totalHeight) / 2) + lineHeight / 2 + offsetY;
  for (const line of lines) {
    let x = boxX + boxW / 2;
    ctx.textAlign = 'center';
    if (el.align === 'right') {
      ctx.textAlign = 'right';
      x = boxX + boxW;
    } else if (el.align === 'left') {
      ctx.textAlign = 'left';
      x = boxX;
    }
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function drawShapeElement(
  ctx: CanvasRenderingContext2D,
  el: ShapeElement,
  width: number,
  height: number,
): void {
  const x = el.x * width;
  const y = el.y * height;
  const w = el.w * width;
  const h = el.h * height;
  ctx.globalAlpha = el.opacity;
  ctx.fillStyle = el.fill;
  ctx.strokeStyle = el.borderColor;
  ctx.lineWidth = el.borderWidth * width;
  ctx.beginPath();
  if (el.shape === 'circle') {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (el.shape === 'line') {
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
  } else {
    const r = Math.min(el.cornerRadius * width, w / 2, h / 2);
    ctx.roundRect(x, y, w, h, r);
  }
  if (el.shape !== 'line') ctx.fill();
  if (el.borderWidth > 0 || el.shape === 'line') ctx.stroke();
}

function drawImageElement(
  ctx: CanvasRenderingContext2D,
  el: ImageElement,
  width: number,
  height: number,
  image?: CanvasImageSource,
): void {
  if (!image) return;
  const x = el.x * width;
  const y = el.y * height;
  const w = el.w * width;
  const h = el.h * height;
  ctx.globalAlpha = el.opacity;
  ctx.save();
  const r = Math.min(el.cornerRadius * width, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  drawCover(ctx, image, x, y, w, h);
  ctx.restore();
}

function withRotation(
  ctx: CanvasRenderingContext2D,
  el: CanvasElement,
  width: number,
  height: number,
  draw: () => void,
): void {
  if (el.rotation === 0) {
    draw();
    return;
  }
  const cx = (el.x + el.w / 2) * width;
  const cy = (el.y + el.h / 2) * height;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((el.rotation * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  draw();
  ctx.restore();
}

/** Paint one full frame of a project. */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  project: ContentProject,
  options: FrameOptions,
): void {
  const { width, height, progress, animation, images } = options;
  ctx.clearRect(0, 0, width, height);
  ctx.globalAlpha = 1;
  drawBackground(ctx, project.background, width, height, images?.get('__background__'));
  for (const el of project.elements) {
    withRotation(ctx, el, width, height, () => {
      if (el.kind === 'shape') {
        drawShapeElement(ctx, el, width, height);
      } else if (el.kind === 'image') {
        drawImageElement(ctx, el, width, height, images?.get(el.id));
      } else {
        // Sacred text animates like any text; the TEXT ITSELF is immutable.
        drawTextElement(ctx, el, width, height, progress, animation);
      }
    });
  }
  ctx.globalAlpha = 1;
}

/** Load all image sources referenced by a project (for export/video). */
export async function preloadImages(
  project: ContentProject,
): Promise<Map<string, CanvasImageSource>> {
  const images = new Map<string, CanvasImageSource>();
  const tasks: Array<Promise<void>> = [];
  const load = (key: string, src: string) =>
    new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        images.set(key, img);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = src;
    });
  if (project.background.type === 'image' && project.background.imageSrc) {
    tasks.push(load('__background__', project.background.imageSrc));
  }
  for (const el of project.elements) {
    if (el.kind === 'image') tasks.push(load(el.id, el.src));
  }
  await Promise.all(tasks);
  return images;
}
