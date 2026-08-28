/** Interactive design stage: DOM-rendered elements with pointer drag + resize. */
import { useRef } from 'react';
import type { CanvasBackground, CanvasElement, TextElement } from '@core/models/content';
import { formatById } from '@core/models/content';
import { useEditor } from '../domain/editorStore';

function backgroundStyle(bg: CanvasBackground): React.CSSProperties {
  if (bg.type === 'image' && bg.imageSrc) {
    return {
      backgroundImage: `url(${bg.imageSrc})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  if (bg.type === 'gradient' && bg.gradientTo) {
    return {
      background: `linear-gradient(${bg.gradientAngle ?? 135}deg, ${bg.color}, ${bg.gradientTo})`,
    };
  }
  return { background: bg.color };
}

function TextView({ el, stageWidth }: { el: TextElement; stageWidth: number }) {
  return (
    <div
      className="stage__text"
      style={{
        fontFamily: el.fontFamily,
        fontSize: el.fontScale * stageWidth,
        color: el.color,
        fontWeight: el.bold ? 700 : 400,
        lineHeight: el.lineHeight,
        textAlign: el.align,
        textShadow: el.shadow ? '0 2px 8px rgba(0,0,0,0.45)' : undefined,
      }}
      lang="ar"
    >
      {el.text}
    </div>
  );
}

export function CanvasStage({ stageWidth = 420 }: { stageWidth?: number }) {
  const { project, selectedId, select, moveElement, commitGesture } = useEditor();
  const stageRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    id: string;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    orig: { x: number; y: number; w: number; h: number };
  } | null>(null);

  if (!project) return null;
  const format = formatById(project.format_id);
  const stageHeight = (stageWidth * format.height) / format.width;

  const onPointerDown = (e: React.PointerEvent, el: CanvasElement, mode: 'move' | 'resize') => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    select(el.id);
    gesture.current = {
      id: el.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: el.x, y: el.y, w: el.w, h: el.h },
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    // RTL layouts don't flip clientX; canvas coordinates are physical.
    const dx = (e.clientX - g.startX) / stageWidth;
    const dy = (e.clientY - g.startY) / stageHeight;
    if (g.mode === 'move') {
      moveElement(g.id, {
        x: Math.min(0.98 - g.orig.w / 2, Math.max(-g.orig.w / 2 + 0.02, g.orig.x + dx)),
        y: Math.min(0.98 - g.orig.h / 2, Math.max(-g.orig.h / 2 + 0.02, g.orig.y + dy)),
      });
    } else {
      moveElement(g.id, {
        w: Math.min(1, Math.max(0.06, g.orig.w + dx)),
        h: Math.min(1, Math.max(0.04, g.orig.h + dy)),
      });
    }
  };

  const onPointerUp = () => {
    if (gesture.current) {
      gesture.current = null;
      commitGesture();
    }
  };

  return (
    <div className="stage-wrap">
      <div
        ref={stageRef}
        className="stage"
        dir="rtl"
        style={{ width: stageWidth, height: stageHeight, ...backgroundStyle(project.background) }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerDown={() => select(null)}
        role="application"
        aria-label={project.title}
      >
        {project.elements.map((el) => {
          const selected = el.id === selectedId;
          const style: React.CSSProperties = {
            left: `${el.x * 100}%`,
            top: `${el.y * 100}%`,
            width: `${el.w * 100}%`,
            height: `${el.h * 100}%`,
            opacity: el.opacity,
            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          };
          return (
            <div
              key={el.id}
              className={`stage__el ${selected ? 'stage__el--selected' : ''} ${
                el.kind === 'sacred-text' ? 'stage__el--locked-text' : ''
              }`}
              style={style}
              onPointerDown={(e) => onPointerDown(e, el, 'move')}
            >
              {el.kind === 'shape' ? (
                <div
                  style={{
                    width: '100%',
                    height: el.shape === 'line' ? Math.max(2, el.borderWidth * stageWidth) : '100%',
                    background: el.shape === 'line' ? el.borderColor : el.fill,
                    borderRadius:
                      el.shape === 'circle' ? '50%' : `${el.cornerRadius * stageWidth}px`,
                    border:
                      el.borderWidth > 0 && el.shape !== 'line'
                        ? `${el.borderWidth * stageWidth}px solid ${el.borderColor}`
                        : undefined,
                  }}
                />
              ) : el.kind === 'image' ? (
                <img
                  src={el.src}
                  alt=""
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: `${el.cornerRadius * stageWidth}px`,
                  }}
                />
              ) : (
                <TextView el={el} stageWidth={stageWidth} />
              )}
              {selected && (
                <div
                  className="stage__handle"
                  onPointerDown={(e) => onPointerDown(e, el, 'resize')}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
