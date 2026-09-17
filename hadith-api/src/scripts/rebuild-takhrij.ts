/**
 * Re-derives corpus.hadith_sources from the takhrij text already stored.
 *
 * It reads the same `citedCollections` the importer uses, so the derived table
 * and the importer can never disagree. The takhrij TEXT is never touched — only
 * the derived links are rebuilt, inside one transaction, with an audit entry.
 *
 *   node --experimental-strip-types src/scripts/rebuild-takhrij.ts [--dry-run]
 */
import { closePool, query, withTransaction } from '../db.ts';
import { citedCollections } from '../importer/adapters/jami_kamil_shamela.ts';

const DRY_RUN = process.argv.includes('--dry-run');

async function main(): Promise<void> {
  const rows = await query<{ id: string; takhrij: string }>(
    `select id, takhrij from corpus.hadiths where takhrij is not null`,
  );
  const before = await query<{ source_name: string; n: number }>(
    `select source_name, count(*)::int as n from corpus.hadith_sources group by source_name`,
  );
  const beforeMap = new Map(before.map((r) => [r.source_name, r.n]));

  const links: { hadith_id: string; source_name: string; reference: string }[] = [];
  for (const row of rows) {
    for (const name of citedCollections(row.takhrij)) {
      links.push({ hadith_id: row.id, source_name: name, reference: row.takhrij });
    }
  }

  const afterMap = new Map<string, number>();
  for (const link of links) afterMap.set(link.source_name, (afterMap.get(link.source_name) ?? 0) + 1);

  console.log('========== TAKHRIJ LINKS REBUILD ==========');
  console.log(`hadiths with a takhrij line   ${rows.length}`);
  console.log(`links before                  ${[...beforeMap.values()].reduce((a, b) => a + b, 0)}`);
  console.log(`links after                   ${links.length}`);
  console.log('name'.padEnd(22) + 'before'.padStart(8) + 'after'.padStart(8) + 'delta'.padStart(8));
  for (const name of new Set([...beforeMap.keys(), ...afterMap.keys()])) {
    const b = beforeMap.get(name) ?? 0;
    const a = afterMap.get(name) ?? 0;
    if (b !== a) console.log(name.padEnd(22) + String(b).padStart(8) + String(a).padStart(8) + String(a - b).padStart(8));
  }

  if (DRY_RUN) {
    console.log('DRY RUN — nothing was written');
    return;
  }

  await withTransaction(async (client) => {
    await client.query('delete from corpus.hadith_sources');
    const CHUNK = 1000;
    for (let i = 0; i < links.length; i += CHUNK) {
      const slice = links.slice(i, i + CHUNK);
      const values: unknown[] = [];
      const tuples = slice.map((link, r) => {
        values.push(link.hadith_id, link.source_name, link.reference);
        return `($${r * 3 + 1},$${r * 3 + 2},$${r * 3 + 3})`;
      });
      await client.query(
        `insert into corpus.hadith_sources (hadith_id, source_name, reference) values ${tuples.join(',')}`,
        values,
      );
    }
    await client.query(
      `insert into corpus.audit_logs (actor, actor_role, action, entity_type, entity_id, details)
       values ('rebuild-takhrij', 'service', 'takhrij.rebuild', 'hadith_sources', null, $1)`,
      [JSON.stringify({ links_before: [...beforeMap], links_after: [...afterMap] })],
    );
  });
  console.log('rebuilt — the takhrij text itself was not modified');
  console.log('==========================================');
}

main()
  .catch((err) => {
    console.error(`rebuild failed: ${(err as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => void closePool());
