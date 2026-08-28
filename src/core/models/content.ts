/** Shared content-domain models used across editor, video, library, and scheduler. */
import type { LockedText, SacredKind } from '../sourcelock/types';

export type ContentType = 'post' | 'story' | 'reel' | 'video';

export type AspectRatioId = '9:16' | '1:1' | '16:9' | '4:5';

export interface ContentFormat {
  id: string;
  label: string;
  platform: string;
  ratio: AspectRatioId;
  width: number;
  height: number;
  type: ContentType;
}

/** Every platform format supported by the create flow. */
export const CONTENT_FORMATS: ContentFormat[] = [
  {
    id: 'ig-post',
    label: 'Instagram Post',
    platform: 'instagram',
    ratio: '1:1',
    width: 1080,
    height: 1080,
    type: 'post',
  },
  {
    id: 'ig-story',
    label: 'Instagram Story',
    platform: 'instagram',
    ratio: '9:16',
    width: 1080,
    height: 1920,
    type: 'story',
  },
  {
    id: 'ig-reel',
    label: 'Reels',
    platform: 'instagram',
    ratio: '9:16',
    width: 1080,
    height: 1920,
    type: 'reel',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    platform: 'tiktok',
    ratio: '9:16',
    width: 1080,
    height: 1920,
    type: 'reel',
  },
  {
    id: 'yt-short',
    label: 'YouTube Shorts',
    platform: 'youtube',
    ratio: '9:16',
    width: 1080,
    height: 1920,
    type: 'reel',
  },
  {
    id: 'fb-post',
    label: 'Facebook',
    platform: 'facebook',
    ratio: '4:5',
    width: 1080,
    height: 1350,
    type: 'post',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Status',
    platform: 'whatsapp',
    ratio: '9:16',
    width: 1080,
    height: 1920,
    type: 'story',
  },
  {
    id: 'wide',
    label: 'YouTube / Wide',
    platform: 'youtube',
    ratio: '16:9',
    width: 1920,
    height: 1080,
    type: 'video',
  },
];

export type ElementKind = 'text' | 'sacred-text' | 'shape' | 'image' | 'reference';

export interface ElementBase {
  id: string;
  kind: ElementKind;
  /** Position/size as fractions of canvas (responsive across formats). */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  locked?: boolean;
}

export interface TextElement extends ElementBase {
  kind: 'text' | 'sacred-text' | 'reference';
  text: string;
  fontFamily: string;
  /** Font size as a fraction of canvas width. */
  fontScale: number;
  color: string;
  align: 'right' | 'center' | 'left';
  bold: boolean;
  lineHeight: number;
  shadow: boolean;
  /** Present only for sacred text: immutable source-locked payload. */
  sacred?: { locked: LockedText; sacredKind: SacredKind };
}

export interface ShapeElement extends ElementBase {
  kind: 'shape';
  shape: 'rect' | 'circle' | 'line';
  fill: string;
  borderColor: string;
  borderWidth: number;
  cornerRadius: number;
}

export interface ImageElement extends ElementBase {
  kind: 'image';
  /** Data URI or asset URL. */
  src: string;
  cornerRadius: number;
}

export type CanvasElement = TextElement | ShapeElement | ImageElement;

export interface CanvasBackground {
  type: 'solid' | 'gradient' | 'image';
  color: string;
  gradientTo?: string;
  gradientAngle?: number;
  imageSrc?: string;
}

export type ProjectStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';

export interface ContentProject {
  id: string;
  user_id: string;
  title: string;
  type: ContentType;
  format_id: string;
  background: CanvasBackground;
  elements: CanvasElement[];
  status: ProjectStatus;
  favorite: boolean;
  /** PNG thumbnail data-URI for library grid. */
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
  /** Video-specific settings, present when type is video/reel. */
  video?: VideoSettings;
}

export type TextAnimation = 'fade' | 'rise' | 'typewriter';

export interface VideoSettings {
  durationSec: number;
  animation: TextAnimation;
  showSubtitles: boolean;
  audioAyahKey?: string;
}

export type Platform = 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'telegram' | 'x';

export type RepeatRule = 'none' | 'daily' | 'weekly';

export interface ScheduledPost {
  id: string;
  user_id: string;
  project_id: string;
  platform: Platform;
  scheduled_at: string;
  repeat: RepeatRule;
  status: ProjectStatus;
  last_error: string | null;
  created_at: string;
}

export function formatById(id: string): ContentFormat {
  return CONTENT_FORMATS.find((f) => f.id === id) ?? CONTENT_FORMATS[0]!;
}
