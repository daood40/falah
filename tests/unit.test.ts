import { describe, expect, it } from 'vitest';
import { normalizeArabic, preserveText } from '../src/domain/normalize.ts';
import { contentHash, fileHash } from '../src/domain/hash.ts';
import { parseCsv } from '../src/importer/adapters/generic_csv.ts';
import { stripTags, genericHtmlAdapter } from '../src/importer/adapters/generic_html.ts';
import { genericJsonAdapter } from '../src/importer/adapters/generic_json.ts';
import { jamiKamilAdapter } from '../src/importer/adapters/jami_kamil.ts';
import { getAdapter } from '../src/importer/adapters/index.ts';
import { validateRecord } from '../src/importer/validate.ts';
import { emptyRecord } from '../src/importer/types.ts';
import { verifyJwt } from '../src/http/auth.ts';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

describe('arabic normalization (search only)', () => {
  it('strips diacritics and unifies hamza/alef/ya/ta-marbuta', () => {
    expect(normalizeArabic('إنَّ الأعْمالَ بالنِّيَّاتِ')).toBe('ان الاعمال بالنيات');
    expect(normalizeArabic('مُصْطَفَى')).toBe('مصطفي');
    expect(normalizeArabic('مَكَّةَ')).toBe('مكه');
  });

  it('converts Arabic-Indic digits and drops tatweel', () => {
    expect(normalizeArabic('صفحة ٢٥٧')).toBe('صفحه 257');
    expect(normalizeArabic('كــتـــاب')).toBe('كتاب');
  });

  it('never mutates the stored text: preserveText keeps diacritics and symbols', () => {
    const raw = '  نصٌّ «مُشَكَّل» ﴿رمز﴾ ٥  ';
    expect(preserveText(raw)).toBe('نصٌّ «مُشَكَّل» ﴿رمز﴾ ٥');
    expect(preserveText(raw)).toContain('ٌّ');
  });
});

describe('content hashing', () => {
  it('is stable and sensitive to any change', () => {
    const a = contentHash('نص');
    expect(a).toHaveLength(64);
    expect(contentHash('نص')).toBe(a);
    expect(contentHash('نصٌ')).not.toBe(a);
  });

  it('hashes a diacritic difference differently', () => {
    expect(contentHash('العلم')).not.toBe(contentHash('العِلْم'));
  });

  it('hashes files', () => {
    expect(fileHash(Buffer.from('x'))).toHaveLength(64);
  });
});

describe('CSV parsing', () => {
  it('respects quotes, escaped quotes and commas', () => {
    const rows = parseCsv('a,b\n"x,1","he said ""hi"""\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x,1', 'he said "hi"'],
    ]);
  });
});

describe('HTML parsing', () => {
  it('decodes entities and strips tags', () => {
    expect(stripTags('<p>a &amp; b<br>c</p>')).toBe('a & b\nc');
  });

  it('reads the structured contract', () => {
    const parsed = genericHtmlAdapter.parse(readFileSync('fixtures/test-dataset.html'), 'x.html');
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0]?.hadith_number).toBe('20');
    expect(parsed.records[0]?.volume_number).toBe(3);
    expect(parsed.records[0]?.raw_text).toContain('TEST DATA');
  });

  it('refuses unstructured HTML instead of guessing', () => {
    expect(() => genericHtmlAdapter.parse(Buffer.from('<div>نص</div>'), 'x.html')).toThrow(/JSON contract/);
  });
});

describe('JSON adapter', () => {
  const parsed = genericJsonAdapter.parse(readFileSync('fixtures/test-dataset.json'), 'x.json');

  it('maps English and Arabic field aliases', () => {
    expect(parsed.records[0]?.hadith_number).toBe('1');
    expect(parsed.records[0]?.page_number).toBe(25);
  });

  it('keeps matn/isnad null unless the source separates them', () => {
    expect(parsed.records[0]?.matn).toBeNull();
    expect(parsed.records[0]?.isnad).toBeNull();
    expect(parsed.records[1]?.matn).toContain('TEST MATN');
    expect(parsed.records[1]?.isnad).toContain('TEST ISNAD');
  });

  it('reports unknown fields as unmapped instead of importing them', () => {
    expect(Object.keys(parsed.records[0]?.unmapped ?? {})).toContain('unknown_extra_field');
  });

  it('rejects malformed JSON', () => {
    expect(() => genericJsonAdapter.parse(Buffer.from('{'), 'x.json')).toThrow(/invalid JSON/);
  });

  it('rejects a payload that is not a record list', () => {
    expect(() => genericJsonAdapter.parse(Buffer.from('{"a":1}'), 'x.json')).toThrow(/expected an array/);
  });
});

describe('jami_kamil adapter', () => {
  it('warns when a volume exceeds the 12-volume edition', () => {
    const parsed = jamiKamilAdapter.parse(readFileSync('fixtures/test-dataset.json'), 'x.json');
    expect(parsed.warnings.join(' ')).toMatch(/exceeds the edition's 12 volumes/);
  });

  it('is registered and unknown adapters are rejected', () => {
    expect(getAdapter('jami_kamil').name).toBe('jami_kamil');
    expect(() => getAdapter('nope')).toThrow(/unknown adapter/);
  });
});

describe('record validation', () => {
  const edition = { volume_count: 12, page_count: null };

  it('rejects an empty text instead of filling it in', () => {
    const res = validateRecord(emptyRecord(''), 0, edition);
    expect(res.errors.map((e) => e.code)).toContain('MISSING_TEXT');
  });

  it('rejects an out-of-range volume', () => {
    const rec = emptyRecord('نص');
    rec.volume_number = 99;
    expect(validateRecord(rec, 0, edition).errors.map((e) => e.code)).toContain('VOLUME_OUT_OF_RANGE');
  });

  it('warns but keeps an unusual hadith number verbatim', () => {
    const rec = emptyRecord('نص');
    rec.hadith_number = '12$';
    const res = validateRecord(rec, 0, edition);
    expect(res.warnings.map((w) => w.code)).toContain('UNUSUAL_NUMBER');
    expect(res.errors).toHaveLength(0);
    expect(rec.hadith_number).toBe('12$');
  });

  it('flags a record whose matn/isnad are not separated', () => {
    const res = validateRecord(emptyRecord('نص'), 0, edition);
    expect(res.warnings.map((w) => w.code)).toContain('NOT_SEPARATED');
  });
});

describe('JWT verification', () => {
  const secret = 'test-jwt-secret-not-a-real-secret';
  const sign = (payload: object) => {
    const enc = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    const head = enc({ alg: 'HS256', typ: 'JWT' });
    const body = enc(payload);
    const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
    return `${head}.${body}.${sig}`;
  };

  it('accepts a correctly signed token', () => {
    const claims = verifyJwt(sign({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 60 }), secret);
    expect(claims['sub']).toBe('u1');
  });

  it('rejects a tampered signature', () => {
    const token = sign({ sub: 'u1' });
    expect(() => verifyJwt(`${token}x`, secret)).toThrow(/Invalid token/);
  });

  it('rejects an expired token', () => {
    expect(() => verifyJwt(sign({ sub: 'u1', exp: 1 }), secret)).toThrow(/expired/);
  });

  it('rejects a malformed token', () => {
    expect(() => verifyJwt('abc', secret)).toThrow(/Invalid token/);
  });
});
