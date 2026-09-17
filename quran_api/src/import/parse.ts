import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import * as hafs from 'quran-meta/hafs';
import { collapseWhitespace, contentHash, fileHash } from '../core/hash.ts';
import { normalizeForSearch, searchSkeleton } from '../core/arabic.ts';
import { QURAN_JSON_VERSION, QURAN_META_VERSION, TRANSLATIONS } from './registry.ts';

const require = createRequire(import.meta.url);

export type ParsedSurah = {
  surah_number: number;
  name_ar: string;
  name_transliteration: string;
  name_en: string;
  revelation_place: 'makkah' | 'madinah';
  revelation_order: number;
  ayah_count: number;
  /** The source datasets carry no bismillah text field → NULL, never invented. */
  bismillah: null;
};

export type ParsedAyah = {
  surah_number: number;
  ayah_number: number;
  global_ayah_number: number;
  juz_number: number;
  hizb_number: number;
  rub_number: number;
  page_number: number;
  manzil_number: number;
  ruku_number: number;
  sajdah: boolean;
  /** quran-meta records the position only, not the ruling → NULL. */
  sajdah_type: null;
  raw_text: string;
  text_uthmani: string;
  text_simple: null;
  search_text: string;
  search_skeleton: string;
  content_hash: string;
};

export type ParsedTranslation = {
  slug: string;
  language: string;
  translator: string;
  title: string;
  file_hash: string;
  entries: { surah_number: number; ayah_number: number; text: string; content_hash: string }[];
};

export type ParsedDataset = {
  quran_json_version: string;
  quran_meta_version: string;
  source_file_hash: string;
  surahs: ParsedSurah[];
  ayahs: ParsedAyah[];
  juzs: Division[];
  rubs: (Division & { rub_number: number; hizb_number: number; quarter: number; juz_number: number })[];
  pages: Division[];
  manzils: Division[];
  /** The 556 rukuʿ boundaries; each also carries the surah it belongs to. */
  rukus: (Division & { surah_number: number })[];
  translations: ParsedTranslation[];
};

export type Division = {
  number: number;
  start_global_ayah: number;
  end_global_ayah: number;
  start_surah: number;
  start_ayah: number;
  end_surah: number;
  end_ayah: number;
};

type RawChapter = {
  id: number;
  name: string;
  transliteration: string;
  translation: string;
  type: string;
  total_verses: number;
  verses: { id: number; text: string; translation?: string }[];
};

const datasetPath = (file: string): string =>
  require.resolve(`quran-json/dist/${file}`);

const readJson = <T>(file: string): { data: T; hash: string } => {
  const buffer = readFileSync(datasetPath(file));
  return { data: JSON.parse(buffer.toString('utf8')) as T, hash: fileHash(buffer) };
};

/** ayahId → [surah, ayah] using the quran-meta Hafs surah table. */
function buildAyahIndex(): { surah: number; ayah: number }[] {
  const index: { surah: number; ayah: number }[] = [];
  index.length = 0;
  for (let surah = 1; surah <= 114; surah += 1) {
    const entry = hafs.SurahList[surah] as unknown as [number, number, number, number, string, boolean];
    const [startAyahId, ayahCount] = entry;
    for (let ayah = 1; ayah <= ayahCount; ayah += 1) {
      index[startAyahId + ayah - 1] = { surah, ayah };
    }
  }
  return index;
}

function divisions(list: readonly number[], count: number, index: { surah: number; ayah: number }[]): Division[] {
  const out: Division[] = [];
  for (let number = 1; number <= count; number += 1) {
    const start = list[number] as number;
    const end = (list[number + 1] as number) - 1;
    const startPos = index[start]!;
    const endPos = index[end]!;
    out.push({
      number,
      start_global_ayah: start,
      end_global_ayah: end,
      start_surah: startPos.surah,
      start_ayah: startPos.ayah,
      end_surah: endPos.surah,
      end_ayah: endPos.ayah,
    });
  }
  return out;
}

