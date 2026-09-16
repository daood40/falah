/**
 * License Center seeding.
 *
 * Every dataset the project touches gets a row describing its licence state.
 * The seed records only what we can actually evidence today — which is almost
 * always `PENDING` or `RESTRICTED`. `CONFIRMED` requires evidence and is never
 * written by an automated run except where the evidence is a licence file we
 * literally read from disk (quran-meta's MIT file).
 */
import type pg from 'pg';
import { TRANSLATIONS } from './registry.ts';

export type SqlClient = Pick<pg.PoolClient, 'query'>;

type LicenseSeed = {
  dataset_kind: string;
  subject: string;
  source_id: string | null;
  owner: string | null;
  copyright_holder: string | null;
  license: string | null;
  license_url: string | null;
  redistribution: 'unknown' | 'allowed' | 'denied';
  commercial_use: 'unknown' | 'allowed' | 'denied';
  modification: 'unknown' | 'allowed' | 'denied' | 'forbidden_by_policy';
  attribution_required: boolean;
  attribution_text: string | null;
  evidence: string | null;
  status: 'UNKNOWN' | 'PENDING' | 'RESTRICTED' | 'CONFIRMED' | 'REJECTED';
  notes: string | null;
};

const QURAN_JSON_EVIDENCE =
  'node_modules/quran-json/package.json:13 says CC-BY-4.0; LICENSE.txt:1 and README.md:124 say CC-BY-SA-4.0; ' +
  'no grant from the upstream text holder (quranenc.com) is included.';

