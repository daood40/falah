import type { Server } from 'node:http';
import { query } from '../src/db.ts';

export const ADMIN_KEY = process.env['ADMIN_API_KEY'] as string;

export interface TestApi {
  server: Server;
  base: string;
  close: () => Promise<void>;
  get: (path: string, init?: RequestInit) => Promise<{ status: number; body: any }>;
  post: (path: string, body: unknown, init?: RequestInit) => Promise<{ status: number; body: any }>;
}

export async function startApi(existing?: Server): Promise<TestApi> {
  const server = existing ?? (await import('../src/http/app.ts')).createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;

  const call = async (path: string, init?: RequestInit) => {
    const res = await fetch(`${base}${path}`, init);
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, body: body as any };
  };

  return {
    server,
    base,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    get: (path, init) => call(path, init),
    post: (path, body, init) =>
      call(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
        body: typeof body === 'string' ? body : JSON.stringify(body),
        ...init,
      }),
  };
}

export const auth = { authorization: `Bearer ${ADMIN_KEY}` };

/** A synthetic, clearly-marked test edition. It never carries scripture. */
export const TEST_EDITION_SLUG = 'test-fixture-edition';
export const TEST_DATASET = 'TEST-FIXTURE-V1';

/**
 * The suite writes synthetic rows, so it must never point at a database that
 * holds a real corpus. One accidental run against the release database left a
 * sealed TEST-FIXTURE dataset behind; this makes that impossible.
 */
async function refuseRealCorpus(): Promise<void> {
  const rows = await query<{ dataset_version: string }>(
    `select distinct dataset_version from corpus.hadiths
      where dataset_version not like 'TEST-%' limit 1`,
  );
  const foreign = rows[0]?.dataset_version;
  if (foreign) {
    throw new Error(
      `refusing to run the test suite against a database holding the real corpus ` +
        `(dataset_version=${foreign}). Point DATABASE_URL at the scratch test database.`,
    );
  }
}

export async function seedTestEdition(): Promise<{ sourceId: string; editionId: string }> {
  await refuseRealCorpus();
  const source = await query<{ id: string }>(
    `insert into corpus.sources (slug, name, description, source_type, license_status)
     values ('test-fixture-source', 'TEST FIXTURE SOURCE', 'synthetic data for automated tests',
             'user_supplied_file', 'confirmed')
     on conflict (slug) do update set name = excluded.name returning id`,
  );
  const sourceId = (source[0] as { id: string }).id;
  await query(
    `insert into corpus.dataset_versions (version, source_id, description, is_active)
     values ($1, $2, 'synthetic test dataset', false) on conflict (version) do nothing`,
    [TEST_DATASET, sourceId],
  );
  const edition = await query<{ id: string }>(
    `insert into corpus.editions (source_id, slug, title, author, publisher, edition_number,
       volume_count, dataset_version)
     values ($1, $2, 'TEST FIXTURE EDITION', 'TEST AUTHOR', 'TEST PUBLISHER', 1, 12, $3)
     on conflict (slug) do update set title = excluded.title returning id`,
    [sourceId, TEST_EDITION_SLUG, TEST_DATASET],
  );
  return { sourceId, editionId: (edition[0] as { id: string }).id };
}

/** Removes synthetic rows; SOURCE_LOCK must be opened explicitly to do it. */
export async function wipeTestData(): Promise<void> {
  await query(
    `do $$ begin
       perform set_config('corpus.allow_source_write', 'on', true);
       delete from corpus.hadiths where dataset_version = 'TEST-FIXTURE-V1';
     end $$;`,
  );
  await query(`delete from corpus.raw_imports where dataset_version = 'TEST-FIXTURE-V1'`);
  // samples reference hadith ids in an array (no FK), so removing the hadiths
  // without removing their samples would leave orphaned ids behind — integrity
  // rule 17 exists precisely to catch that.
  await query(`delete from corpus.verification_samples where dataset_version = 'TEST-FIXTURE-V1'`);
  // Books, chapters and narrators belong to the synthetic edition too: leaving
  // them behind let one test file's fixtures leak into another's counts.
  await query(
    `delete from corpus.chapters c using corpus.books b
      where c.book_id = b.id and b.edition_id in
        (select id from corpus.editions where slug like 'test-%')`,
  );
  await query(`delete from corpus.books where edition_id in (select id from corpus.editions where slug like 'test-%')`);
  await query(`delete from corpus.narrators where edition_id in (select id from corpus.editions where slug like 'test-%')`);
}
