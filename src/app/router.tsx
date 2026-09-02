/** Router with route-level code splitting: each page loads on demand. */
import { Suspense, lazy, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { Spinner } from '@core/ui/primitives';
import { AppShell } from './layout/AppShell';

function page(load: () => Promise<{ default: ComponentType }>) {
  const Page = lazy(load);
  return (
    <Suspense fallback={<Spinner />}>
      <Page />
    </Suspense>
  );
}

// Deployed under a sub-path (e.g. GitHub Pages /<repo>/) the router must know its base.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [
        {
          index: true,
          element: page(() =>
            import('@features/home/HomePage').then((m) => ({ default: m.HomePage })),
          ),
        },
        {
          path: 'create',
          element: page(() =>
            import('@features/create/CreateHubPage').then((m) => ({ default: m.CreateHubPage })),
          ),
        },
        {
          path: 'create/quran',
          element: page(() =>
            import('@features/create/QuranCreatePage').then((m) => ({
              default: m.QuranCreatePage,
            })),
          ),
        },
        {
          path: 'create/hadith',
          element: page(() =>
            import('@features/create/HadithCreatePage').then((m) => ({
              default: m.HadithCreatePage,
            })),
          ),
        },
        {
          path: 'editor/:id',
          element: page(() =>
            import('@features/editor/presentation/EditorPage').then((m) => ({
              default: m.EditorPage,
            })),
          ),
        },
        {
          path: 'werd',
          element: page(() =>
            import('@features/werd/WerdPage').then((m) => ({ default: m.WerdPage })),
          ),
        },
        {
          path: 'azkar',
          element: page(() =>
            import('@features/azkar/AzkarPage').then((m) => ({ default: m.AzkarPage })),
          ),
        },
        {
          path: 'tasbih',
          element: page(() =>
            import('@features/tasbih/presentation/TasbihPage').then((m) => ({
              default: m.TasbihPage,
            })),
          ),
        },
        {
          path: 'publish',
          element: page(() =>
            import('@features/publishing/presentation/PublishPage').then((m) => ({
              default: m.PublishPage,
            })),
          ),
        },
        {
          path: 'library',
          element: page(() =>
            import('@features/library/presentation/LibraryPage').then((m) => ({
              default: m.LibraryPage,
            })),
          ),
        },
        {
          path: 'assistant',
          element: page(() =>
            import('@features/ai/presentation/AiAssistantPage').then((m) => ({
              default: m.AiAssistantPage,
            })),
          ),
        },
        {
          path: 'settings',
          element: page(() =>
            import('@features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
          ),
        },
        {
          path: 'auth',
          element: page(() =>
            import('@features/auth/AuthPage').then((m) => ({ default: m.AuthPage })),
          ),
        },
      ],
    },
  ],
  { basename },
);
