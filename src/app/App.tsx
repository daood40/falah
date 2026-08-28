import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { applyDocumentLocale, useI18n } from '@core/i18n';
import { applyDocumentTheme } from '@core/theme/theme';
import { useAuth } from '@features/auth/authStore';
import { processDuePosts } from '@features/scheduler/domain/scheduler';
import { getProject } from '@features/library/data/libraryRepository';
import { exportPng } from '@features/editor/data/exportService';
import { router } from './router';

/** Scheduler tick: publish due posts while the app is open (server cron covers the rest). */
function useSchedulerTick() {
  useEffect(() => {
    const tick = () =>
      void processDuePosts(async (projectId) => {
        const project = await getProject(projectId);
        if (!project) return null;
        // Export runs through the Source Lock gate; user approved at scheduling time.
        const media = await exportPng(project, true);
        return { media, caption: project.title };
      }).catch(() => undefined);
    const interval = setInterval(tick, 60_000);
    tick();
    return () => clearInterval(interval);
  }, []);
}

export function App() {
  const locale = useI18n((s) => s.locale);
  const init = useAuth((s) => s.init);

  useEffect(() => {
    applyDocumentLocale();
    applyDocumentTheme();
    void init();
  }, [init]);

  useSchedulerTick();

  // Re-render the tree on locale change (dir/lang applied in setLocale).
  return <RouterProvider key={locale} router={router} />;
}