export function licenseSeeds(): LicenseSeed[] {
  const seeds: LicenseSeed[] = [
    {
      dataset_kind: 'software',
      subject: 'quran-json@3.1.2',
      source_id: 'quran-json',
      owner: 'Risan Bagja Pradana',
      copyright_holder: 'Risan Bagja Pradana',
      license: 'conflicting: CC-BY-4.0 (package.json) vs CC-BY-SA-4.0 (LICENSE.txt)',
      license_url: 'https://github.com/risan/quran-json/blob/master/LICENSE.txt',
      redistribution: 'unknown',
      commercial_use: 'unknown',
      modification: 'forbidden_by_policy',
      attribution_required: true,
      attribution_text:
        'Quran text & translations: quran-json (Risan Bagja Pradana); text from quranenc.com, translations from tanzil.net.',
      evidence: QURAN_JSON_EVIDENCE,
      status: 'PENDING',
      notes: 'Covers the packaging only; it cannot license the scripture or the translations.',
    },
    {
      dataset_kind: 'quran_text',
      subject: 'uthmani-hafs (quran-json dist/quran.json)',
      source_id: 'quran-json',
      owner: "The Noble Qur'an Encyclopedia (quranenc.com) — per the package README",
      copyright_holder: 'UNKNOWN — no grant shipped with the package',
      license: 'UNKNOWN for the text itself',
      license_url: null,
      redistribution: 'unknown',
      commercial_use: 'unknown',
      modification: 'forbidden_by_policy',
      attribution_required: true,
      attribution_text: 'Quran text via quran-json, sourced from quranenc.com.',
      evidence: QURAN_JSON_EVIDENCE,
      status: 'RESTRICTED',
      notes: 'Held privately for development only. No public redistribution.',
    },
    {
      dataset_kind: 'software',
      subject: 'quran-meta@6.0.17',
      source_id: 'quran-meta',
      owner: 'Quran-Center',
      copyright_holder: 'Copyright (c) 2020 Quran-Center',
      license: 'MIT',
      license_url: 'https://github.com/quran-center/quran-meta/blob/master/LICENSE',
      redistribution: 'allowed',
      commercial_use: 'allowed',
      modification: 'allowed',
      attribution_required: true,
      attribution_text: 'Mushaf structure metadata: quran-meta (MIT) — quran-center.',
      evidence:
        'node_modules/quran-meta/LICENSE:1 "MIT License" and package.json "license":"MIT" — consistent, read from disk.',
      status: 'CONFIRMED',
      notes: 'Software + numeric metadata only; covers no Quran text.',
    },
    {
      dataset_kind: 'metadata',
      subject: 'hafs-mushaf-structure (juz/hizb/page/manzil/ruku/sajdah)',
      source_id: 'quran-meta',
      owner: 'Quran-Center',
      copyright_holder: 'Copyright (c) 2020 Quran-Center',
      license: 'MIT',
      license_url: 'https://github.com/quran-center/quran-meta/blob/master/LICENSE',
      redistribution: 'allowed',
      commercial_use: 'allowed',
      modification: 'forbidden_by_policy',
      attribution_required: true,
      attribution_text: 'Mushaf structure metadata: quran-meta (MIT) — quran-center.',
      evidence: 'node_modules/quran-meta/LICENSE:1 (MIT), read from disk.',
      status: 'CONFIRMED',
      notes: 'Boundaries and counts only.',
    },
    {
      dataset_kind: 'qiraat',
      subject: 'asim',
      source_id: 'quran-meta',
      owner: 'Quran-Center (dataset)',
      copyright_holder: 'Copyright (c) 2020 Quran-Center',
      license: 'MIT (dataset)',
      license_url: 'https://github.com/quran-center/quran-meta/blob/master/LICENSE',
      redistribution: 'allowed',
      commercial_use: 'allowed',
      modification: 'forbidden_by_policy',
      attribution_required: true,
      attribution_text: 'Qiraah metadata: quran-meta (MIT).',
      evidence: 'Name and Hafs riwaya recorded by quran-meta; LICENSE read from disk.',
      status: 'CONFIRMED',
      notes: 'Only the name/metadata is licensed here, not any recitation audio.',
    },
    {
      dataset_kind: 'riwayat',
      subject: 'hafs',
      source_id: 'quran-meta',
      owner: 'Quran-Center (dataset)',
      copyright_holder: 'Copyright (c) 2020 Quran-Center',
      license: 'MIT (dataset)',
      license_url: 'https://github.com/quran-center/quran-meta/blob/master/LICENSE',
      redistribution: 'allowed',
      commercial_use: 'allowed',
      modification: 'forbidden_by_policy',
      attribution_required: true,
      attribution_text: 'Riwayah metadata: quran-meta (MIT).',
      evidence: 'quran-meta hafs dataset; LICENSE read from disk.',
      status: 'CONFIRMED',
      notes: 'Metadata only.',
    },
    {
      dataset_kind: 'audio',
      subject: '(none supplied)',
      source_id: null,
      owner: null,
      copyright_holder: null,
      license: null,
      license_url: null,
      redistribution: 'unknown',
      commercial_use: 'unknown',
      modification: 'forbidden_by_policy',
      attribution_required: true,
      attribution_text: null,
      evidence: null,
      status: 'UNKNOWN',
      notes: 'No audio dataset has been supplied. Nothing imported, nothing invented.',
    },
    {
      dataset_kind: 'reciter',
      subject: '(none supplied)',
      source_id: null,
      owner: null,
      copyright_holder: null,
      license: null,
      license_url: null,
      redistribution: 'unknown',
      commercial_use: 'unknown',
      modification: 'forbidden_by_policy',
      attribution_required: true,
      attribution_text: null,
      evidence: null,
      status: 'UNKNOWN',
      notes: 'No reciter dataset has been supplied.',
    },
    {
      dataset_kind: 'tafsir',
      subject: '(none supplied)',
      source_id: null,
      owner: null,
      copyright_holder: null,
      license: null,
      license_url: null,
      redistribution: 'unknown',
      commercial_use: 'unknown',
      modification: 'forbidden_by_policy',
      attribution_required: true,
      attribution_text: null,
      evidence: null,
      status: 'UNKNOWN',
      notes: 'Architecture ready (tafsir_sources, ayah_tafsirs); no data imported.',
    },
    {
      dataset_kind: 'word_by_word',
      subject: '(none supplied)',
      source_id: null,
      owner: null,
      copyright_holder: null,
      license: null,
      license_url: null,
      redistribution: 'unknown',
      commercial_use: 'unknown',
      modification: 'forbidden_by_policy',
      attribution_required: true,
      attribution_text: null,
      evidence: null,
      status: 'UNKNOWN',
      notes: 'Table quran.ayah_words exists and is empty.',
    },
    {
      dataset_kind: 'morphology',
      subject: '(none supplied)',
      source_id: null,
      owner: null,
      copyright_holder: null,
      license: null,
      license_url: null,
      redistribution: 'unknown',
      commercial_use: 'unknown',
      modification: 'forbidden_by_policy',
      attribution_required: true,
      attribution_text: null,
      evidence: null,
      status: 'UNKNOWN',
      notes: 'Morphology column exists on quran.ayah_words; no data.',
    },
    {
      dataset_kind: 'tajweed',
      subject: '(none supplied)',
      source_id: null,
      owner: null,
      copyright_holder: null,
      license: null,
      license_url: null,
      redistribution: 'unknown',
      commercial_use: 'unknown',
      modification: 'forbidden_by_policy',
      attribution_required: true,
      attribution_text: null,
      evidence: null,
      status: 'UNKNOWN',
      notes: 'No tajweed dataset; no schema assumption made yet.',
    },
  ];

  for (const translation of TRANSLATIONS) {
    seeds.push({
      dataset_kind: 'translation',
      subject: translation.slug,
      source_id: 'quran-json',
      owner: translation.translator,
      copyright_holder: translation.translator,
      license: 'claimed under the quran-json package licence (conflicting) — no translator grant',
      license_url: 'https://github.com/risan/quran-json/blob/master/LICENSE.txt',
      redistribution: 'unknown',
      commercial_use: 'unknown',
      modification: 'forbidden_by_policy',
      attribution_required: true,
      attribution_text: `${translation.title} — ${translation.translator}`,
      evidence: 'node_modules/quran-json/README.md §Data Source names the translator and origin.',
      status: 'PENDING',
      notes: 'LICENSE_PENDING — imported privately, never served publicly.',
    });
  }

  return seeds;
}

export async function seedLicenseCenter(client: SqlClient): Promise<number> {
  const seeds = licenseSeeds();
  for (const seed of seeds) {
    await client.query(
      `insert into quran.license_records (dataset_kind, subject, source_id, owner,
         copyright_holder, license, license_url, redistribution, commercial_use,
         modification, attribution_required, attribution_text, evidence, status,
         recorded_by, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'import-pipeline',$15)
       on conflict (dataset_kind, subject) do update set
         source_id = excluded.source_id,
         owner = excluded.owner,
         copyright_holder = excluded.copyright_holder,
         license = excluded.license,
         license_url = excluded.license_url,
         attribution_text = excluded.attribution_text,
         notes = excluded.notes,
         -- an owner-recorded status is never downgraded by a re-import
         status = case
           when quran.license_records.recorded_by = 'import-pipeline' then excluded.status
           else quran.license_records.status
         end,
         updated_at = now()`,
      [
        seed.dataset_kind, seed.subject, seed.source_id, seed.owner, seed.copyright_holder,
        seed.license, seed.license_url, seed.redistribution, seed.commercial_use,
        seed.modification, seed.attribution_required, seed.attribution_text, seed.evidence,
        seed.status, seed.notes,
      ],
    );
  }
  return seeds.length;
}
