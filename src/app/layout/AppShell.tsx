/** App shell: header (☰ drawer), RTL bottom navigation, offline banner. */
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useI18n, LOCALES } from '@core/i18n';
import { useTheme, type ThemeMode } from '@core/theme/theme';
import { ToastHost, toast } from '@core/ui/Toast';
import { Modal } from '@core/ui/primitives';
import { useAuth } from '@features/auth/authStore';
import './layout.css';

/** Bottom nav — order in source is RTL-visual order via flex + dir. */
const NAV_ITEMS = [
  { to: '/', icon: '🏠', key: 'nav.home' },
  { to: '/assistant', icon: '✨', key: 'nav.ai' },
  { to: '/create', icon: '＋', key: 'nav.create', create: true },
  { to: '/library', icon: '🗂️', key: 'nav.library' },
  { to: '/settings', icon: '⚙️', key: 'nav.settings' },
];

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useI18n((s) => s.t);
  const { locale, setLocale } = useI18n();
  const { mode, setMode } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  if (!open) return null;
  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <>
      <div className="fl-overlay" style={{ padding: 0 }} onClick={onClose} />
      <nav className="drawer" aria-label={t('common.menu')}>
        <div className="fl-row" style={{ marginBottom: 'var(--fl-sp-3)' }}>
          <span className="shell__brand fl-grow">
            <span aria-hidden>🕌</span> {t('app.name')}
          </span>
          <button
            className="fl-btn fl-btn--ghost fl-btn--icon"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        <div className="fl-card" style={{ marginBottom: 'var(--fl-sp-3)' }}>
          <strong>{user ? user.displayName : t('auth.welcome')}</strong>
          <div className="fl-muted">{user?.email ?? t('auth.localMode')}</div>
        </div>

        <div className="drawer__section">{t('menu.account')}</div>
        <button className="drawer__item" onClick={() => go('/settings')}>
          👤 {t('menu.profile')}
        </button>
        <button className="drawer__item" onClick={() => go('/settings')}>
          💳 {t('menu.subscription')}
        </button>
        <button className="drawer__item" onClick={() => go('/settings')}>
          🔔 {t('menu.notifications')}
        </button>

        <div className="drawer__section">{t('menu.theme')}</div>
        <div className="fl-row fl-wrap" role="radiogroup" aria-label={t('menu.theme')}>
          {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => (
            <button
              key={m}
              className={`fl-chip ${mode === m ? 'fl-chip--active' : ''}`}
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
            >
              {t(`settings.theme.${m}`)}
            </button>
          ))}
        </div>

        <div className="drawer__section">{t('menu.language')}</div>
        <div className="fl-row fl-wrap" role="radiogroup" aria-label={t('menu.language')}>
          {LOCALES.map((l) => (
            <button
              key={l.code}
              className={`fl-chip ${locale === l.code ? 'fl-chip--active' : ''}`}
              role="radio"
              aria-checked={locale === l.code}
              onClick={() => setLocale(l.code)}
            >
              {l.nativeName}
            </button>
          ))}
        </div>

        <div className="drawer__section">{t('settings.help')}</div>
        <button className="drawer__item" onClick={() => go('/settings#help')}>
          ❓ {t('menu.help')}
        </button>
        <button className="drawer__item" onClick={() => go('/settings#about')}>
          🕌 {t('menu.about')}
        </button>
        <button className="drawer__item" onClick={() => go('/settings#privacy')}>
          🛡️ {t('menu.privacy')}
        </button>
        <button className="drawer__item" onClick={() => go('/settings#terms')}>
          📄 {t('menu.terms')}
        </button>

        <div style={{ flex: 1 }} />
        {user ? (
          <button
            className="drawer__item"
            style={{ color: 'var(--fl-danger)' }}
            onClick={async () => {
              await signOut();
              toast('info', t('auth.loggedOut'));
              onClose();
            }}
          >
            🚪 {t('menu.logout')}
          </button>
        ) : (
          <button className="drawer__item" onClick={() => go('/auth')}>
            🔑 {t('menu.login')}
          </button>
        )}
      </nav>
    </>
  );
}

export function AppShell() {
  const t = useI18n((s) => s.t);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const online = useOnline();
  const { user, initializing, continueLocal } = useAuth();
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  useEffect(() => {
    if (!initializing && !user) setWelcomeOpen(true);
  }, [initializing, user]);

  return (
    <div className="shell">
      <div className="shell__body">
        <header className="shell__header">
          <button
            className="fl-btn fl-btn--ghost fl-btn--icon"
            aria-label={t('common.menu')}
            onClick={() => setDrawerOpen(true)}
          >
            ☰
          </button>
          <span className="shell__brand">
            <span aria-hidden>🕌</span> {t('app.name')}
          </span>
        </header>
        {!online && <div className="offline-banner">{t('common.offline')}</div>}
        <main className="shell__main">
          <Outlet />
        </main>
      </div>

      <nav className="shell__nav" aria-label={t('common.menu')}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={`shell__nav-item ${item.create ? 'shell__nav-item--create' : ''}`}
          >
            <span className="shell__nav-icon" aria-hidden>
              {item.icon}
            </span>
            {t(item.key)}
          </NavLink>
        ))}
      </nav>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <ToastHost />

      <Modal open={welcomeOpen} onClose={() => setWelcomeOpen(false)} title={t('auth.welcome')}>
        <p className="fl-muted" style={{ marginBottom: 'var(--fl-sp-4)' }}>
          {t('app.tagline')}
        </p>
        <p style={{ marginBottom: 'var(--fl-sp-4)' }}>{t('auth.localModeDesc')}</p>
        <div className="fl-col">
          <button
            className="fl-btn fl-btn--primary"
            onClick={async () => {
              await continueLocal();
              setWelcomeOpen(false);
            }}
          >
            {t('auth.continueLocal')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
