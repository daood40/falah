import { emptyRecord, type Adapter, type ParseResult, type SourceRecord } from '../types.ts';
import { preserveText } from '../../domain/normalize.ts';

/** Field aliases accepted by the contract. Nothing outside this map is guessed. */
const ALIASES: Record<string, string> = {
  hadith_number: 'hadith_number',
  number: 'hadith_number',
  'رقم_الحديث': 'hadith_number',
  'رقم الحديث': 'hadith_number',
  volume: 'volume_number',
  volume_number: 'volume_number',
  'المجلد': 'volume_number',
  page: 'page_number',
  page_number: 'page_number',
  'الصفحة': 'page_number',
  raw_text: 'raw_text',
  text: 'raw_text',
  'النص': 'raw_text',
  matn: 'matn',
  'المتن': 'matn',
  isnad: 'isnad',
  'السند': 'isnad',
  takhrij: 'takhrij',
  'التخريج': 'takhrij',
  grading: 'grading',
  'الدرجة': 'grading',
  original_reference: 'original_reference',
  'المصدر_الأصلي': 'original_reference',
  original_hadith_number: 'original_hadith_number',
  narrator: 'narrator',
  'الراوي': 'narrator',
  book: 'book',
  'الكتاب': 'book',
  chapter: 'chapter',
  'الباب': 'chapter',
  sources: 'sources',
  gradings: 'gradings',
  narrators: 'narrators',
  references: 'references',
};

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
  return Number.isInteger(n) && n > 0 ? n : null;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return v === null || v === undefined ? null : String(v);
  const t = preserveText(v);
  return t === '' ? null : t;
}

