/** App shell: header (menu drawer), RTL bottom navigation, offline banner, audio bar. */
import { useEffect, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useI18n, LOCALES } from '@core/i18n';
import { useTheme, type ThemeMode } from '@core/theme/theme';
import { ToastHost, toast } from '@core/ui/Toast';
import { Modal } from '@core/ui/primitives';
import {
  IconBell,
  IconCalendar,
  IconCard,
  IconClose,
  IconFalah,
  IconFile,
  IconHelp,
  IconHome,
  IconLibrary,
  IconLogin,
  IconLogout,
  IconMenu,
  IconMonitor,
  IconMoon,
  IconMosque,
  IconPlus,
  IconRepeat,
  IconSearch,
  IconSettings,
  IconShield,
  IconSparkles,
  IconSun,
  IconUser,
  type IconProps,
} from '@core/ui/icons';
import { useAuth } from '@features/auth/authStore';
import { useNotifications } from '@core/notifications/notifications';
import { AudioBar } from '@features/audio/AudioBar';
import './layout.css';

interface NavItem {
  to: string;
  icon: ComponentType<IconProps>;
  key: string;
  create?: boolean;
}

/** Bottom nav — order in source is RTL-visual order via flex + dir. */
const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: IconHome, key: 'nav.home' },
  { to: '/assistant', icon: IconSparkles, key: 'nav.ai' },
  { to: '/create', icon: IconPlus, key: 'nav.create', create: true },
  { to: '/library', icon: IconLibrary, key: 'nav.library' },
  { to: '/publish', icon: IconCalendar, key: 'nav.publish' },
  { to: '/settings', icon: IconSettings, key: 'nav.settings' },
];

const THEME_ICONS: Record<ThemeMode, ComponentType<IconProps>> = {
  light: IconSun,
  dark: IconMoon,
  system: IconMonitor,
};

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

function DrawerItem({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: ComponentType<IconProps>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className="drawer__item"
      style={danger ? { color: 'var(--fl-danger)' } : undefined}
      onClick={onClick}
    >
      <Icon size={19} /> {label}
    </button>
  );
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
            <span className="shell__logo" aria-hidden>
              <IconFalah size={20} />
            </span>
            {t('app.name')}
          </span>
          <button
            className="fl-btn fl-btn--ghost fl-btn--icon"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <IconClose size={18} />
          </button>
        </div>

        <div className="fl-card" style={{ marginBottom: 'var(--fl-sp-3)' }}>
          <strong>{user ? user.displayName : t('auth.welcome')}</strong>
          <div className="fl-muted">{user?.email ?? t('auth.localMode')}</div>
        </div>

        <div className="drawer__section">{t('menu.account')}</div>
        <DrawerItem icon={IconUser} label={t('menu.profile')} onClick={() => go('/settings')} />
        <DrawerItem
          icon={IconCard}
          label={t('menu.subscription')}
          onClick={() => go('/settings')}
        />
        <DrawerItem
          icon={IconBell}
          label={t('menu.notifications')}
          onClick={() => go('/settings')}
        />

        <div className="drawer__section">{t('menu.tools')}</div>
        <DrawerItem icon={IconRepeat} label={t('tasbih.title')} onClick={() => go('/tasbih')} />

        <div className="drawer__section">{t('menu.theme')}</div>
        <div className="fl-row fl-wrap" role="radiogroup" aria-label={t('menu.theme')}>
          {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => {
            const ThemeIcon = THEME_ICONS[m];
            return (
              <button
                key={m}
                className={`fl-chip ${mode === m ? 'fl-chip--active' : ''}`}
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
              >
                <ThemeIcon size={15} /> {t(`settings.theme.${m}`)}
              </button>
            );
          })}
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
        <DrawerItem icon={IconHelp} label={t('menu.help')} onClick={() => go('/settings#help')} />
        <DrawerItem
          icon={IconMosque}
          label={t('menu.about')}
          onClick={() => go('/settings#about')}
        />
        <DrawerItem
          icon={IconShield}
          label={t('menu.privacy')}
          onClick={() => go('/settings#privacy')}
        />
        <DrawerItem icon={IconFile} label={t('menu.terms')} onClick={() => go('/settings#terms')} />

        <div style={{ flex: 1 }} />
        {user ? (
          <DrawerItem
            icon={IconLogout}
            label={t('menu.logout')}
            danger
            onClick={() => {
              void signOut().then(() => {
                toast('info', t('auth.loggedOut'));
                onClose();
              });
            }}
          />
        ) : (
          <DrawerItem icon={IconLogin} label={t('menu.login')} onClick={() => go('/auth')} />
        )}
      </nav>
    </>
  );
}

