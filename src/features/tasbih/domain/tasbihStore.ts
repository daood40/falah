/**
 * Tasbih (dhikr counter) — fully offline, no notifications, no tracking.
 * Preset phrases are the universally transmitted adhkar; where the exact
 * wording occurs verbatim in the bundled verified Quran text we link the
 * ayah reference (Source Lock: we cite, we never author).
 */
import { create } from 'zustand';
import { kvGet, kvSet } from '@core/db/localdb';

export interface DhikrPreset {
  id: string;
  text: string;
  /** surah:ayah where the exact phrase occurs in the bundled Tanzil text. */
  quranRef?: string;
  defaultTarget: number;
}

export const DHIKR_PRESETS: DhikrPreset[] = [
  { id: 'subhan', text: 'سُبْحَانَ اللَّهِ', quranRef: '37:159', defaultTarget: 33 },
  { id: 'hamd', text: 'الْحَمْدُ لِلَّهِ', quranRef: '1:2', defaultTarget: 33 },
  { id: 'takbir', text: 'اللَّهُ أَكْبَرُ', defaultTarget: 34 },
  { id: 'tahlil', text: 'لَا إِلَٰهَ إِلَّا اللَّهُ', quranRef: '47:19', defaultTarget: 100 },
  { id: 'istighfar', text: 'أَسْتَغْفِرُ اللَّهَ', defaultTarget: 100 },
];

const DAY_KEY = () => `tasbih.total.${new Date().toISOString().slice(0, 10)}`;

interface TasbihState {
  presetId: string;
  count: number;
  target: number;
  todayTotal: number;
  init(): Promise<void>;
  tap(): Promise<void>;
  reset(): void;
  setPreset(id: string): void;
}

export const useTasbih = create<TasbihState>((set, get) => ({
  presetId: DHIKR_PRESETS[0]!.id,
  count: 0,
  target: DHIKR_PRESETS[0]!.defaultTarget,
  todayTotal: 0,

  async init() {
    const total = (await kvGet<number>(DAY_KEY())) ?? 0;
    set({ todayTotal: total });
  },

  async tap() {
    const { count, target, todayTotal } = get();
    const next = count + 1;
    // Gentle haptic tick; stronger pulse when the target round completes.
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(next === target ? [30, 40, 30] : 8);
    }
    const total = todayTotal + 1;
    set({ count: next >= target ? 0 : next, todayTotal: total });
    await kvSet(DAY_KEY(), total);
  },

  reset() {
    set({ count: 0 });
  },

  setPreset(id) {
    const preset = DHIKR_PRESETS.find((p) => p.id === id) ?? DHIKR_PRESETS[0]!;
    set({ presetId: preset.id, count: 0, target: preset.defaultTarget });
  },
}));
