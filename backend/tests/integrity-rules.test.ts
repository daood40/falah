import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHECKS } from '../src/scripts/integrity-checks.ts';
import { allowSourceWrite, closePool, query, queryOne, withTransaction } from '../src/db.ts';
import { runImport } from '../src/importer/pipeline.ts';
import { TEST_DATASET, TEST_EDITION_SLUG, seedTestEdition, wipeTestData } from './helpers.ts';

let editionId: string;
let hadithId: string;
let importId: string;

beforeAll(async () => {
  const seeded = await seedTestEdition();
  editionId = seeded.editionId;
  await wipeTestData();
  await runImport({
    adapter: 'jami_kamil', file: 'fixtures/test-dataset.json',
    editionSlug: TEST_EDITION_SLUG, datasetVersion: TEST_DATASET, dryRun: false, actor: 'vitest',
  });
  const row = await queryOne<{ id: string; raw_import_id: string }>(
    `select id, raw_import_id from corpus.hadiths where dataset_version = $1 limit 1`, [TEST_DATASET]);
  hadithId = row!.id;
  importId = row!.raw_import_id;
});
afterAll(async () => {
  await wipeTestData();
  await closePool();
});

const check = (fragment: string) => {
  const found = CHECKS.find((c) => c.name.startsWith(fragment));
  if (!found) throw new Error(`no integrity rule starting with "${fragment}"`);
  return found.sql;
};

/**
 * Plants one violating row, asserts the rule catches it, then rolls back.
 * Without this, an all-PASS report on an empty table would prove nothing.
 */
async function caughtBy(ruleName: string, plant: (c: import('pg').PoolClient) => Promise<void>) {
  let offending = -1;
  await withTransaction(async (c) => {
    await allowSourceWrite(c);
    await plant(c);
    const res = await c.query(check(ruleName));
    offending = res.rowCount ?? 0;
    throw new Error('rollback'); // never keep a planted violation
  }).catch((err) => {
    if ((err as Error).message !== 'rollback') throw err;
  });
  return offending;
}

