import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { HomePage } from '@features/home/HomePage';
import { CreateHubPage } from '@features/create/CreateHubPage';
import { QuranCreatePage } from '@features/create/QuranCreatePage';
import { HadithCreatePage } from '@features/create/HadithCreatePage';
import { EditorPage } from '@features/editor/presentation/EditorPage';
import { LibraryPage } from '@features/library/presentation/LibraryPage';
import { AiAssistantPage } from '@features/ai/presentation/AiAssistantPage';
import { SettingsPage } from '@features/settings/SettingsPage';
import { AuthPage } from '@features/auth/AuthPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'create', element: <CreateHubPage /> },
      { path: 'create/quran', element: <QuranCreatePage /> },
      { path: 'create/hadith', element: <HadithCreatePage /> },
      { path: 'editor/:id', element: <EditorPage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'assistant', element: <AiAssistantPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'auth', element: <AuthPage /> },
    ],
  },
]);
