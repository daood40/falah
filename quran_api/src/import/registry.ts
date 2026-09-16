/**
 * Source registry. Every fact here is copied from the package metadata /
 * README of the dataset itself — nothing is inferred. Adding a source means
 * documenting its licence here AND in docs/SOURCE_POLICY.md first.
 */
export type SourceDefinition = {
  id: string;
  name: string;
  organization: string | null;
  url: string | null;
  api_url: string | null;
  description: string | null;
  language: string | null;
  license: string | null;
  license_url: string | null;
  attribution_required: boolean;
  attribution_text: string | null;
  version: string;
  status: 'pending' | 'approved' | 'restricted' | 'blocked';
};

export const QURAN_JSON_VERSION = '3.1.2';
export const QURAN_META_VERSION = '6.0.17';

export const SOURCES: SourceDefinition[] = [
  {
    id: 'quran-json',
    name: 'quran-json (Uthmani text + translations)',
    organization: 'Risan Bagja Pradana',
    url: 'https://github.com/risan/quran-json',
    api_url: 'https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist/',
    description:
      'Uthmani Quran text from The Noble Qur\'an Encyclopedia (quranenc.com); translations sourced from tanzil.net and quranenc.com. LICENCE UNRESOLVED: package.json declares CC-BY-4.0 while LICENSE.txt and README declare CC-BY-SA-4.0, and neither states that the upstream rights holders (quranenc.com, tanzil.net, the individual translators) granted redistribution. See reports/LICENSE_AUDIT.txt.',
    language: 'ar',
    license: 'CC-BY-SA-4.0 (LICENSE.txt) / CC-BY-4.0 (package.json) — unresolved',
    license_url: 'https://github.com/risan/quran-json/blob/master/LICENSE.txt',
    attribution_required: true,
    attribution_text:
      'Quran text & translations: quran-json (CC BY-SA 4.0) — Risan Bagja Pradana; text from quranenc.com, translations from tanzil.net.',
    version: QURAN_JSON_VERSION,
    // Usable internally; NOT cleared for public redistribution until the owner
    // resolves the licence conflict recorded in reports/LICENSE_AUDIT.txt.
    status: 'restricted',
  },
  {
    id: 'quran-meta',
    name: 'quran-meta (Hafs mushaf structure)',
    organization: 'quran-center',
    url: 'https://github.com/quran-center/quran-meta',
    api_url: null,
    description:
      'Juz / hizb quarter / page / manzil / ruku / sajdah boundaries and surah metadata for the Hafs (Madani) mushaf.',
    language: 'ar',
    license: 'MIT',
    license_url: 'https://github.com/quran-center/quran-meta/blob/master/LICENSE',
    attribution_required: true,
    attribution_text: 'Mushaf structure metadata: quran-meta (MIT) — quran-center.',
    version: QURAN_META_VERSION,
    status: 'approved',
  },
];

/** Qiraah/riwayah are declared by quran-meta itself (its Hafs dataset). */
export const QIRAAT = [
  {
    slug: 'asim',
    name_ar: 'قراءة عاصم بن أبي النجود',
    name_en: 'Asim ibn Abi al-Najud',
    source_id: 'quran-meta',
  },
];

export const RIWAYAT = [
  {
    slug: 'hafs',
    qiraah_slug: 'asim',
    name_ar: 'رواية حفص عن عاصم',
    name_en: 'Hafs an Asim',
    source_id: 'quran-meta',
  },
];

export const QURAN_EDITION = {
  slug: 'quran-json-uthmani-hafs',
  name: 'المصحف — رسم عثماني (حفص عن عاصم)',
  edition_type: 'quran' as const,
  riwayah: 'hafs',
  qiraah: 'asim',
  script_type: 'uthmani',
  font_name: null,
  publisher: null,
  country: null,
  language: 'ar',
  source_id: 'quran-json',
};

/** Translation files shipped by quran-json, with their attributions. */
export const TRANSLATIONS = [
  { file: 'quran_en.json', slug: 'en-saheeh', language: 'en', translator: 'Umm Muhammad (Saheeh International)', title: 'Saheeh International' },
  { file: 'quran_fr.json', slug: 'fr-hamidullah', language: 'fr', translator: 'Muhammad Hamidullah', title: 'Hamidullah' },
  { file: 'quran_tr.json', slug: 'tr-diyanet', language: 'tr', translator: 'Turkish Directorate of Religious Affairs', title: 'Diyanet İşleri' },
  { file: 'quran_ur.json', slug: 'ur-maududi', language: 'ur', translator: "Abul A'la Maududi", title: 'Maududi' },
  { file: 'quran_id.json', slug: 'id-affairs', language: 'id', translator: 'Indonesian Islamic Affairs Ministry', title: 'Kementerian Agama' },
  { file: 'quran_es.json', slug: 'es-garcia', language: 'es', translator: 'Muhammad Isa García', title: 'García' },
  { file: 'quran_ru.json', slug: 'ru-kuliev', language: 'ru', translator: 'Elmir Kuliev', title: 'Kuliev' },
  { file: 'quran_sv.json', slug: 'sv-bernstrom', language: 'sv', translator: 'Knut Bernström', title: 'Bernström' },
  { file: 'quran_bn.json', slug: 'bn-khan', language: 'bn', translator: 'Muhiuddin Khan', title: 'Muhiuddin Khan' },
  { file: 'quran_zh.json', slug: 'zh-makin', language: 'zh', translator: 'Muhammad Makin', title: 'Ma Jian (Makin)' },
] as const;
