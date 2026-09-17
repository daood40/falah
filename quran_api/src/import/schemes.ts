/**
 * Declares which conventions the stored data follows.
 *
 * The importer does not decide these — it records what the imported dataset
 * actually contains (counted from the data), names the source of that
 * convention, and lists the alternatives found in independent references so the
 * owner can choose. Until the owner decides, `decision_status = PENDING`.
 */
import type pg from 'pg';

export type SqlClient = Pick<pg.PoolClient, 'query'>;

export async function recordDataSchemes(
  client: SqlClient,
  options: { editionId: string; datasetVersion: string },
): Promise<void> {
  // --- observed sajdah positions, counted from the imported data ---
  const { rows: sajdah } = await client.query<{ key: string }>(
    `select s.surah_number || ':' || a.ayah_number as key
     from quran.ayahs a join quran.surahs s on s.id = a.surah_id
     where a.edition_id = $1 and a.sajdah
     order by a.global_ayah_number`,
    [options.editionId],
  );
  const positions = sajdah.map((row) => row.key);

  await upsert(client, {
    scheme_kind: 'sajdah',
    scheme_code: 'tanzil-hafs-15',
    scheme_version: '1',
    edition_id: options.editionId,
    dataset_version: options.datasetVersion,
    source_id: 'quran-meta',
    description:
      'Sajdah positions as recorded by quran-meta (Hafs/Tanzil): 15 positions, ' +
      'marking the ayah at whose end the prostration falls and including the ' +
      'second sajdah of Al-Hajj (22:77).',
    observed_summary: { count: positions.length, positions },
    alternatives: [
      {
        scheme_code: 'fourteen-position',
        count: 14,
        differs_at: ['16:49 vs 16:50', '17:107 vs 17:109', '27:25 vs 27:26', '41:37 vs 41:38'],
        omits: ['22:77'],
        seen_in: 'quran-db@1.2.4',
        note: 'Marks the earlier ayah and does not count the second sajdah of Al-Hajj.',
      },
    ],
    notes:
      'sajdah_type stays NULL: no source we hold states the ruling (obligatory / recommended).',
  });

  // --- observed page layout ---
  const { rows: pageRows } = await client.query<{ pages: string; first: number; last: number }>(
    `select count(distinct page_number)::text as pages,
            min(page_number) as first, max(page_number) as last
     from quran.ayahs where edition_id = $1`,
    [options.editionId],
  );
  await upsert(client, {
    scheme_kind: 'page',
    scheme_code: 'madani-604-tanzil',
    scheme_version: '1',
    edition_id: options.editionId,
    dataset_version: options.datasetVersion,
    source_id: 'quran-meta',
    description:
      'Madani mushaf page list as recorded by quran-meta (Tanzil lineage): 604 pages. ' +
      'Page boundaries agree with an independent reference (quran-db) 604/604.',
    observed_summary: {
      pages: Number(pageRows[0]?.pages ?? 0),
      first_page: pageRows[0]?.first ?? null,
      last_page: pageRows[0]?.last ?? null,
    },
    alternatives: [
      {
        scheme_code: 'kfc-qcf-v4',
        pages: 604,
        differs_for_ayahs: 56,
        seen_in: 'quran-qcf4@1.1.0 (King Fahd Complex QCF v4 typesetting)',
        note: 'Places 56 ayahs that straddle a page break on the adjacent page.',
      },
    ],
    notes:
      'Page numbering is a property of a printed edition; the app must state which mushaf it follows.',
  });
}

async function upsert(
  client: SqlClient,
  scheme: {
    scheme_kind: string;
    scheme_code: string;
    scheme_version: string;
    edition_id: string;
    dataset_version: string;
    source_id: string;
    description: string;
    observed_summary: unknown;
    alternatives: unknown;
    notes: string;
  },
): Promise<void> {
  await client.query(
    `insert into quran.data_schemes (scheme_kind, scheme_code, scheme_version, edition_id,
       dataset_version, source_id, description, observed_summary, alternatives, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)
     on conflict (scheme_kind, edition_id, scheme_version) do update set
       scheme_code = excluded.scheme_code,
       dataset_version = excluded.dataset_version,
       description = excluded.description,
       observed_summary = excluded.observed_summary,
       alternatives = excluded.alternatives,
       notes = excluded.notes,
       updated_at = now()`,
    [
      scheme.scheme_kind, scheme.scheme_code, scheme.scheme_version, scheme.edition_id,
      scheme.dataset_version, scheme.source_id, scheme.description,
      JSON.stringify(scheme.observed_summary), JSON.stringify(scheme.alternatives), scheme.notes,
    ],
  );
}
