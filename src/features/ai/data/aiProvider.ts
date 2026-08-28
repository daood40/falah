/**
 * Assistant providers.
 * - LocalAssistantProvider: deterministic, offline, zero-cost — always available.
 * - RemoteAssistantProvider: Supabase Edge Function `ai-assistant` backed by the
 *   Anthropic API (key stays server-side). Falls back to local when unconfigured.
 * Cost control: short context window (last 6 turns), compact prompts, and the
 *   local provider answers common questions without any API call.
 */
import { hasSupabase, supabase } from '@core/supabase/client';
import { newId } from '@core/utils/id';
import type { AssistantMessage } from '../domain/assistant';
import {
  REFUSALS,
  asksForFatwa,
  asksForSacredText,
  asksToAlterSacred,
  extractSearchPhrase,
  findVerifiedReferences,
} from '../domain/assistant';

export interface AssistantProvider {
  readonly id: string;
  reply(history: AssistantMessage[], userText: string): Promise<AssistantMessage>;
}

function message(text: string, references?: AssistantMessage['references']): AssistantMessage {
  return { id: newId(), role: 'assistant', text, references, createdAt: new Date().toISOString() };
}

/* ---------- Source Lock router (shared by all providers) ---------- */

export async function sourceLockRouter(userText: string): Promise<AssistantMessage | null> {
  // Canonical refusals (v2 Appendix هـ) come first: fatwa and sacred-text
  // alteration are refused outright, never searched.
  if (asksForFatwa(userText)) return message(REFUSALS.fatwa);
  if (asksToAlterSacred(userText)) return message(REFUSALS.editSacred);
  if (!asksForSacredText(userText)) return null;
  const references = await findVerifiedReferences(extractSearchPhrase(userText));
  if (references.length === 0) {
    return message(
      `${REFUSALS.noSource}\nلا أؤلف نصًا دينيًا من عندي — جرّب البحث برقم الآية (مثل ٢:٢٥٥) أو بكلمات من النص نفسه.`,
    );
  }
  return message(
    'وجدت هذه النصوص في المصادر الموثقة — اختر منها لفتحه في المحرر. (لا أؤلف نصوصًا دينية بنفسي أبدًا):',
    references,
  );
}

/* ---------- Local provider ---------- */

interface LocalRule {
  test: RegExp;
  answer: string;
}

