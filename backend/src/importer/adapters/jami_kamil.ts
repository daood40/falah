import type { Adapter, ParseResult } from '../types.ts';
import { genericJsonAdapter } from './generic_json.ts';

/**
 * «الجامع الكامل في الحديث الصحيح الشامل» — source adapter (§41).
 *
 * It reads the JSON contract (contracts/jami-kamil-v1.schema.json) and adds
 * only edition-specific checks. It performs NO text surgery: matn/isnad are
 * carried only when the file itself separates them, otherwise they stay null
 * and raw_text is the single source of truth (§11/§36).
 */
const VOLUME_COUNT = 12;

export const jamiKamilAdapter: Adapter = {
  name: 'jami_kamil',
  accepts: ['.json'],
  parse(input: Buffer, fileName: string): ParseResult {
    const base = genericJsonAdapter.parse(input, fileName);
    const warnings = [...base.warnings];

    for (const [i, rec] of base.records.entries()) {
      if (rec.volume_number !== null && rec.volume_number > VOLUME_COUNT) {
        warnings.push(
          `record #${i + 1}: volume ${rec.volume_number} exceeds the edition's ${VOLUME_COUNT} volumes`,
        );
      }
      if ((rec.matn === null) !== (rec.isnad === null)) {
        warnings.push(
          `record #${i + 1}: only one of matn/isnad is present — the other stays null, it is never derived`,
        );
      }
    }

    return { ...base, warnings };
  },
};