export function parseDataset(languages: string[]): ParsedDataset {
  const { data: chapters, hash: sourceFileHash } = readJson<RawChapter[]>('quran.json');
  const { data: englishChapters } = readJson<RawChapter[]>('quran_en.json');
  const index = buildAyahIndex();
  const sajdaSet = new Set<number>(hafs.SajdaList as unknown as number[]);

  const surahs: ParsedSurah[] = chapters.map((chapter) => {
    const meta = hafs.SurahList[chapter.id] as unknown as [number, number, number, number, string, boolean];
    return {
      surah_number: chapter.id,
      name_ar: chapter.name,
      name_transliteration: chapter.transliteration,
      name_en: englishChapters.find((c) => c.id === chapter.id)?.translation ?? chapter.translation,
      revelation_place: meta[5] ? 'makkah' : 'madinah',
      revelation_order: meta[2],
      ayah_count: chapter.total_verses,
      bismillah: null,
    };
  });

  const ayahs: ParsedAyah[] = [];
  for (const chapter of chapters) {
    const meta = hafs.SurahList[chapter.id] as unknown as [number, number, number, number, string, boolean];
    const startAyahId = meta[0];
    for (const verse of chapter.verses) {
      const globalAyahNumber = startAyahId + verse.id - 1;
      const ayahMeta = hafs.getAyahMeta(globalAyahNumber as never) as {
        juz: number;
        hizbId: number;
        rubAlHizbId: number;
        page: number;
        ruku: number;
      };
      const manzil = hafs.findManzilByAyahId(globalAyahNumber as never) as unknown as number;
      const rawText = verse.text;
      ayahs.push({
        surah_number: chapter.id,
        ayah_number: verse.id,
        global_ayah_number: globalAyahNumber,
        juz_number: ayahMeta.juz,
        hizb_number: ayahMeta.hizbId,
        rub_number: ayahMeta.rubAlHizbId,
        page_number: ayahMeta.page,
        manzil_number: Array.isArray(manzil) ? (manzil[0] as number) : manzil,
        ruku_number: ayahMeta.ruku,
        sajdah: sajdaSet.has(globalAyahNumber),
        sajdah_type: null,
        raw_text: rawText,
        text_uthmani: rawText,
        text_simple: null,
        search_text: normalizeForSearch(rawText),
        search_skeleton: searchSkeleton(rawText),
        content_hash: contentHash(rawText),
      });
    }
  }

  const translations: ParsedTranslation[] = [];
  for (const definition of TRANSLATIONS) {
    if (!languages.includes(definition.language)) continue;
    const { data, hash } = readJson<RawChapter[]>(definition.file);
    const entries: ParsedTranslation['entries'] = [];
    for (const chapter of data) {
      for (const verse of chapter.verses) {
        const text = verse.translation ?? '';
        if (text.length === 0) continue;
        entries.push({
          surah_number: chapter.id,
          ayah_number: verse.id,
          text,
          content_hash: contentHash(text),
        });
      }
    }
    translations.push({
      slug: definition.slug,
      language: definition.language,
      translator: definition.translator,
      title: definition.title,
      file_hash: hash,
      entries,
    });
  }

  return {
    quran_json_version: QURAN_JSON_VERSION,
    quran_meta_version: QURAN_META_VERSION,
    source_file_hash: sourceFileHash,
    surahs,
    ayahs,
    translations,
    juzs: divisions(hafs.JuzList as unknown as number[], (hafs.JuzList as unknown as number[]).length - 2, index),
    rubs: divisions(
      hafs.HizbQuarterList as unknown as number[],
      (hafs.HizbQuarterList as unknown as number[]).length - 2,
      index,
    ).map((division) => ({
      ...division,
      rub_number: division.number,
      hizb_number: Math.ceil(division.number / 4),
      quarter: ((division.number - 1) % 4) + 1,
      juz_number: Math.ceil(division.number / 8),
    })),
    pages: divisions(
      hafs.PageList as unknown as number[],
      (hafs.PageList as unknown as number[]).length - 2,
      index,
    ),
    manzils: divisions(
      hafs.ManzilList as unknown as number[],
      (hafs.ManzilList as unknown as number[]).length - 2,
      index,
    ),
    // A ruku never crosses a surah, so its surah is the surah of its first ayah.
    rukus: divisions(
      hafs.RukuList as unknown as number[],
      (hafs.RukuList as unknown as number[]).length - 2,
      index,
    ).map((division) => ({ ...division, surah_number: division.start_surah })),
  };
}

export { collapseWhitespace };
