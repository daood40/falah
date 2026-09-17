import type { Adapter, ParseResult } from '../types.ts';
import { mapRecord } from './generic_json.ts';

/**
 * Structured HTML only: every hadith is one element carrying data-* attributes
 * plus a text container. Unstructured page markup is NOT guessed at — convert it
 * to the JSON contract first (see contracts/DATA_CONTRACT.md).
 *
 *   <article data-hadith-number="1" data-volume="1" data-page="25"
 *            data-book="كتاب الإيمان" data-chapter="باب ...">
 *     <div data-field="raw_text">…</div>
 *   </article>
 */
const BLOCK_RE = /<article\b([^>]*)>([\s\S]*?)<\/article>/gi;
const ATTR_RE = /data-([a-z0-9_-]+)\s*=\s*"([^"]*)"/gi;
const FIELD_RE = /<([a-z]+)\b[^>]*\bdata-field\s*=\s*"([a-z_]+)"[^>]*>([\s\S]*?)<\/\1>/gi;

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ',
};

export function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? e)
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export const genericHtmlAdapter: Adapter = {
  name: 'generic_html',
  accepts: ['.html', '.htm'],
  parse(input: Buffer): ParseResult {
    const html = input.toString('utf8');
    const warnings: string[] = [];
    const records = [];
    let block: RegExpExecArray | null;
    let index = 0;

    while ((block = BLOCK_RE.exec(html)) !== null) {
      const attrs: Record<string, unknown> = {};
      let attr: RegExpExecArray | null;
      const attrSource = block[1] ?? '';
      ATTR_RE.lastIndex = 0;
      while ((attr = ATTR_RE.exec(attrSource)) !== null) {
        attrs[(attr[1] as string).replace(/-/g, '_')] = stripTags(attr[2] as string);
      }
      const body = block[2] ?? '';
      let field: RegExpExecArray | null;
      FIELD_RE.lastIndex = 0;
      while ((field = FIELD_RE.exec(body)) !== null) {
        attrs[field[2] as string] = stripTags(field[3] as string);
      }
      if (attrs['raw_text'] === undefined) {
        const text = stripTags(body);
        if (text) attrs['raw_text'] = text;
        else warnings.push(`block #${index + 1}: no text found`);
      }
      records.push(mapRecord(attrs, index));
      index++;
    }

    if (records.length === 0) {
      throw new Error('no <article> blocks found — convert the page to the JSON contract first');
    }
    return { records, warnings, edition_hint: null };
  },
};
