import { emptyRecord, type Adapter, type ParseResult, type SourceRecord } from '../types.ts';

/**
 * «الجامع الكامل في الحديث الصحيح الشامل» — Shamela plain-text export
 * (one file per volume, shamela.ws/book/47, numbering matching the print).
 *
 * The file's own structure, and nothing beyond it:
 *   [جN صM]              page marker → volume + printed page
 *   [١ - كتاب الوحي]     bracketed heading starting with كتاب → a book
 *   [١ - باب ...]        bracketed heading → a chapter
 *   ١ - باب ...          unbracketed numbered heading → a chapter
 *   • عن فلان ...        a hadith; its text continues on the following lines
 *   متفق عليه: / صحيح: / حسن:   the author's grading + takhrij paragraph
 *   anything after that  the author's commentary — NOT imported as hadith text
 *
 * Deliberately NOT done here:
 *   - no hadith number is invented (this edition prints none) → hadith_number null
 *   - matn/isnad are never split out of the text → both null
 *   - the grading label is copied verbatim from the line, never judged
 *   - spelling is never "corrected", diacritics never stripped
 */

const PAGE = /^\[ج(\d+)\s+ص(\d+)\]$/;
const BULLET = /^•\s*(.*)$/;
const BRACKET_HEAD = /^\[\s*([٠-٩]+)\s*-\s*(.+?)\s*\]$/;
const PLAIN_HEAD = /^([٠-٩]+)\s*-\s*((?:كتاب|باب)\s+.+)$/;

/** Grading labels this edition uses, longest first so «حسن لغيره» wins over «حسن». */
const GRADING_LABELS = [
  'متفق عليه',
  'صحيح لغيره',
  'حسن لغيره',
  'حسن صحيح',
  'صحيح الإسناد',
  'حسن الإسناد',
  'صحيح',
  'حسن',
];
const TAKHRIJ = new RegExp(`^(${GRADING_LABELS.join('|')})\\s*:\\s*(.*)$`);

/**
 * The companion the text opens with, copied verbatim from «عن … » up to a
 * closing particle. Anything that does not match this shape exactly leaves the
 * narrator null — a half-sliced name would be a narrator who never existed.
 */
// NOTE: no \b here — JavaScript word boundaries are ASCII-only, so \b after an
// Arabic particle never matches and would silently disable the whole rule.
const NARRATOR =
  /^عن\s+(.{2,60}?)\s*(?:قالت|قالوا|قال|أنهما|أنها|أنه|أنَّ|أنّ|أن|رضي|يقول|تقول|سمعت|حدَّث|حدث|كان|عن)(?=[\s:،.]|$)/u;
const VERBISH = /(حدَّث|حدث|سمع|قال|قالت|روى|يروي|كان|جاء|ذكر|أخبر|بلغ)/u;

function toWesternDigits(input: string): number | null {
  const digits = input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const n = Number(digits);
  return Number.isInteger(n) ? n : null;
}

