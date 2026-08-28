/** Auth: Supabase email/password when configured; honest local mode otherwise. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@core/i18n';
import { hasSupabase } from '@core/supabase/client';
import { Field } from '@core/ui/primitives';
import { toast } from '@core/ui/Toast';
import { reportError } from '@core/errors/errors';
import { useAuth } from './authStore';

export function AuthPage() {
  const t = useI18n((s) => s.t);
  const navigate = useNavigate();
  const { signIn, signUp, continueLocal } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast('error', t('errors.validation'));
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') await signIn(email, password);
      else await signUp(email, password);
      navigate('/');
    } catch (error) {
      reportError(error, 'auth');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fl-col" style={{ maxWidth: 440, margin: '0 auto', gap: 'var(--fl-sp-4)' }}>
      <h1 className="fl-title" style={{ textAlign: 'center' }}>
        {t('auth.welcome')}
      </h1>

      {hasSupabase() ? (
        <form className="fl-card fl-col" onSubmit={submit}>
          <div className="fl-row">
            <button
              type="button"
              className={`fl-chip ${mode === 'login' ? 'fl-chip--active' : ''}`}
              onClick={() => setMode('login')}
            >
              {t('auth.login')}
            </button>
            <button
              type="button"
              className={`fl-chip ${mode === 'signup' ? 'fl-chip--active' : ''}`}
              onClick={() => setMode('signup')}
            >
              {t('auth.signup')}
            </button>
          </div>
          <Field label={t('auth.email')}>
            <input
              className="fl-input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label={t('auth.password')}>
            <input
              className="fl-input"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button className="fl-btn fl-btn--primary" type="submit" disabled={busy}>
            {busy ? t('common.loading') : mode === 'login' ? t('auth.login') : t('auth.signup')}
          </button>
        </form>
      ) : (
        <div className="fl-card fl-col">
          <p className="fl-muted">{t('auth.localModeDesc')}</p>
          <button
            className="fl-btn fl-btn--primary"
            onClick={async () => {
              await continueLocal();
              navigate('/');
            }}
          >
            {t('auth.continueLocal')}
          </button>
        </div>
      )}
    </div>
  );
}
