/** AI assistant chat — design help only; sacred text comes from verified sources. */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@core/i18n';
import { newId } from '@core/utils/id';
import { useAuth } from '@features/auth/authStore';
import { IconAiChat, IconFalah } from '@core/ui/icons';
import { entitlementsFor } from '@core/entitlements/entitlements';
import type { AssistantMessage } from '../domain/assistant';
import { defaultAssistantProvider } from '../data/aiProvider';
import './assistant.css';

const provider = defaultAssistantProvider();
const SUGGESTIONS = ['ai.sug1', 'ai.sug2', 'ai.sug3', 'ai.sug4'];

export function AiAssistantPage() {
  const t = useI18n((s) => s.t);
  const { user } = useAuth();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [usedToday, setUsedToday] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  const limit = entitlementsFor(user?.plan ?? 'free').ai_messages_per_day;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || busy || usedToday >= limit) return;
    const userMessage: AssistantMessage = {
      id: newId(),
      role: 'user',
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMessage]);
    setInput('');
    setBusy(true);
    setUsedToday((n) => n + 1);
    try {
      const reply = await provider.reply([...messages, userMessage], trimmed);
      setMessages((m) => [...m, reply]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="assistant">
      <header className="assistant__head">
        <h1 className="fl-title fl-row" style={{ gap: 'var(--fl-sp-2)' }}>
          <span className="assistant__brandicon" aria-hidden>
            <IconFalah size={18} />
          </span>
          {t('ai.title')}
        </h1>
      </header>

      <div className="assistant__log" role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="assistant__welcome">
            <span className="assistant__welcome-icon" aria-hidden>
              <IconAiChat size={34} />
            </span>
            <h2>{t('ai.welcomeTitle')}</h2>
            <p className="fl-muted">{t('ai.welcomeText')}</p>
            <div className="assistant__sugs">
              {SUGGESTIONS.map((key) => (
                <button key={key} className="fl-chip" onClick={() => send(t(key))}>
                  {t(key)}
                </button>
              ))}
            </div>
            <p className="fl-muted assistant__disclaimer">{t('ai.disclaimer')}</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`assistant__msg assistant__msg--${m.role}`}>
            <p style={{ whiteSpace: 'pre-wrap' }}>{m.text}</p>
            {m.references && (
              <div className="fl-col" style={{ marginTop: 'var(--fl-sp-2)' }}>
                {m.references.map((ref, i) => (
                  <Link key={i} to={ref.href} className="fl-card assistant__ref">
                    <strong>{ref.title}</strong>
                    <p className="fl-naskh" dir="rtl">
                      {ref.text}
                    </p>
                    <span className="fl-badge fl-badge--verified">{ref.sourceName}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="assistant__msg assistant__msg--assistant fl-muted">…</div>}
        <div ref={endRef} />
      </div>

      <form
        className="assistant__composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          className="fl-input fl-grow"
          value={input}
          placeholder={t('ai.placeholder')}
          onChange={(e) => setInput(e.target.value)}
          aria-label={t('ai.placeholder')}
        />
        <button
          className="fl-btn fl-btn--primary"
          type="submit"
          disabled={busy || input.trim().length === 0}
        >
          {t('ai.send')}
        </button>
      </form>
    </div>
  );
}