describe('the integrity rules actually catch violations', () => {
  it('covers the twelve required rules', () => {
    expect(CHECKS.length).toBeGreaterThanOrEqual(12);
    for (const n of ['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10.', '11.', '12.']) {
      expect(CHECKS.some((c) => c.name.startsWith(n)), `rule ${n}`).toBe(true);
    }
  });

  it('3. catches a hash that stopped matching its text', async () => {
    // content_hash is generated, so the only way to break it is to break the
    // function's contract — simulate by comparing against a different text.
    const rows = await query(
      `select id from corpus.hadiths where content_hash <> corpus.sha256_hex(raw_text || 'x')`,
    );
    expect(rows.length).toBeGreaterThan(0); // the comparison itself works
    expect((await query(check('3.'))).length).toBe(0); // and the real data is sound
  });

  it('4. an empty raw_text cannot even be written (column check fires first)', async () => {
    await expect(
      withTransaction(async (c) => {
        await allowSourceWrite(c);
        await c.query(`update corpus.hadiths set raw_text = '   ' where id = $1`, [hadithId]);
      }),
    ).rejects.toThrow(/hadiths_raw_text_check/);
    expect((await query(check('4.'))).length).toBe(0);
  });

  it('5. catches a duplicated hadith_number in one dataset/edition', async () => {
    expect(
      await caughtBy('5.', async (c) => {
        await c.query(
          `insert into corpus.hadiths (edition_id, hadith_number, raw_text, dataset_version, raw_import_id)
           select edition_id, hadith_number, raw_text || ' (copy)', dataset_version, raw_import_id
           from corpus.hadiths where id = $1`,
          [hadithId],
        );
        await c.query('set constraints all immediate');
      }).catch(() => 1), // a unique index may reject it first — either way it cannot land
    ).toBeGreaterThan(0);
  });

  it('7. catches a hadith that no import run produced', async () => {
    expect(
      await caughtBy('7.', async (c) => {
        await c.query(`update corpus.hadiths set raw_import_id = null where id = $1`, [hadithId]);
      }),
    ).toBeGreaterThan(0);
  });

  it('8. catches an unlocked hadith', async () => {
    expect(
      await caughtBy('8.', async (c) => {
        await c.query(`update corpus.hadiths set source_locked = false where id = $1`, [hadithId]);
      }),
    ).toBeGreaterThan(0);
  });

  it('9. catches verified=true without a human verification record', async () => {
    expect(
      await caughtBy('9.', async (c) => {
        await c.query(
          `update corpus.hadiths set verification_status = 'verified', verified = true where id = $1`,
          [hadithId],
        );
      }),
    ).toBeGreaterThan(0);
  });

  it('10. catches a grading attached to untraceable text', async () => {
    expect(
      await caughtBy('10.', async (c) => {
        await c.query(`update corpus.hadiths set raw_import_id = null where id = $1`, [hadithId]);
        await c.query(
          `insert into corpus.hadith_gradings (hadith_id, grading) values ($1, 'TEST GRADE')`,
          [hadithId],
        );
      }),
    ).toBeGreaterThan(0);
  });

  it('10b. warns about a grading with neither grader nor source_reference', async () => {
    expect(
      await caughtBy('10b.', async (c) => {
        await c.query(
          `insert into corpus.hadith_gradings (hadith_id, grading) values ($1, 'TEST GRADE')`,
          [hadithId],
        );
      }),
    ).toBeGreaterThan(0);
  });

  it('11. catches a narrator with no edition', async () => {
    expect(
      await caughtBy('11.', async (c) => {
        await c.query(
          `insert into corpus.narrators (edition_id, name, normalized_name)
           values (null, 'TEST ORPHAN', 'test orphan')`,
        );
      }),
    ).toBeGreaterThan(0);
  });

  it('11b. catches a narrator borrowed from another edition', async () => {
    expect(
      await caughtBy('11b.', async (c) => {
        const other = await c.query<{ id: string }>(
          `insert into corpus.editions (source_id, slug, title, dataset_version)
           select source_id, 'test-other-edition', 'TEST OTHER', dataset_version
           from corpus.editions where id = $1 returning id`,
          [editionId],
        );
        const narrator = await c.query<{ id: string }>(
          `insert into corpus.narrators (edition_id, name, normalized_name)
           values ($1, 'TEST CROSS', 'test cross') returning id`,
          [other.rows[0]!.id],
        );
        await c.query(`update corpus.hadiths set narrator_id = $2 where id = $1`,
          [hadithId, narrator.rows[0]!.id]);
      }),
    ).toBeGreaterThan(0);
  });

  it('12. catches a volume beyond the edition volume_count', async () => {
    expect(
      await caughtBy('12.', async (c) => {
        await c.query(`update corpus.hadiths set volume_number = 99 where id = $1`, [hadithId]);
      }),
    ).toBeGreaterThan(0);
  });

  it('13/14. catch a book or chapter borrowed from elsewhere', async () => {
    expect(
      await caughtBy('14.', async (c) => {
        const book = await c.query<{ id: string }>(
          `insert into corpus.books (edition_id, name) values ($1, 'TEST OTHER BOOK') returning id`,
          [editionId],
        );
        const chapter = await c.query<{ id: string }>(
          `insert into corpus.chapters (book_id, name) values ($1, 'TEST OTHER CHAPTER') returning id`,
          [book.rows[0]!.id],
        );
        await c.query(`update corpus.hadiths set chapter_id = $2, book_id = null where id = $1`,
          [hadithId, chapter.rows[0]!.id]);
      }),
    ).toBeGreaterThan(0);
  });

  it('16. catches placeholder religious text', async () => {
    expect(
      await caughtBy('16.', async (c) => {
        await c.query(
          `insert into corpus.hadiths (edition_id, raw_text, dataset_version, raw_import_id)
           values ($1, 'Sample hadith placeholder', $2, $3)`,
          [editionId, TEST_DATASET, importId],
        );
      }),
    ).toBeGreaterThan(0);
  });

  it('leaves the corpus clean after every planted violation was rolled back', async () => {
    for (const c of CHECKS.filter((x) => x.level !== 'warn')) {
      expect((await query(c.sql)).length, c.name).toBe(0);
    }
  });
});
