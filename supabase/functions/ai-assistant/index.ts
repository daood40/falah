/**
 * FALAH AI Assistant — Supabase Edge Function (Deno).
 *
 * Keeps the Anthropic API key server-side. Deploy with:
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *   supabase functions deploy ai-assistant
 *
 * Source Lock is enforced twice: the client routes sacred-text requests to the
 * verified engines before ever calling this function, and the system prompt
 * below forbids the model from authoring religious text as defense in depth.
 */
import Anthropic from 'npm:@anthropic-ai/sdk';

const SYSTEM_PROMPT = `أنت "مساعد فلاح" داخل تطبيق فلاح لصناعة المحتوى الإسلامي.

مهامك المسموحة فقط:
- اقتراح أفكار محتوى وعناوين ووصف منشورات وهاشتاقات.
- نصائح تصميم: ألوان، خطوط، تخطيط، أبعاد المنصات.
- شرح استخدام التطبيق (البحث، المحرر، الفيديو، الجدولة، المكتبة).
- تنظيم وتحويل تنسيق محتوى قدمه المستخدم.

قاعدة صارمة لا استثناء لها (SOURCE LOCK):
لا تكتب أبدًا نص آية أو حديث أو ذِكر أو دعاء مأثور أو تفسير من ذاكرتك،
ولا تنسب قولًا لعالم، ولا تذكر درجة حديث أو رقم آية من ذاكرتك.
إذا طُلب منك نص ديني: اطلب من المستخدم استخدام البحث الموثق داخل التطبيق
(شاشة إنشاء المحتوى) واشرح أن النصوص تأتي حصريًا من مصادر موثقة.

أجب بالعربية ما لم يكتب المستخدم بالإنجليزية. كن موجزًا وعمليًا.`;

interface TurnPayload {
  role: 'user' | 'assistant';
  text: string;
}

Deno.serve(async (req: Request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return Response.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 503, headers: cors },
      );
    }
    const { messages = [], userText } = (await req.json()) as {
      messages: TurnPayload[];
      userText: string;
    };
    if (typeof userText !== 'string' || userText.length === 0 || userText.length > 4000) {
      return Response.json({ error: 'Invalid userText' }, { status: 400, headers: cors });
    }

    const client = new Anthropic({ apiKey });
    const history = messages
      .slice(-6)
      .map((m) => ({ role: m.role, content: String(m.text).slice(0, 2000) }));

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [...history, { role: 'user', content: userText }],
    });

    if (response.stop_reason === 'refusal') {
      return Response.json(
        { reply: 'لا أستطيع المساعدة في هذا الطلب.' },
        { headers: cors },
      );
    }
    const reply = response.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    return Response.json({ reply }, { headers: cors });
  } catch (error) {
    console.error('[ai-assistant]', error);
    return Response.json({ error: 'assistant_failed' }, { status: 500, headers: cors });
  }
});
