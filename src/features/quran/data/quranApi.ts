/**
 * Live Quran API client (alquran.cloud) — optional enrichment layer.
 * Adds juz/page/hizb, tafsir (Al-Muyassar) and extra translation editions on top
 * of the bundled Tanzil dataset. Fails gracefully offline: the app never depends on it.
 */
import { db } from '@core/db/localdb';
import { env } from '@core/config/env';
import { toAppError } from '@core/errors/errors';
import type { CachedAyah } from '../domain/types';

interface ApiAyahEdition {
  number: number;
  text: string;
  numberInSurah: number;
  juz?: number;
  page?: number;
  hizbQuarter?: number;
  edition: { identifier: string };
}

interface ApiResponse<T> {
  code: number;
  status: string;
  data: T;
}

const TAFSIR_EDITION = 'ar.muyassar';

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${env.quranApiBase}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw toAppError(new Error(`Quran API ${response.status} for ${path}`), 'network');
  }
  const body = (await response.json()) as ApiResponse<T>;
  if (body.code !== 200) {
    throw toAppError(new Error(`Quran API error: ${body.status}`), 'network');
  }
  return body.data;
}

/**
 * Enrich a cached ayah with juz/page/hizb + tafsir from the live API.
 * Returns the enriched ayah (persisted), or the original when offline.
 */
export async function enrichAyah(ayah: CachedAyah): Promise<CachedAyah> {
  if (ayah.juz !== null && ayah.tafsir !== null) return ayah;
  try {
    const editions = await apiGet<ApiAyahEdition[]>(
      `/ayah/${ayah.surah}:${ayah.ayah}/editions/quran-uthmani,${TAFSIR_EDITION}`,
    );
    const meta = editions.find((e) => e.edition.identifier === 'quran-uthmani');
    const tafsir = editions.find((e) => e.edition.identifier === TAFSIR_EDITION);
    const enriched: CachedAyah = {
      ...ayah,
      juz: meta?.juz ?? ayah.juz,
      page: meta?.page ?? ayah.page,
      hizb: meta?.hizbQuarter != null ? Math.ceil(meta.hizbQuarter / 8) : ayah.hizb,
      tafsir: tafsir?.text ?? ayah.tafsir,
    };
    await db.quranAyahs.put(enriched);
    return enriched;
  } catch {
    // Offline or blocked network — bundled data remains authoritative.
    return ayah;
  }
}
