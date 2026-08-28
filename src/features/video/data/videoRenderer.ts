/**
 * Real video rendering in the browser:
 * canvas.captureStream + MediaRecorder → WebM (VP9/VP8), with optional
 * recitation audio mixed in through WebAudio. Frames are painted by the same
 * render engine as PNG export, driven by animation progress + subtitles.
 *
 * MP4 output and server-side rendering are documented in docs/ARCHITECTURE.md
 * (FFmpeg path); WebM is natively supported by every target platform uploader.
 */
import type { ContentProject } from '@core/models/content';
import { formatById } from '@core/models/content';
import { AppError } from '@core/errors/errors';
import { preloadImages, renderFrame, wrapText } from '@features/editor/domain/renderEngine';
import { assertProjectPublishable } from '@features/editor/data/exportService';

export interface RenderProgress {
  /** 0..1 */
  fraction: number;
}

export interface VideoRenderResult {
  blob: Blob;
  mimeType: string;
  durationSec: number;
}

function pickMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
  }
  throw new AppError('rendering', 'MediaRecorder unsupported in this browser');
}

function drawSubtitles(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
): void {
  const fontSize = width * 0.032;
  ctx.font = `600 ${fontSize}px 'Cairo', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const lines = wrapText(ctx, text, width * 0.86);
  const lineHeight = fontSize * 1.5;
  const padding = fontSize * 0.5;
  const boxHeight = lines.length * lineHeight + padding * 2;
  const y0 = height * 0.94 - boxHeight;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.roundRect(width * 0.05, y0, width * 0.9, boxHeight, fontSize * 0.6);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, y0 + padding + (i + 1) * lineHeight);
  });
}

/** Fetch + decode recitation audio; returns null when unavailable (video stays silent). */
async function loadAudio(audioCtx: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await audioCtx.decodeAudioData(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export async function renderVideo(
  project: ContentProject,
  options: {
    userApproved: boolean;
    audioUrl?: string;
    subtitleText?: string;
    maxHeight?: number;
    onProgress?: (p: RenderProgress) => void;
  },
): Promise<VideoRenderResult> {
  await assertProjectPublishable(project, options.userApproved);
  const settings = project.video ?? {
    durationSec: 10,
    animation: 'fade' as const,
    showSubtitles: false,
  };
  const format = formatById(project.format_id);

  // Cap resolution (entitlements / performance): scale down keeping ratio.
  const maxHeight = options.maxHeight ?? 1080;
  const scale = Math.min(1, maxHeight / Math.max(format.width, format.height));
  const width = Math.round((format.width * scale) / 2) * 2;
  const height = Math.round((format.height * scale) / 2) * 2;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AppError('rendering', 'Canvas 2D context unavailable');

  const images = await preloadImages(project);
  const mimeType = pickMimeType();
  const fps = 30;
  const stream = canvas.captureStream(fps);

  // Optional audio track (recitation) mixed via WebAudio.
  let audioCtx: AudioContext | null = null;
  let sourceNode: AudioBufferSourceNode | null = null;
  if (options.audioUrl && typeof AudioContext !== 'undefined') {
    audioCtx = new AudioContext();
    const buffer = await loadAudio(audioCtx, options.audioUrl);
    if (buffer) {
      const destination = audioCtx.createMediaStreamDestination();
      sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = buffer;
      sourceNode.loop = buffer.duration < settings.durationSec;
      sourceNode.connect(destination);
      destination.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    }
  }

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const durationMs = settings.durationSec * 1000;
  const animationMs = Math.min(2000, durationMs * 0.35);

  return new Promise<VideoRenderResult>((resolve, reject) => {
    recorder.onerror = () => reject(new AppError('rendering', 'MediaRecorder error'));
    recorder.onstop = () => {
      void audioCtx?.close();
      resolve({
        blob: new Blob(chunks, { type: mimeType }),
        mimeType,
        durationSec: settings.durationSec,
      });
    };

    recorder.start(250);
    sourceNode?.start();
    const startedAt = performance.now();

    const paint = () => {
      const elapsed = performance.now() - startedAt;
      if (elapsed >= durationMs) {
        recorder.stop();
        sourceNode?.stop();
        return;
      }
      const progress = Math.min(1, elapsed / animationMs);
      renderFrame(ctx, project, {
        width,
        height,
        progress,
        animation: settings.animation,
        images,
      });
      if (settings.showSubtitles && options.subtitleText) {
        drawSubtitles(ctx, options.subtitleText, width, height);
      }
      options.onProgress?.({ fraction: elapsed / durationMs });
      requestAnimationFrame(paint);
    };
    requestAnimationFrame(paint);
  });
}
