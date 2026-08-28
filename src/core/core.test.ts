/** Core: i18n, entitlements, errors, render engine text wrap. */
import { describe, expect, it } from 'vitest';
import { dirOf, translate, LOCALES, registerLocale } from './i18n';
import { canCreateProject, canSchedule, entitlementsFor } from './entitlements/entitlements';
import { AppError, toAppError } from './errors/errors';
import { wrapText } from '@features/editor/domain/renderEngine';

describe('i18n', () => {
  it('translates ar and en with RTL/LTR directions', () => {
    expect(translate('ar', 'nav.home')).toBe('الرئيسية');
    expect(translate('en', 'nav.home')).toBe('Home');
    expect(dirOf('ar')).toBe('rtl');
    expect(dirOf('en')).toBe('ltr');
  });

  it('falls back to Arabic for missing keys and locales', () => {
    expect(translate('fr', 'nav.home')).toBe('الرئيسية');
    expect(translate('en', 'missing.key')).toBe('missing.key');
  });

  it('supports registering new locales at runtime (50+ language architecture)', () => {
    registerLocale({ code: 'tr', nativeName: 'Türkçe', dir: 'ltr' }, { 'nav.home': 'Ana sayfa' });
    expect(translate('tr', 'nav.home')).toBe('Ana sayfa');
    expect(LOCALES.some((l) => l.code === 'tr')).toBe(true);
  });
});

describe('entitlements', () => {
  it('enforces plan limits', () => {
    const free = entitlementsFor('free');
    expect(canCreateProject(19, free)).toBe(true);
    expect(canCreateProject(20, free)).toBe(false);
    expect(canSchedule(5, free)).toBe(false);
    expect(canCreateProject(10_000, entitlementsFor('premium'))).toBe(true);
  });

  it('supports backend overrides (prices/limits change without app release)', () => {
    expect(entitlementsFor('free', { max_projects: 99 }).max_projects).toBe(99);
  });
});

describe('errors', () => {
  it('maps kinds to user-facing message keys', () => {
    expect(new AppError('network', 'x').messageKey).toBe('errors.network');
    expect(toAppError(new TypeError('Failed to fetch')).kind).toBe('network');
    expect(toAppError('boom').kind).toBe('unknown');
  });
});

describe('render engine', () => {
  it('wraps text by measured width', () => {
    const fakeCtx = {
      measureText: (s: string) => ({ width: s.length * 10 }),
    } as unknown as CanvasRenderingContext2D;
    const lines = wrapText(fakeCtx, 'كلمة كلمة كلمة كلمة', 100);
    expect(lines.length).toBeGreaterThan(1);
    expect(wrapText(fakeCtx, 'قصير', 100)).toEqual(['قصير']);
  });
});
