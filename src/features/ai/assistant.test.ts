/** AI assistant: the source-lock guard must intercept sacred-text requests. */
import { describe, expect, it } from 'vitest';
import { REFUSALS, asksForSacredText, isValidCitation } from './domain/assistant';
import { LocalAssistantProvider, sourceLockRouter } from './data/aiProvider';

describe('assistant source-lock guard', () => {
  it('detects sacred-text prompts', () => {
    expect(asksForSacredText('اكتب لي آية عن الصبر')).toBe(true);
    expect(asksForSacredText('هات حديثًا عن النية')).toBe(true);
    expect(asksForSacredText('write me a hadith about patience')).toBe(true);
    expect(asksForSacredText('اقترح ألوانًا لتصميمي')).toBe(false);
  });

  it('routes verified matches instead of generating text', async () => {
    const reply = await sourceLockRouter('ابحث عن آية قل هو الله أحد');
    expect(reply).not.toBeNull();
    expect(reply!.references!.length).toBeGreaterThan(0);
    expect(reply!.references![0]!.sourceName).toContain('Tanzil');
  });

  it('REFUSES when no verified source matches (never invents)', async () => {
    const reply = await sourceLockRouter('اكتب لي آية غير موجودة عن المركبات الفضائية');
    expect(reply).not.toBeNull();
    expect(reply!.references ?? []).toHaveLength(0);
    expect(reply!.text).toContain(REFUSALS.noSource);
  });

  it('RED: refuses fatwa requests with the canonical Appendix (هـ) text', async () => {
    const reply = await sourceLockRouter('ما حكم الاستماع للتلاوة أثناء العمل؟ هل يجوز؟');
    expect(reply).not.toBeNull();
    expect(reply!.text).toBe(REFUSALS.fatwa);
    expect(reply!.references ?? []).toHaveLength(0);
  });

  it('RED: refuses requests to alter sacred text (never rewords)', async () => {
    const reply = await sourceLockRouter('اختصر الآية 2:255 وأعد صياغة الحديث بلغة أبسط');
    expect(reply).not.toBeNull();
    expect(reply!.text).toBe(REFUSALS.editSacred);
    expect(reply!.references ?? []).toHaveLength(0);
  });

  it('local provider answers design questions', async () => {
    const provider = new LocalAssistantProvider();
    const reply = await provider.reply([], 'ما أفضل أبعاد لريلز؟');
    expect(reply.text).toContain('9:16');
  });

  it('validates citations structurally', () => {
    expect(isValidCitation(2, 255)).toBe(true);
    expect(isValidCitation(2, 999)).toBe(false);
    expect(isValidCitation(115, 1)).toBe(false);
  });
});
