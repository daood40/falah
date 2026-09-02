/** Hijri calendar + occasions: pure on-device Intl math, no network. */
import { describe, expect, it } from 'vitest';
import { hijriOf, hijriToday, upcomingOccasions } from './hijri';

describe('hijri', () => {
  it('converts a known date (1 Ramadan 1444 = 23 March 2023 in Umm al-Qura)', () => {
    const h = hijriOf(new Date(2023, 2, 23));
    expect(h.year).toBe(1444);
    expect(h.month).toBe(9);
    expect(h.day).toBe(1);
  });

  it('formats a readable hijri date', () => {
    const s = hijriToday(new Date(2023, 2, 23));
    expect(s).toContain('رمضان');
    expect(s).toContain('هـ');
  });

  it('finds Ramadan as an upcoming occasion with correct countdown', () => {
    const from = new Date(2023, 2, 20); // 3 days before 1 Ramadan 1444
    const occasions = upcomingOccasions(from, 6);
    const ramadan = occasions.find((o) => o.key === 'ramadan');
    expect(ramadan).toBeDefined();
    expect(ramadan!.inDays).toBe(3);
    // Sorted by proximity, all within the horizon.
    for (let i = 1; i < occasions.length; i++) {
      expect(occasions[i]!.inDays).toBeGreaterThanOrEqual(occasions[i - 1]!.inDays);
    }
  });

  it('reports an occasion happening today as 0 days away', () => {
    const occasions = upcomingOccasions(new Date(2023, 2, 23), 6);
    expect(occasions.find((o) => o.key === 'ramadan')?.inDays).toBe(0);
  });
});
