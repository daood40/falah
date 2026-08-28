/** Global audio player: play/pause/seek/speed/volume/loop, bound to an ayah or any URL. */
import { create } from 'zustand';
import { reportError } from '@core/errors/errors';

export interface AudioTrack {
  url: string;
  title: string;
  /** e.g. "2:255" when the track is a recitation of an ayah. */
  ayahKey?: string;
}

interface AudioState {
  track: AudioTrack | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  volume: number;
  loop: boolean;

  play: (track: AudioTrack) => void;
  toggle: () => void;
  pause: () => void;
  stop: () => void;
  seek: (seconds: number) => void;
  setSpeed: (speed: number) => void;
  setVolume: (volume: number) => void;
  setLoop: (loop: boolean) => void;
}

let element: HTMLAudioElement | null = null;

function audio(): HTMLAudioElement {
  if (!element) {
    element = new Audio();
    element.preload = 'metadata';
  }
  return element;
}

export const useAudio = create<AudioState>((set, get) => {
  const bind = (el: HTMLAudioElement) => {
    el.ontimeupdate = () => set({ currentTime: el.currentTime });
    el.ondurationchange = () => set({ duration: Number.isFinite(el.duration) ? el.duration : 0 });
    el.onended = () => set({ playing: false, currentTime: 0 });
    el.onerror = () => {
      reportError(new Error(`Audio failed: ${el.src}`), 'network');
      set({ playing: false });
    };
  };

  return {
    track: null,
    playing: false,
    currentTime: 0,
    duration: 0,
    speed: 1,
    volume: 1,
    loop: false,

    play: (track) => {
      const el = audio();
      bind(el);
      if (get().track?.url !== track.url) {
        el.src = track.url;
        set({ track, currentTime: 0, duration: 0 });
      }
      el.playbackRate = get().speed;
      el.volume = get().volume;
      el.loop = get().loop;
      void el
        .play()
        .then(() => set({ playing: true }))
        .catch((error) => reportError(error, 'network'));
    },
    toggle: () => {
      const { playing, track } = get();
      if (!track) return;
      if (playing) get().pause();
      else get().play(track);
    },
    pause: () => {
      audio().pause();
      set({ playing: false });
    },
    stop: () => {
      const el = audio();
      el.pause();
      el.currentTime = 0;
      set({ playing: false, track: null, currentTime: 0 });
    },
    seek: (seconds) => {
      audio().currentTime = seconds;
      set({ currentTime: seconds });
    },
    setSpeed: (speed) => {
      audio().playbackRate = speed;
      set({ speed });
    },
    setVolume: (volume) => {
      audio().volume = volume;
      set({ volume });
    },
    setLoop: (loop) => {
      audio().loop = loop;
      set({ loop });
    },
  };
});
