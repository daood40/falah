import type { Adapter, ParseResult } from '../types.ts';
import { mapRecord } from './generic_json.ts';

/** RFC4180-style CSV split that respects quoted fields and embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export const genericCsvAdapter: Adapter = {
  name: 'generic_csv',
  accepts: ['.csv'],
  parse(input: Buffer): ParseResult {
    const rows = parseCsv(input.toString('utf8').replace(/^﻿/, ''));
    if (rows.length < 2) throw new Error('CSV must have a header row and at least one data row');
    const header = (rows[0] as string[]).map((h) => h.trim());
    const warnings: string[] = [];

    const records = rows.slice(1).map((cells, i) => {
      if (cells.length !== header.length) {
        warnings.push(`row #${i + 2}: ${cells.length} cells for ${header.length} columns`);
      }
      const obj: Record<string, unknown> = {};
      header.forEach((key, idx) => {
        obj[key] = cells[idx] ?? '';
      });
      return mapRecord(obj, i);
    });

    return { records, warnings, edition_hint: null };
  },
};
