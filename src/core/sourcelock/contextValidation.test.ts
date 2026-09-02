/** Context Validation (v2 §14.1) against the real verified Quran text. */
import { describe, expect, it } from 'vitest';
import { getAyah } from '@features/quran/data/quranRepository';
import { checkContext } from './contextValidation';

async function text(surah: number, ayah: number): Promise<string> {
  const a = await getAyah(surah, ayah);
  if (!a) throw new Error(`missing ${surah}:${ayah}`);
  return a.text;
}

describe('checkContext', () => {
  it('warns when the next ayah opens an exception (Al-Asr 103:2 alone)', async () => {
    const warnings = checkContext({
      firstText: await text(103, 2),
      nextText: await text(103, 3),
      hasPrev: true,
    });
    expect(warnings).toContainEqual({ extend: 'after', reason: 'exception' });
  });

  it('warns when the next ayah is a relative clause (Al-Maun 107:4 alone)', async () => {
    const warnings = checkContext({
      firstText: await text(107, 4),
      nextText: await text(107, 5),
      hasPrev: true,
    });
    expect(warnings).toContainEqual({ extend: 'after', reason: 'relative' });
  });

  it('warns when the selection itself opens with the exception (103:3 alone)', async () => {
    const warnings = checkContext({
      firstText: await text(103, 3),
      nextText: undefined,
      hasPrev: true,
    });
    expect(warnings).toContainEqual({ extend: 'before', reason: 'exception' });
  });

  it('suppresses the before-warning at the start of a surah', async () => {
    const warnings = checkContext({
      firstText: await text(103, 3),
      nextText: undefined,
      hasPrev: false,
    });
    expect(warnings).toHaveLength(0);
  });

  it('stays silent on self-contained selections (Ayat al-Kursi 2:255)', async () => {
    const warnings = checkContext({
      firstText: await text(2, 255),
      nextText: await text(2, 256),
      hasPrev: true,
    });
    expect(warnings).toHaveLength(0);
  });

  it('does not confuse the interrogative opener with the exception', () => {
    // «ألا» (hamza above) must not match the «إلا» rule.
    const warnings = checkContext({ firstText: 'أَلَا بِذِكۡرِ', hasPrev: true });
    expect(warnings).toHaveLength(0);
  });
});
