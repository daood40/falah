/** Global audio player bar: play/pause, seek, speed, volume, loop, close. */
import { useI18n } from '@core/i18n';
import { IconClose, IconPause, IconPlay, IconRepeat, IconVolume } from '@core/ui/icons';
import { useAudio } from './audioStore';
import './audio.css';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function AudioBar() {
  const t = useI18n((s) => s.t);
  const audio = useAudio();
  if (!audio.track) return null;

  return (
    <div className="audiobar" role="region" aria-label={audio.track.title}>
      <button
        className="fl-btn fl-btn--primary fl-btn--icon"
        onClick={audio.toggle}
        aria-label={audio.playing ? 'pause' : 'play'}
      >
        {audio.playing ? <IconPause size={18} /> : <IconPlay size={18} />}
      </button>

      <div className="audiobar__center">
        <div className="audiobar__title">{audio.track.title}</div>
        <div className="audiobar__seek">
          <span className="audiobar__time">{fmt(audio.currentTime)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, audio.duration)}
            step={0.1}
            value={Math.min(audio.currentTime, audio.duration || 0)}
            onChange={(e) => audio.seek(Number(e.target.value))}
            aria-label="seek"
          />
          <span className="audiobar__time">{fmt(audio.duration)}</span>
        </div>
      </div>

      <select
        className="audiobar__speed"
        value={audio.speed}
        onChange={(e) => audio.setSpeed(Number(e.target.value))}
        aria-label="speed"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}×
          </option>
        ))}
      </select>

      <button
        className={`fl-btn fl-btn--ghost fl-btn--icon ${audio.loop ? 'audiobar__loop--on' : ''}`}
        onClick={() => audio.setLoop(!audio.loop)}
        aria-label="loop"
        aria-pressed={audio.loop}
      >
        <IconRepeat size={17} />
      </button>

      <div className="audiobar__volume">
        <IconVolume size={17} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={audio.volume}
          onChange={(e) => audio.setVolume(Number(e.target.value))}
          aria-label="volume"
        />
      </div>

      <button
        className="fl-btn fl-btn--ghost fl-btn--icon"
        onClick={audio.stop}
        aria-label={t('common.close')}
      >
        <IconClose size={17} />
      </button>
    </div>
  );
}