export function AppShell() {
  const t = useI18n((s) => s.t);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const online = useOnline();
  const { user, initializing, continueLocal } = useAuth();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifications = useNotifications();

  useEffect(() => {
    if (!initializing && !user) setWelcomeOpen(true);
    if (user) void notifications.refresh(user.id);
    // notifications.refresh is stable (zustand); depending on user/init is intentional.
  }, [initializing, user]);

  const openNotifications = () => {
    setNotifOpen(true);
    if (user) void notifications.markAllRead(user.id);
  };

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        {t('common.skipToContent')}
      </a>
      <div className="shell__body">
        <header className="shell__header">
          <button
            className="fl-btn fl-btn--ghost fl-btn--icon"
            aria-label={t('common.menu')}
            onClick={() => setDrawerOpen(true)}
          >
            <IconMenu size={20} />
          </button>
          <span className="shell__brand">
            <span className="shell__logo" aria-hidden>
              <IconFalah size={20} />
            </span>
            {t('app.name')}
          </span>
          <span className="fl-grow" />
          <form
            className="shell__search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const q = searchQuery.trim();
              if (q) {
                navigate(`/create/quran?q=${encodeURIComponent(q)}`);
                setSearchQuery('');
              }
            }}
          >
            <IconSearch size={16} aria-hidden />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="search"
              placeholder={t('shell.search')}
              aria-label={t('shell.search')}
            />
          </form>
          <button
            className="fl-btn fl-btn--ghost fl-btn--icon shell__bell"
            aria-label={t('notifications.title')}
            onClick={openNotifications}
          >
            <IconBell size={20} />
            {notifications.unread > 0 && (
              <span className="shell__bell-badge">{Math.min(notifications.unread, 99)}</span>
            )}
          </button>
        </header>
        {!online && <div className="offline-banner">{t('common.offline')}</div>}
        <main id="main" className="shell__main">
          <Outlet />
        </main>
      </div>

      <nav className="shell__nav" aria-label={t('common.menu')}>
        {NAV_ITEMS.map((item) => {
          const ItemIcon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={`shell__nav-item ${item.create ? 'shell__nav-item--create' : ''}`}
            >
              <span className="shell__nav-icon" aria-hidden>
                <ItemIcon size={item.create ? 24 : 21} />
              </span>
              {t(item.key)}
            </NavLink>
          );
        })}
      </nav>

      <AudioBar />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <ToastHost />

      <Modal
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        title={t('notifications.title')}
        sheet
      >
        {notifications.items.length === 0 ? (
          <p className="fl-muted" style={{ textAlign: 'center', padding: 'var(--fl-sp-5)' }}>
            {t('notifications.empty')}
          </p>
        ) : (
          <div className="fl-col">
            {notifications.items.map((n) => (
              <div key={n.id} className="fl-card fl-row" style={{ padding: 'var(--fl-sp-3)' }}>
                <span
                  className={`fl-badge ${n.kind === 'publish_failed' ? 'fl-badge--blocked' : 'fl-badge--verified'}`}
                >
                  {t(n.titleKey)}
                </span>
                <span className="fl-grow" style={{ fontSize: 'var(--fl-fs-sm)' }}>
                  {n.body}
                </span>
                <span className="fl-muted" style={{ fontSize: 'var(--fl-fs-xs)' }} dir="ltr">
                  {new Date(n.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
            <button
              className="fl-btn fl-btn--sm"
              onClick={() => user && void notifications.clear(user.id)}
            >
              {t('notifications.clearAll')}
            </button>
          </div>
        )}
      </Modal>

      <Modal open={welcomeOpen} onClose={() => setWelcomeOpen(false)} title={t('auth.welcome')}>
        <p className="fl-muted" style={{ marginBottom: 'var(--fl-sp-4)' }}>
          {t('app.tagline')}
        </p>
        <p style={{ marginBottom: 'var(--fl-sp-4)' }}>{t('auth.localModeDesc')}</p>
        <div className="fl-col">
          <button
            className="fl-btn fl-btn--primary"
            onClick={() => {
              void continueLocal().then(() => setWelcomeOpen(false));
            }}
          >
            {t('auth.continueLocal')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
