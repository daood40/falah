import { closePool } from '../db.ts';
import { runImport } from './pipeline.ts';
import { renderReport, saveReport } from './report.ts';
import { adapters } from './adapters/index.ts';

const USAGE = `
FALAH hadith importer

  npm run import -- --file <path> --adapter <name> --edition <slug> [options]

Options
  --file <path>          source file (required)
  --adapter <name>       ${Object.keys(adapters).join(' | ')}
  --edition <slug>       target edition slug (e.g. jami-kamil-1437)
  --dataset <version>    dataset version (default: the edition's)
  --actor <name>         who ran this import (audit log)
  --dry-run              parse + validate + report, WITHOUT touching the database
  --no-save-report       do not write the JSON report file
`;

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.length <= 2) {
    console.log(USAGE);
    return;
  }
  const file = arg('--file');
  const adapter = arg('--adapter') ?? 'generic_json';
  const edition = arg('--edition') ?? 'jami-kamil-1437';
  if (!file) throw new Error('--file is required');

  const report = await runImport({
    adapter,
    file,
    editionSlug: edition,
    datasetVersion: arg('--dataset'),
    dryRun: process.argv.includes('--dry-run'),
    actor: arg('--actor') ?? 'cli',
  });

  console.log(renderReport(report));
  if (!process.argv.includes('--no-save-report')) {
    console.log(`\nreport saved: ${saveReport(report)}`);
  }
  if (report.status === 'failed') process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(`import failed: ${(err as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => void closePool());
