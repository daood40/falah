/** Settings: account, appearance, language, notifications, storage, quality,
 * subscription, social accounts, help/about/privacy/terms, clear data. */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n, LOCALES } from '@core/i18n';
import { useTheme, type ThemeMode } from '@core/theme/theme';
import { estimateStorage, db, kvGet, kvSet } from '@core/db/localdb';
import { entitlementsFor } from '@core/entitlements/entitlements';
import { ConfirmDialog, Field } from '@core/ui/primitives';
import { toast } from '@core/ui/Toast';
import { auditLog } from '@core/audit/audit';
import { useAuth } from '@features/auth/authStore';
import { listPublishers } from '@features/publishing/domain/socialPublisher';
import { hasSupabase } from '@core/supabase/client';
import { createBackup, restoreBackup } from '@core/backup/backup';
import { useInstallPrompt } from '@core/pwa/installPrompt';

interface SettingsPrefs {
  notifications: boolean;
  exportQuality: 'standard' | 'high';
  wifiOnly: boolean;
}

const PREFS_KEY = 'settings.prefs';
const DEFAULT_PREFS: SettingsPrefs = {
  notifications: true,
  exportQuality: 'high',
  wifiOnly: false,
};

function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="fl-card fl-col" style={{ gap: 'var(--fl-sp-3)' }}>
      <h2 className="fl-subtitle">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const t = useI18n((s) => s.t);
  const { locale, setLocale } = useI18n();
  const { mode, setMode } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<SettingsPrefs>(DEFAULT_PREFS);
  const [storage, setStorage] = useState<{ usedMb: number; quotaMb: number } | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const installPrompt = useInstallPrompt();
  const location = useLocation();

  // Drawer links land on /settings#help|#about|#privacy|#terms: scroll there
  // and flash the section so the tap has a visible result.
  useEffect(() => {
    const id = location.hash.slice(1);
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    el.classList.add('fl-target-flash');
    const timer = setTimeout(() => el.classList.remove('fl-target-flash'), 1800);
    return () => clearTimeout(timer);
  }, [location.hash]);

  const exportBackup = async () => {
    const backup = await createBackup();
    const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `falah-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast('success', t('settings.backupDone'));
  };

  const importBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const restored = await restoreBackup(JSON.parse(await file.text()));
      toast('success', `${t('settings.backupRestored')} (${restored})`);
    } catch {
      toast('error', t('settings.backupInvalid'));
    }
  };
  const [connections, setConnections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void kvGet<SettingsPrefs>(PREFS_KEY).then((saved) => saved && setPrefs(saved));
    void estimateStorage().then(setStorage);
    void (async () => {
      const status: Record<string, boolean> = {};
      for (const publisher of listPublishers()) {
        status[publisher.platform] = await publisher.isConfigured();
      }
      setConnections(status);
    })();
  }, []);

  const updatePrefs = async (patch: Partial<SettingsPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await kvSet(PREFS_KEY, next);
    if (user) await auditLog(user.id, 'account_settings_changed', { patch });
  };

  const entitlements = entitlementsFor(user?.plan ?? 'free');

  return (
    <div className="fl-col" style={{ gap: 'var(--fl-sp-4)' }}>
      <h1 className="fl-title">{t('settings.title')}</h1>

      <Section title={t('settings.account')}>
        <div className="fl-row">
          <span className="fl-grow">
            <strong>{user?.displayName ?? '—'}</strong>
            <div className="fl-muted">{user?.email ?? t('auth.localMode')}</div>
          </span>
          {user ? (
            <button
              className="fl-btn"
              onClick={async () => {
                await signOut();
                toast('info', t('auth.loggedOut'));
              }}
            >
              {t('menu.logout')}
            </button>
          ) : (
            <button className="fl-btn fl-btn--primary" onClick={() => navigate('/auth')}>
              {t('menu.login')}
            </button>
          )}
        </div>
        {!hasSupabase() && <p className="fl-muted">{t('auth.localModeDesc')}</p>}
      </Section>

      <Section title={t('settings.appearance')}>
        <div className="fl-row fl-wrap" role="radiogroup" aria-label={t('settings.appearance')}>
          {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              className={`fl-chip ${mode === m ? 'fl-chip--active' : ''}`}
              onClick={() => setMode(m)}
            >
              {t(`settings.theme.${m}`)}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t('settings.language')}>
        <div className="fl-row fl-wrap" role="radiogroup" aria-label={t('settings.language')}>
          {LOCALES.map((l) => (
            <button
              key={l.code}
              role="radio"
              aria-checked={locale === l.code}
              className={`fl-chip ${locale === l.code ? 'fl-chip--active' : ''}`}
              onClick={() => setLocale(l.code)}
            >
              {l.nativeName}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t('settings.notifications')}>
        <label className="fl-row" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={prefs.notifications}
            onChange={(e) => updatePrefs({ notifications: e.target.checked })}
          />
          <span>{t('settings.notifications.desc')}</span>
        </label>
      </Section>

      <Section title={t('settings.quality')}>
        <Field label={t('settings.quality')}>
          <select
            className="fl-select"
            value={prefs.exportQuality}
            onChange={(e) =>
              updatePrefs({ exportQuality: e.target.value as SettingsPrefs['exportQuality'] })
            }
          >
            <option value="standard">720p</option>
            <option value="high">1080p</option>
          </select>
        </Field>
        <label className="fl-row" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={prefs.wifiOnly}
            onChange={(e) => updatePrefs({ wifiOnly: e.target.checked })}
          />
          <span>{t('settings.network')}: Wi-Fi</span>
        </label>
      </Section>

      <Section title={t('settings.subscription')}>
        <div className="fl-row fl-wrap">
          <span className="fl-badge fl-badge--verified">
            {t(`settings.plan.${user?.plan ?? 'free'}`)}
          </span>
          <span className="fl-muted">
            {t('library.title')}:{' '}
            {Number.isFinite(entitlements.max_projects) ? entitlements.max_projects : '∞'} ·{' '}
            {t('schedule.title')}:{' '}
            {Number.isFinite(entitlements.scheduled_posts) ? entitlements.scheduled_posts : '∞'} ·
            AI: {entitlements.ai_messages_per_day}/يوم
          </span>
        </div>
      </Section>

      <Section title={t('settings.socialAccounts')}>
        {listPublishers().map((publisher) => (
          <div key={publisher.platform} className="fl-row">
            <span className="fl-grow">{publisher.displayName}</span>
            {connections[publisher.platform] ? (
              <span className="fl-badge fl-badge--verified">{t('settings.connected')}</span>
            ) : (
              <span className="fl-muted" style={{ fontSize: 'var(--fl-fs-xs)' }}>
                {t('settings.notConfigured')}
              </span>
            )}
          </div>
        ))}
      </Section>

      <Section title={t('settings.storage')}>
        <p className="fl-muted">
          {t('settings.storageUsed')}:{' '}
          {storage ? `${storage.usedMb.toFixed(1)} MB / ${storage.quotaMb.toFixed(0)} MB` : '—'}
        </p>
        <div className="fl-row fl-wrap">
          <button className="fl-btn" onClick={() => void exportBackup()}>
            {t('settings.backupExport')}
          </button>
          <label className="fl-btn" style={{ cursor: 'pointer' }}>
            {t('settings.backupImport')}
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={(e) => void importBackup(e)}
            />
          </label>
        </div>
        <p className="fl-muted" style={{ fontSize: 'var(--fl-fs-xs)', margin: 0 }}>
          {t('settings.backupNote')}
        </p>
        <button className="fl-btn fl-btn--danger" onClick={() => setClearOpen(true)}>
          {t('settings.clearData')}
        </button>
      </Section>

      {installPrompt.available && (
        <Section title={t('settings.installTitle')}>
          <p className="fl-muted">{t('settings.installDesc')}</p>
          <button className="fl-btn fl-btn--primary" onClick={() => void installPrompt.install()}>
            {t('settings.installButton')}
          </button>
        </Section>
      )}

      <Section id="help" title={t('settings.help')}>
        {([1, 2, 3, 4] as const).map((n) => (
          <div key={n}>
            <strong>{t(`help.faq${n}q`)}</strong>
            <p className="fl-muted" style={{ margin: 0 }}>
              {t(`help.faq${n}a`)}
            </p>
          </div>
        ))}
      </Section>

      <Section id="about" title={t('settings.about')}>
        <p className="fl-muted">{t('settings.aboutText')}</p>
      </Section>

      <Section id="privacy" title={t('menu.privacy')}>
        <ul className="fl-muted" style={{ margin: 0, paddingInlineStart: 'var(--fl-sp-5)' }}>
          {([1, 2, 3, 4] as const).map((n) => (
            <li key={n}>{t(`privacy.p${n}`)}</li>
          ))}
        </ul>
      </Section>

      <Section id="terms" title={t('menu.terms')}>
        <p className="fl-muted">
          {locale === 'ar'
            ? 'باستخدامك فلاح فأنت توافق على استخدام المحتوى المُصدَّر وفق تراخيص المصادر (Tanzil: CC BY-ND، quran-json: CC BY 4.0) ونسب النص إلى مصدره عند النشر.'
            : 'By using FALAH you agree to use exported content according to the source licenses (Tanzil: CC BY-ND, quran-json: CC BY 4.0) and to attribute texts to their sources when publishing.'}
        </p>
      </Section>

      <ConfirmDialog
        open={clearOpen}
        title={t('settings.clearData')}
        text={t('settings.clearDataConfirm')}
        danger
        onCancel={() => setClearOpen(false)}
        onConfirm={async () => {
          if (user) await auditLog(user.id, 'data_cleared', {});
          await Promise.all([
            db.projects.clear(),
            db.scheduledPosts.clear(),
            db.quranAyahs.clear(),
            db.hadiths.clear(),
          ]);
          setClearOpen(false);
          toast('success', t('common.ok'));
        }}
      />
    </div>
  );
}
