/** Component tests: RTL, dark mode, navigation hub, library empty state. */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CreateHubPage } from '@features/create/CreateHubPage';
import { LibraryPage } from '@features/library/presentation/LibraryPage';
import { useI18n } from '@core/i18n';
import { useTheme } from '@core/theme/theme';
import { useAuth } from '@features/auth/authStore';

describe('RTL + theme', () => {
  it('applies RTL for Arabic and LTR for English on the document', () => {
    useI18n.getState().setLocale('en');
    expect(document.documentElement.dir).toBe('ltr');
    useI18n.getState().setLocale('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('dark mode sets data-theme on the root element', () => {
    useTheme.getState().setMode('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    useTheme.getState().setMode('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('create hub', () => {
  it('renders Quran and Hadith entry cards with links', () => {
    useI18n.getState().setLocale('ar');
    render(
      <MemoryRouter>
        <CreateHubPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('القرآن الكريم')).toBeInTheDocument();
    expect(screen.getByText('الحديث الشريف')).toBeInTheDocument();
    expect(screen.getByText('القرآن الكريم').closest('a')).toHaveAttribute('href', '/create/quran');
  });
});

describe('library', () => {
  it('shows the empty state for a fresh user', async () => {
    useAuth.setState({
      user: { id: 'test-user-empty', email: null, displayName: 'ضيف', plan: 'free', isLocal: true },
      initializing: false,
    });
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('لا يوجد محتوى هنا بعد')).toBeInTheDocument();
  });
});
