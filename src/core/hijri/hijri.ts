/**
 * Hijri date + Islamic occasions, computed entirely on-device via the
 * Intl Umm al-Qura calendar (no network, no third-party API, no location
 * data — a deliberate contrast with market-leading apps' data practices).
 */

const HIJRI_FMT = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
});

const HIJRI_DISPLAY = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export interface HijriDate {
  day: number;
  month: number;
  year: number;
}

export function hijriOf(date: Date): HijriDate {
  const parts = HIJRI_FMT.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { day: get('day'), month: get('month'), year: get('year') };
}

/** Human-readable hijri date, e.g. "١٢ ربيع الأول ١٤٤٨ هـ" (era comes from the locale). */
export function hijriToday(date = new Date()): string {
  return HIJRI_DISPLAY.format(date);
}

export interface Occasion {
  /** i18n key under occasions.* */
  key: 'ramadan' | 'eidFitr' | 'arafah' | 'eidAdha' | 'ashura' | 'hijriNewYear';
  month: number;
  day: number;
  /** Days from today (0 = today). */
  inDays: number;
  date: Date;
}

const OCCASIONS: { key: Occasion['key']; month: number; day: number }[] = [
  { key: 'hijriNewYear', month: 1, day: 1 },
  { key: 'ashura', month: 1, day: 10 },
  { key: 'ramadan', month: 9, day: 1 },
  { key: 'eidFitr', month: 10, day: 1 },
  { key: 'arafah', month: 12, day: 9 },
  { key: 'eidAdha', month: 12, day: 10 },
];

/**
 * Scan the next `horizon` days and return upcoming occasions sorted by
 * proximity. Pure calendar math on-device; at most ~400 Intl calls, cached
 * by the caller per day.
 */
export function upcomingOccasions(from = new Date(), limit = 2, horizon = 400): Occasion[] {
  const found: Occasion[] = [];
  for (let i = 0; i <= horizon && found.length < OCCASIONS.length; i++) {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const h = hijriOf(date);
    for (const occ of OCCASIONS) {
      if (h.month === occ.month && h.day === occ.day && !found.some((f) => f.key === occ.key)) {
        found.push({ ...occ, inDays: i, date });
      }
    }
  }
  return found.sort((a, b) => a.inDays - b.inDays).slice(0, limit);
}