export function mapRecord(input: Record<string, unknown>, index: number): SourceRecord {
  const mapped: Record<string, unknown> = {};
  const unmapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const target = ALIASES[key.trim()];
    if (target) mapped[target] = value;
    else unmapped[key] = value;
  }

  const rawText = strOrNull(mapped['raw_text']) ?? '';
  const rec = emptyRecord(rawText);
  rec.hadith_number = strOrNull(mapped['hadith_number']);
  rec.volume_number = intOrNull(mapped['volume_number']);
  rec.page_number = intOrNull(mapped['page_number']);
  // matn/isnad are carried ONLY when the file states them; never derived (§36).
  rec.matn = strOrNull(mapped['matn']);
  rec.isnad = strOrNull(mapped['isnad']);
  rec.takhrij = strOrNull(mapped['takhrij']);
  rec.grading = strOrNull(mapped['grading']);
  rec.original_reference = strOrNull(mapped['original_reference']);
  rec.original_hadith_number = strOrNull(mapped['original_hadith_number']);
  rec.unmapped = unmapped;

  const narrator = mapped['narrator'];
  if (typeof narrator === 'string' && narrator.trim() !== '') {
    rec.narrator = { name: preserveText(narrator), kunya: null, laqab: null, biography: null };
  } else if (narrator && typeof narrator === 'object') {
    const n = narrator as Record<string, unknown>;
    const name = strOrNull(n['name'] ?? n['الاسم']);
    if (name) {
      rec.narrator = {
        name,
        kunya: strOrNull(n['kunya'] ?? n['الكنية']),
        laqab: strOrNull(n['laqab'] ?? n['اللقب']),
        biography: strOrNull(n['biography'] ?? n['ترجمة']),
      };
    }
  }

  const book = mapped['book'];
  if (typeof book === 'string' && book.trim() !== '') {
    rec.book = { key: preserveText(book), name: preserveText(book), order_number: null };
  } else if (book && typeof book === 'object') {
    const b = book as Record<string, unknown>;
    const name = strOrNull(b['name'] ?? b['الاسم']);
    if (name) {
      rec.book = {
        key: strOrNull(b['key'] ?? b['id']) ?? name,
        name,
        order_number: intOrNull(b['order'] ?? b['order_number'] ?? b['الترتيب']),
      };
    }
  }

  const chapter = mapped['chapter'];
  if (typeof chapter === 'string' && chapter.trim() !== '') {
    rec.chapter = {
      key: preserveText(chapter),
      name: preserveText(chapter),
      chapter_number: null,
      order_number: null,
      parent_key: null,
    };
  } else if (chapter && typeof chapter === 'object') {
    const c = chapter as Record<string, unknown>;
    const name = strOrNull(c['name'] ?? c['الاسم']);
    if (name) {
      rec.chapter = {
        key: strOrNull(c['key'] ?? c['id']) ?? name,
        name,
        chapter_number: strOrNull(c['number'] ?? c['chapter_number'] ?? c['رقم']),
        order_number: intOrNull(c['order'] ?? c['order_number']),
        parent_key: strOrNull(c['parent_key'] ?? c['parent']),
      };
    }
  }

  for (const s of asArray(mapped['sources'])) {
    const name = typeof s === 'string' ? s : strOrNull((s as Record<string, unknown>)['source_name'] ?? (s as Record<string, unknown>)['name']);
    if (!name) continue;
    const o = typeof s === 'string' ? {} : (s as Record<string, unknown>);
    rec.sources.push({
      source_name: name,
      reference: strOrNull(o['reference']),
      reference_number: strOrNull(o['reference_number'] ?? o['number']),
    });
  }

  for (const g of asArray(mapped['gradings'])) {
    const grading = typeof g === 'string' ? g : strOrNull((g as Record<string, unknown>)['grading']);
    if (!grading) continue;
    const o = typeof g === 'string' ? {} : (g as Record<string, unknown>);
    rec.gradings.push({
      grading,
      grader: strOrNull(o['grader']),
      source_reference: strOrNull(o['source_reference']),
      notes: strOrNull(o['notes']),
    });
  }

  for (const [i, n] of asArray(mapped['narrators']).entries()) {
    const name = typeof n === 'string' ? n : strOrNull((n as Record<string, unknown>)['name']);
    if (!name) continue;
    const o = typeof n === 'string' ? {} : (n as Record<string, unknown>);
    rec.narrators.push({
      name,
      position: intOrNull(o['position']) ?? i + 1,
      role: strOrNull(o['role']),
    });
  }

  for (const r of asArray(mapped['references'])) {
    const text = typeof r === 'string' ? r : strOrNull((r as Record<string, unknown>)['reference_text']);
    if (!text) continue;
    const type = typeof r === 'string' ? 'other' : String((r as Record<string, unknown>)['reference_type'] ?? 'other');
    rec.references.push({
      reference_type: (['quran', 'hadith', 'book', 'page', 'other'] as const).includes(type as 'other')
        ? (type as 'other')
        : 'other',
      reference_text: text,
    });
  }

  if (!rec.hadith_number && rec.raw_text === '') rec.unmapped['__index'] = index;
  return rec;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export const genericJsonAdapter: Adapter = {
  name: 'generic_json',
  accepts: ['.json'],
  parse(input: Buffer): ParseResult {
    const warnings: string[] = [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(input.toString('utf8'));
    } catch (err) {
      throw new Error(`invalid JSON: ${(err as Error).message}`);
    }
    const body = parsed as Record<string, unknown>;
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(body['records'])
        ? (body['records'] as unknown[])
        : Array.isArray(body['hadiths'])
          ? (body['hadiths'] as unknown[])
          : null;
    if (!list) throw new Error('expected an array, or an object with "records"/"hadiths"');

    const records = list.map((row, i) => {
      if (!row || typeof row !== 'object') {
        warnings.push(`record #${i + 1}: not an object — skipped`);
        return emptyRecord('');
      }
      return mapRecord(row as Record<string, unknown>, i);
    });

    return {
      records,
      warnings,
      edition_hint: (body['edition'] as Record<string, unknown>) ?? null,
    };
  },
};
