import type { SourceRecord } from './types.ts';

export interface RecordIssue {
  record: number;
  field: string;
  code: string;
  message: string;
}

export interface EditionMeta {
  volume_count: number | null;
  page_count: number | null;
}

const NUMBER_RE = /^[0-9٠-٩]+([\/ـ\-][0-9٠-٩\p{Script=Arabic}]+)?$/u;

/**
 * Validation never repairs a record — it only reports. A record that cannot be
 * trusted is rejected so a human can look at the source, never auto-corrected.
 */
export function validateRecord(
  rec: SourceRecord,
  index: number,
  edition: EditionMeta,
): { errors: RecordIssue[]; warnings: RecordIssue[] } {
  const errors: RecordIssue[] = [];
  const warnings: RecordIssue[] = [];
  const at = (field: string, code: string, message: string): RecordIssue => ({
    record: index + 1,
    field,
    code,
    message,
  });

  if (!rec.raw_text || rec.raw_text.trim() === '') {
    errors.push(at('raw_text', 'MISSING_TEXT', 'raw_text is empty — the record carries no source text'));
  }
  if (rec.hadith_number === null) {
    warnings.push(at('hadith_number', 'MISSING_NUMBER', 'no hadith number in the source record'));
  } else if (!NUMBER_RE.test(rec.hadith_number)) {
    warnings.push(
      at('hadith_number', 'UNUSUAL_NUMBER', `unexpected number format "${rec.hadith_number}" — kept verbatim`),
    );
  }
  if (rec.volume_number !== null && edition.volume_count !== null && rec.volume_number > edition.volume_count) {
    errors.push(
      at('volume_number', 'VOLUME_OUT_OF_RANGE', `volume ${rec.volume_number} > ${edition.volume_count}`),
    );
  }
  if (rec.page_number !== null && rec.page_number <= 0) {
    errors.push(at('page_number', 'INVALID_PAGE', 'page must be a positive integer'));
  }
  if (rec.matn === null && rec.isnad === null && rec.raw_text) {
    warnings.push(
      at('matn', 'NOT_SEPARATED', 'source does not separate matn/isnad — both stay null, raw_text is authoritative'),
    );
  }
  if (Object.keys(rec.unmapped).length > 0) {
    warnings.push(
      at('*', 'UNMAPPED_FIELDS', `unmapped source fields kept out of the import: ${Object.keys(rec.unmapped).join(', ')}`),
    );
  }
  if (rec.grading && rec.gradings.length === 0) {
    warnings.push(at('grading', 'GRADING_WITHOUT_GRADER', 'grading text has no attributed grader in the source'));
  }
  return { errors, warnings };
}
