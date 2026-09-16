import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { RecordIssue } from './validate.ts';

export interface ImportReport {
  source: string;
  edition: string;
  dataset_version: string;
  adapter: string;
  file_name: string;
  file_hash: string;
  dry_run: boolean;
  started_at: string;
  finished_at: string;
  total_records: number;
  imported: number;
  skipped: number;
  duplicates: number;
  invalid: number;
  missing_data: number;
  verified_hashes: number;
  hash_mismatches: number;
  errors: RecordIssue[];
  warnings: RecordIssue[];
  parser_warnings: string[];
  status: 'completed' | 'failed' | 'dry_run';
  raw_import_id: string | null;
}

export function renderReport(r: ImportReport): string {
  const line = (k: string, v: unknown) => `${k.padEnd(18)} ${String(v)}`;
  return [
    '================ IMPORT REPORT ================',
    line('SOURCE', r.source),
    line('EDITION', r.edition),
    line('DATASET VERSION', r.dataset_version),
    line('ADAPTER', r.adapter),
    line('FILE', r.file_name),
    line('FILE HASH', r.file_hash),
    line('MODE', r.dry_run ? 'DRY RUN (no database writes)' : 'IMPORT'),
    '-----------------------------------------------',
    line('TOTAL RECORDS', r.total_records),
    line('IMPORTED', r.imported),
    line('SKIPPED', r.skipped),
    line('DUPLICATES', r.duplicates),
    line('INVALID', r.invalid),
    line('MISSING DATA', r.missing_data),
    line('HASHES VERIFIED', r.verified_hashes),
    line('HASH MISMATCHES', r.hash_mismatches),
    line('ERRORS', r.errors.length),
    line('WARNINGS', r.warnings.length + r.parser_warnings.length),
    line('STATUS', r.status.toUpperCase()),
    '===============================================',
    ...r.errors.slice(0, 20).map((e) => `  ERROR   #${e.record} ${e.field}: ${e.message}`),
    ...r.warnings.slice(0, 20).map((w) => `  WARNING #${w.record} ${w.field}: ${w.message}`),
    r.errors.length > 20 ? `  … ${r.errors.length - 20} more errors in the JSON report` : '',
    r.warnings.length > 20 ? `  … ${r.warnings.length - 20} more warnings in the JSON report` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function saveReport(r: ImportReport, dir = 'reports'): string {
  const stamp = r.started_at.replace(/[:.]/g, '-');
  const path = resolve(dir, `import-${r.dry_run ? 'dryrun-' : ''}${stamp}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(r, null, 2), 'utf8');
  return path;
}
