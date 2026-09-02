/**
 * AI Assistant domain — with the Source Lock guard as a hard boundary.
 *
 * The assistant helps with design, ideas, titles, captions, hashtags, layout
 * and app usage. It NEVER authors religious text: requests for verses/hadiths
 * are routed to the verified engines, and when nothing verified matches, the
 * assistant refuses and asks for a source. This guard runs CLIENT-SIDE before
 * any provider (local or remote) — and the remote system prompt repeats it.
 */
import { searchQuran } from '@features/quran/data/quranRepository';
import { surahByNumber } from '@features/quran/data/quranRepository';
import { searchHadiths } from '@features/hadith/data/hadithRepository';

export type AssistantRole = 'user' | 'assistant';

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  text: string;
  /** Verified references attached by the source-lock router. */
  references?: SacredReference[];
  createdAt: string;
}

export interface SacredReference {
  kind: 'quran' | 'hadith';
  title: string;
  text: string;
  sourceName: string;
  /** Deep link into the create flow. */
  href: string;
}

/**
 * Canonical refusal texts — Master Directive v2, Appendix (هـ). Verbatim;
 * never reworded. A trailing hint may follow, the canonical sentence leads.
 */
export const REFUSALS = {
  noSource: 'لم أجد مصدرًا موثوقًا كافيًا للتحقق.',
  fatwa: 'هذا خارج نطاق المساعد. يمكنك الرجوع إلى جهة إفتاء معتمدة.',
  editSacred: 'لا يمكن تعديل النص الشرعي؛ يمكنني تعديل التصميم أو الصياغة المصاحبة فقط.',
} as const;

/** Detects fatwa / religious-ruling requests (always refused — v2 §7, §17). */
export function asksForFatwa(prompt: string): boolean {
  return [
    /فتوى|فتاوى|أفتني|افتني/,
    /هل يجوز|هل يجب|هل يحرم|أيجوز/,
    /ما حكم|حكم الشرع|حكم الدين|الحكم الشرعي/,
    /حلال أم حرام|حرام أم حلال|حلال ولا حرام/,
    /\bfatwa\b|is it (haram|halal|permissible)/i,
  ].some((p) => p.test(prompt));
}

/** Detects requests to alter sacred text (rewording, shortening, "simplifying"). */
export function asksToAlterSacred(prompt: string): boolean {
  // Deliberately verb-specific: bare «غير»/«عدل» are common non-alteration words
  // (negation, "justice"), so only explicit alteration forms match.
  const alter =
    /(^|\s)(عدّل|غيّر|حرّف|اختصر|بسّط)\s|تعديل|تحريف|إعادة صياغة|أعد صياغة|اعد صياغة|احذف كلمة|أضف كلمة|paraphrase|reword|shorten|simplify/i;
  const sacred =
    /الآية|آية|الحديث|حديث|السورة|سورة|النص القرآني|النص الشرعي|verse|ayah|hadith|surah/i;
  return alter.test(prompt) && sacred.test(prompt);
}

/** Detects prompts that ask the model to produce religious text. */
export function asksForSacredText(prompt: string): boolean {
  const patterns = [
    /آية|آيات|سورة|قرآن|القرآن/,
    /حديث|أحاديث|البخاري|مسلم|النبي|الرسول ﷺ?/,
    /أذكار|ذكر|دعاء|أدعية/,
    /verse|ayah|surah|quran|hadith|dua|dhikr/i,
  ];
  return patterns.some((p) => p.test(prompt));
}

/** Try to satisfy a sacred-text request from VERIFIED sources only. */
export async function findVerifiedReferences(prompt: string): Promise<SacredReference[]> {
  const references: SacredReference[] = [];
  const quranResults = await searchQuran(prompt, 3);
  for (const result of quranResults) {
    references.push({
      kind: 'quran',
      title: `سورة ${result.surahName} — الآية ${result.ayah.ayah}`,
      text: result.ayah.text,
      sourceName: result.ayah.source.source_name,
      href: `/create/quran?surah=${result.ayah.surah}&ayah=${result.ayah.ayah}`,
    });
  }
  const hadithResults = await searchHadiths(prompt, 2);
  for (const hadith of hadithResults) {
    references.push({
      kind: 'hadith',
      title: `${hadith.book ?? ''} — حديث ${hadith.number}`,
      text: hadith.arabic.length > 220 ? `${hadith.arabic.slice(0, 220)}…` : hadith.arabic,
      sourceName: hadith.source.source_name,
      href: `/create/hadith?id=${hadith.id}`,
    });
  }
  return references;
}

/** Extract a usable search phrase from a sacred-text prompt (best effort). */
export function extractSearchPhrase(prompt: string): string {
  const cleaned = prompt
    .replace(/^(اكتب|أعطني|اعطني|ابحث عن|أريد|اريد|هات|ما هي|ما هو)\s+/g, '')
    .replace(/(آية|حديث|سورة|عن|حول)\s+/g, ' ')
    .trim();
  return cleaned.length >= 3 ? cleaned : prompt;
}

/** Reference: verify a surah/ayah citation is structurally valid before display. */
export function isValidCitation(surah: number, ayah: number): boolean {
  const meta = surahByNumber(surah);
  return meta !== null && ayah >= 1 && ayah <= meta.ayahCount;
}
