/**
 * The per-hadith sub-resources (§7–§11): narrators, references, takhrij,
 * gradings, verification. Each is both its own endpoint and an `?include=`
 * on the detail response, so Falah pays for them only when it wants them.
 */
import { get } from '../http/router.ts';
import { ok } from '../http/respond.ts';
import { query, queryOne } from '../db.ts';
import { notFound } from '../http/errors.ts';
import { uuidParam } from '../http/validate.ts';
import { serializeTakhrij, textVisible, type HadithRow } from '../domain/serialize.ts';
import { HADITH_FROM, HADITH_SELECT, isAdminRequest } from './shared.ts';

export const INCLUDABLE = ['narrators', 'references', 'takhrij', 'gradings', 'verification'] as const;
export type IncludeName = (typeof INCLUDABLE)[number];

interface TakhrijSourceRow {
  source_name: string;
  reference: string | null;
  reference_number: string | null;
}

// ---------------- narrators (§7) ----------------
export async function narratorsOf(hadithId: string): Promise<Record<string, unknown>[]> {
  return query(
    `select n.id, n.name, n.kunya, n.laqab, n.normalized_name, n.source_reference,
            hn.position, hn.role
     from corpus.narrators n
     left join corpus.hadith_narrators hn on hn.narrator_id = n.id and hn.hadith_id = $1
     where n.id = (select narrator_id from corpus.hadiths where id = $1)
        or hn.hadith_id = $1
     order by hn.position nulls first, n.name`,
    [hadithId],
  );
}

// ---------------- references (§8) ----------------
export async function referencesOf(hadithId: string, isAdmin: boolean): Promise<Record<string, unknown>[]> {
  const visible = textVisible(isAdmin);
  const rows = await query<{
    source_name: string | null;
    reference: string | null;
    reference_number: string | null;
    book: string | null;
    edition: string | null;
    volume: number | null;
    page: number | null;
    locator: string | null;
    original_reference: string | null;
  }>(
    `select hs.source_name, hs.reference, hs.reference_number,
            b.name as book, e.title as edition,
            h.volume_number as volume, h.page_number as page,
            h.source_locator as locator, h.original_reference
     from corpus.hadiths h
     join corpus.editions e on e.id = h.edition_id
     left join corpus.books b on b.id = h.book_id
     left join corpus.hadith_sources hs on hs.hadith_id = h.id
     where h.id = $1
     order by hs.source_name`,
    [hadithId],
  );
  return rows
    .filter((r) => r.source_name !== null || r.original_reference !== null)
    .map((r) => ({
      source: r.source_name,
      book: r.book,
      edition: r.edition,
      volume: r.volume,
      page: r.page,
      locator: r.locator,
      reference_number: r.reference_number,
      // the reference text is part of the author's takhrij line, so it obeys
      // the same licence gate as the hadith text
      reference_text: visible ? (r.reference ?? r.original_reference) : null,
    }));
}

// ---------------- gradings (§10) ----------------
export async function gradingsOf(hadithId: string): Promise<Record<string, unknown>[]> {
  return query(
    `select g.grading as grading_text, g.grader as source, g.source_reference as reference,
            g.notes, h.dataset_version
     from corpus.hadith_gradings g
     join corpus.hadiths h on h.id = g.hadith_id
     where g.hadith_id = $1
     order by g.created_at`,
    [hadithId],
  );
}

// ---------------- verification (§11) ----------------
export async function verificationOf(hadithId: string): Promise<Record<string, unknown>> {
  const row = await queryOne<{
    source_match: boolean;
    cross_check: string;
    cross_check_similarity: string | null;
    cross_check_collection: string | null;
    human_review: boolean;
    verified: boolean;
    verification_status: string;
    content_hash: string;
    dataset_version: string;
  }>('select * from corpus.verification_state where hadith_id = $1', [hadithId]);
  if (!row) throw notFound('Hadith');
  return {
    source_match: row.source_match,
    cross_check: row.cross_check,
    cross_check_detail: {
      similarity: row.cross_check_similarity === null ? null : Number(row.cross_check_similarity),
      collection: row.cross_check_collection,
    },
    human_review: row.human_review,
    // never true on its own: only a recorded human check can set it
    verified: row.verified,
    status: row.verification_status,
    content_hash: row.content_hash,
    dataset_version: row.dataset_version,
  };
}

async function takhrijOf(row: HadithRow, isAdmin: boolean): Promise<Record<string, unknown>> {
  const sources = await query<TakhrijSourceRow>(
    `select source_name, reference, reference_number from corpus.hadith_sources
     where hadith_id = $1 order by source_name`,
    [row.id],
  );
  return serializeTakhrij(row, sources, isAdmin);
}

/** Builds the `?include=` block for the detail response. */
export async function hadithIncludes(
  row: HadithRow,
  names: IncludeName[],
  isAdmin: boolean,
): Promise<Record<string, unknown>> {
  if (names.length === 0) return {};
  const out: Record<string, unknown> = {};
  for (const name of names) {
    if (name === 'narrators') out['narrators'] = await narratorsOf(row.id);
    else if (name === 'references') out['references'] = await referencesOf(row.id, isAdmin);
    else if (name === 'gradings') out['gradings'] = await gradingsOf(row.id);
    else if (name === 'takhrij') out['takhrij'] = await takhrijOf(row, isAdmin);
    else if (name === 'verification') out['verification'] = await verificationOf(row.id);
  }
  return out;
}

// ---------------- the standalone endpoints ----------------
async function requireHadith(id: string): Promise<HadithRow> {
  const row = await queryOne<HadithRow>(`select ${HADITH_SELECT} ${HADITH_FROM} where h.id = $1`, [id]);
  if (!row) throw notFound('Hadith');
  return row;
}

get('/api/v1/hadiths/:id/narrators', async ({ res, params }) => {
  const id = uuidParam(params['id'] as string);
  await requireHadith(id);
  const rows = await narratorsOf(id);
  ok(res, rows, { total: rows.length });
});

get('/api/v1/hadiths/:id/references', async ({ res, params, req }) => {
  const id = uuidParam(params['id'] as string);
  await requireHadith(id);
  const rows = await referencesOf(id, isAdminRequest(req));
  ok(res, rows, { total: rows.length });
});

get('/api/v1/hadiths/:id/takhrij', async ({ res, params, req }) => {
  const id = uuidParam(params['id'] as string);
  const row = await requireHadith(id);
  ok(res, await takhrijOf(row, isAdminRequest(req)));
});

get('/api/v1/hadiths/:id/gradings', async ({ res, params }) => {
  const id = uuidParam(params['id'] as string);
  await requireHadith(id);
  const rows = await gradingsOf(id);
  ok(res, rows, { total: rows.length });
});

get('/api/v1/hadiths/:id/verification', async ({ res, params }) => {
  const id = uuidParam(params['id'] as string);
  await requireHadith(id);
  ok(res, await verificationOf(id));
});
