import type pg from 'pg';
import { ApiError } from '../core/errors.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => UUID_RE.test(value);

export type EditionRow = {
  id: string;
  slug: string;
  name: string;
  edition_type: string;
  riwayah: string | null;
  qiraah: string | null;
  script_type: string | null;
  font_name: string | null;
  version: string | null;
  publisher: string | null;
  country: string | null;
  language: string | null;
  license: string | null;
  license_url: string | null;
  source_id: string;
};

const EDITION_COLUMNS = `id, slug, name, edition_type, riwayah, qiraah, script_type,
  font_name, version, publisher, country, language, license, license_url, source_id`;

export async function listEditions(client: pg.PoolClient): Promise<EditionRow[]> {
  const { rows } = await client.query<EditionRow>(
    `select ${EDITION_COLUMNS} from quran.quran_editions order by edition_type, slug`,
  );
  return rows;
}

export async function findEdition(
  client: pg.PoolClient,
  ref: string,
): Promise<EditionRow | null> {
  const { rows } = await client.query<EditionRow>(
    `select ${EDITION_COLUMNS} from quran.quran_editions
     where ${isUuid(ref) ? 'id = $1' : 'slug = $1'} limit 1`,
    [ref],
  );
  return rows[0] ?? null;
}

/**
 * Resolves the edition for a request: explicit `?edition=` (slug or id),
 * else DEFAULT_EDITION_SLUG, else the oldest `quran` edition.
 * Page/juz/hizb numbering is edition-specific, so every structural query
 * is scoped by the resolved edition.
 */
export async function resolveEdition(
  client: pg.PoolClient,
  ref: string | null,
): Promise<EditionRow> {
  if (ref) {
    const edition = await findEdition(client, ref);
    if (!edition) throw ApiError.notFound('Edition not found');
    return edition;
  }
  const preferred = process.env.DEFAULT_EDITION_SLUG;
  if (preferred) {
    const edition = await findEdition(client, preferred);
    if (edition) return edition;
  }
  const { rows } = await client.query<EditionRow>(
    `select ${EDITION_COLUMNS} from quran.quran_editions
     where edition_type = 'quran' order by created_at, slug limit 1`,
  );
  const edition = rows[0];
  if (!edition) throw ApiError.notFound('No Quran edition has been imported yet');
  return edition;
}