function cleanNarrator(candidate: string): string | null {
  const name = candidate.replace(/[،,؛:.\s]+$/u, '').trim();
  if (name === '') return null;
  const words = name.split(/\s+/);
  if (words.length > 6) return null;
  if (/["«»{}()[\]؟!]/u.test(name)) return null;
  if (VERBISH.test(name)) return null;
  return name;
}

interface Heading {
  key: string;
  name: string;
  number: string | null;
}


/**
 * Collections this edition cites in its takhrij lines. A closed list: a name is
 * recorded only when it appears verbatim in the line, and the reference text is
 * the line itself. Numbers inside the line are NOT parsed into references —
 * guessing which number belongs to which collection would be invention.
 */
const COLLECTIONS = [
  'البخاري', 'مسلم', 'أبو داود', 'أبي داود', 'الترمذي', 'النسائي', 'ابن ماجه',
  'أحمد', 'مالك', 'الدارمي', 'ابن حبان', 'ابن خزيمة', 'الحاكم', 'الطبراني',
  'البيهقي', 'الدارقطني', 'أبو يعلى', 'أبي يعلى', 'عبد الرزاق', 'ابن أبي شيبة',
  'الطيالسي', 'البزار', 'الطحاوي', 'سعيد بن منصور', 'الحميدي', 'النسائي في الكبرى',
];

function citedCollections(takhrijLine: string): string[] {
  const found: string[] = [];
  for (const name of COLLECTIONS) {
    if (takhrijLine.includes(name) && !found.includes(name)) found.push(name);
  }
  return found;
}

export const jamiKamilShamelaAdapter: Adapter = {
  name: 'jami_kamil_shamela',
  accepts: ['.txt'],

  parse(input: Buffer, fileName: string): ParseResult {
    const lines = input.toString('utf8').replace(/^﻿/, '').split('\n');
    const warnings: string[] = [];
    const records: SourceRecord[] = [];

    let volume: number | null = null;
    let page: number | null = null;
    let book: Heading | null = null;
    let chapter: Heading | null = null;
    let bookSeq = 0;
    let chapterSeq = 0;
    let ordinal = 0;
    let onPageIndex = 0;
    let lastPageKey = '';
    let decorative = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = (lines[i] as string).trim();
      if (line === '') continue;

      const pageMatch = PAGE.exec(line);
      if (pageMatch) {
        volume = toWesternDigits(pageMatch[1] as string);
        page = toWesternDigits(pageMatch[2] as string);
        continue;
      }

      const bracket = BRACKET_HEAD.exec(line);
      const plain = bracket ? null : PLAIN_HEAD.exec(line);
      if (bracket || plain) {
        const number = (bracket?.[1] ?? plain?.[1]) as string;
        const title = ((bracket?.[2] ?? plain?.[2]) as string).trim();
        if (title.startsWith('كتاب')) {
          bookSeq++;
          book = { key: `${number}-${title}`, name: title, number };
          chapter = null;
        } else {
          chapterSeq++;
          chapter = { key: `${number}-${title}`, name: title, number };
          if (!book) {
            warnings.push(`${fileName}: chapter "${title}" appears before any كتاب heading`);
          }
        }
        continue;
      }

      const bullet = BULLET.exec(line);
      if (!bullet) continue;

      const body = (bullet[1] as string).trim();
      if (/^[*\s]*$/u.test(body)) {
        decorative++;
        continue;
      }

      // The record belongs to the page it STARTS on, even when its text runs
      // over a page break.
      const startVolume = volume;
      const startPage = page;

      // The hadith text runs until the grading/takhrij line, the next hadith,
      // or the next heading. A page marker inside it still moves the cursor —
      // forgetting that made every record after a mid-hadith page break claim
      // the previous page.
      const parts = [body];
      let takhrijLine: string | null = null;
      let j = i + 1;
      for (; j < lines.length; j++) {
        const next = (lines[j] as string).trim();
        if (next === '') continue;
        const innerPage = PAGE.exec(next);
        if (innerPage) {
          volume = toWesternDigits(innerPage[1] as string);
          page = toWesternDigits(innerPage[2] as string);
          continue;
        }
        if (BULLET.test(next) || BRACKET_HEAD.test(next) || PLAIN_HEAD.test(next)) break;
        const takhrij = TAKHRIJ.exec(next);
        if (takhrij) {
          takhrijLine = next;
          break;
        }
        parts.push(next);
      }

      const rawText = parts.join('\n');
      const pageKey = `${startVolume}/${startPage}`;
      if (pageKey !== lastPageKey) {
        lastPageKey = pageKey;
        onPageIndex = 0;
      }
      onPageIndex++;
      ordinal++;

      const record = emptyRecord(rawText);
      record.volume_number = startVolume;
      record.page_number = startPage;
      record.source_locator = `ج${startVolume}/ص${startPage}/#${onPageIndex}`;
      record.source_ordinal = ordinal;
      // This edition prints no serial hadith number; inventing one is forbidden.
      record.hadith_number = null;
      // The source never separates matn from isnad, so neither is claimed.
      record.matn = null;
      record.isnad = null;

      if (takhrijLine) {
        const takhrij = TAKHRIJ.exec(takhrijLine) as RegExpExecArray;
        record.grading = takhrij[1] as string;
        record.takhrij = takhrijLine;
        record.gradings.push({
          grading: takhrij[1] as string,
          grader: 'محمد عبد الله الأعظمي (الضياء)',
          source_reference: record.source_locator,
          notes: null,
        });
        // §13 — the collections the author's takhrij names, verbatim.
        for (const collection of citedCollections(takhrijLine)) {
          record.sources.push({
            source_name: collection,
            reference: takhrijLine,
            reference_number: null,
          });
        }
      } else {
        warnings.push(`${fileName}: no grading line for ${record.source_locator}`);
      }

      // Ordering follows the numbers the book itself prints. A per-file counter
      // would restart at 1 in every volume and scramble the reading order.
      if (book) {
        record.book = {
          key: book.key,
          name: book.name,
          order_number: book.number ? toWesternDigits(book.number) : bookSeq,
        };
      }
      if (chapter) {
        record.chapter = {
          key: chapter.key,
          name: chapter.name,
          chapter_number: chapter.number,
          order_number: chapter.number ? toWesternDigits(chapter.number) : chapterSeq,
          parent_key: null,
        };
      }

      const narratorMatch = NARRATOR.exec(rawText);
      const narratorName = narratorMatch ? cleanNarrator(narratorMatch[1] as string) : null;
      if (narratorName) {
        record.narrator = {
          name: narratorName,
          kunya: null,
          laqab: null,
          biography: null,
          source_reference:
            'مأخوذ حرفيًا من مطلع النص «عن …» في هذه الطبعة — لم يُراجع بشريًا بعد',
        };
      }

      if (startVolume === null || startPage === null) {
        warnings.push(`${fileName}: a hadith appears before any [جN صM] page marker`);
      }

      records.push(record);
      i = j - 1;
    }

    if (decorative > 0) {
      warnings.push(`${fileName}: skipped ${decorative} decorative "• * *" separator lines`);
    }

    return { records, warnings, edition_hint: null };
  },
};