const LOCAL_RULES: LocalRule[] = [
  {
    test: /أبعاد|مقاس|حجم|dimensions|size|ريلز|reels|شورت|short|ستوري|story/i,
    answer:
      'الأبعاد الموصى بها:\n• Reels / TikTok / Shorts / Story: ‏9:16 (1080×1920)\n• منشور Instagram: ‏1:1 (1080×1080)\n• Facebook: ‏4:5 (1080×1350)\n• YouTube عريض: ‏16:9 (1920×1080)\nتجدها كلها جاهزة في شاشة «إنشاء المحتوى».',
  },
  {
    test: /هاشتاق|هاشتاغ|وسوم|hashtag/i,
    answer:
      'هاشتاقات مقترحة للمحتوى القرآني:\n#قرآن #تلاوة #آية_اليوم #تدبر #اذكار #إسلام #دين #Quran #Islam #IslamicReminders\nنصيحة: اجمع بين 3-5 وسوم عامة و3-5 متخصصة بموضوع منشورك.',
  },
  {
    test: /فكرة|أفكار|اقتراح|ideas?|رمضان|جمعة/i,
    answer:
      'أفكار محتوى تنجح غالبًا:\n1. سلسلة «آية وتدبر» — آية قصيرة مع سؤال للجمهور.\n2. حديث الأسبوع بتصميم ثابت الهوية.\n3. عدّ تنازلي لرمضان أو يوم الجمعة (جدولة تلقائية من فلاح).\n4. Reel قصير: آية بصوت قارئ مع خلفية هادئة.\n5. «اسم من أسماء الله» أسبوعيًا بتصميم موحد.\nكل النصوص الدينية تُختار من المصادر الموثقة داخل التطبيق.',
  },
  {
    test: /عنوان|عناوين|title/i,
    answer:
      'قواعد العنوان الجيد: قصير (٣-٦ كلمات)، يبدأ بكلمة قوية، ويعد بفائدة.\nأمثلة قوالب: «وقفة مع آية…»، «هل تدبرت هذه الآية؟»، «سُنة مهجورة»، «دقيقة إيمانية».\nأرسل لي موضوع منشورك وسأقترح عناوين مخصصة.',
  },
  {
    test: /لون|ألوان|colors?|palette/i,
    answer:
      'لوحات ألوان تناسب المحتوى الإسلامي:\n• كلاسيكي: أخضر داكن ‎#083b2d‎ + ذهبي ‎#d4af37‎ + أبيض كريمي.\n• هادئ: أزرق ليلي + رملي فاتح.\n• عصري: أسود فحمي + أخضر زمردي.\nاجعل التباين عاليًا بين النص والخلفية، والمحرر يدعم التدرجات.',
  },
  {
    test: /كيف|طريقة|شرح|استخدام|how|help|مساعدة/i,
    answer:
      'خطوات إنشاء منشور في فلاح:\n1. من شريط التنقل اختر «إنشاء».\n2. اختر القرآن أو الحديث ثم ابحث عن النص.\n3. اختر أبعاد المنصة، ثم «افتح في المحرر».\n4. عدّل الخلفية والخط والألوان (النص الديني نفسه محمي من التعديل).\n5. احفظ في مكتبتك، وصدّر PNG أو أنشئ فيديو، أو جدوله للنشر.',
  },
  {
    test: /خط|فونت|font/i,
    answer:
      'الخطوط داخل فلاح:\n• «Amiri Quran» مخصص للنص القرآني.\n• «Scheherazade New» ممتاز للأحاديث.\n• «Cairo» للعناوين والنصوص العامة.\nللقراءة المريحة اجعل سطر الآية أكبر من الترجمة بمرة ونصف تقريبًا.',
  },
];

export class LocalAssistantProvider implements AssistantProvider {
  readonly id = 'local';

  async reply(_history: AssistantMessage[], userText: string): Promise<AssistantMessage> {
    const guarded = await sourceLockRouter(userText);
    if (guarded) return guarded;
    const rule = LOCAL_RULES.find((r) => r.test.test(userText));
    if (rule) return message(rule.answer);
    return message(
      'أستطيع مساعدتك في: أفكار المحتوى، العناوين، الوصف، الهاشتاقات، الألوان، التخطيط، وأبعاد المنصات، وشرح استخدام فلاح.\nأما النصوص الدينية فأجلبها حصريًا من المصادر الموثقة — اكتب مثلًا: «ابحث عن آية الكرسي» أو «حديث النية».',
    );
  }
}

/* ---------- Remote provider (Anthropic via Edge Function) ---------- */

export class RemoteAssistantProvider implements AssistantProvider {
  readonly id = 'remote';
  private readonly fallback = new LocalAssistantProvider();

  async reply(history: AssistantMessage[], userText: string): Promise<AssistantMessage> {
    const guarded = await sourceLockRouter(userText);
    if (guarded) return guarded;
    if (!hasSupabase()) return this.fallback.reply(history, userText);
    try {
      // Cost control: only the last 6 turns travel to the server.
      const context = history.slice(-6).map((m) => ({ role: m.role, text: m.text }));
      const { data, error } = await supabase().functions.invoke('ai-assistant', {
        body: { messages: context, userText },
      });
      if (error || typeof data?.reply !== 'string') {
        return this.fallback.reply(history, userText);
      }
      return message(data.reply);
    } catch {
      return this.fallback.reply(history, userText);
    }
  }
}

export function defaultAssistantProvider(): AssistantProvider {
  return hasSupabase() ? new RemoteAssistantProvider() : new LocalAssistantProvider();
}
