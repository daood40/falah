/**
 * Authentication.
 * - Supabase email/password auth when the backend is configured (real sessions,
 *   RLS-protected data).
 * - Local mode otherwise: an explicit, honestly-labeled device-only identity —
 *   everything stays in IndexedDB. No fake network auth.
 */
import { create } from 'zustand';
import { hasSupabase, supabase } from '@core/supabase/client';
import { auditLog } from '@core/audit/audit';
import { reportError, toAppError } from '@core/errors/errors';
import { kvGet, kvSet } from '@core/db/localdb';
import { newId } from '@core/utils/id';
import type { PlanId } from '@core/entitlements/entitlements';

export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string;
  plan: PlanId;
  isLocal: boolean;
}

interface AuthState {
  user: UserProfile | null;
  initializing: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  continueLocal: () => Promise<void>;
  signOut: () => Promise<void>;
}

const LOCAL_USER_KEY = 'auth.localUser';

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  initializing: true,

  init: async () => {
    try {
      if (hasSupabase()) {
        const { data } = await (await supabase()).auth.getSession();
        const session = data.session;
        if (session?.user) {
          set({
            user: {
              id: session.user.id,
              email: session.user.email ?? null,
              displayName: session.user.email?.split('@')[0] ?? 'مستخدم',
              plan: 'free',
              isLocal: false,
            },
            initializing: false,
          });
          return;
        }
      }
      const local = await kvGet<UserProfile>(LOCAL_USER_KEY);
      set({ user: local ?? null, initializing: false });
    } catch (error) {
      reportError(error, 'auth');
      set({ initializing: false });
    }
  },

  signIn: async (email, password) => {
    const { error } = await (await supabase()).auth.signInWithPassword({ email, password });
    if (error) throw toAppError(error, 'auth');
    await get().init();
    const user = get().user;
    if (user) await auditLog(user.id, 'auth_login', { method: 'password' });
  },

  signUp: async (email, password) => {
    const { error } = await (await supabase()).auth.signUp({ email, password });
    if (error) throw toAppError(error, 'auth');
    await get().init();
  },

  continueLocal: async () => {
    const existing = await kvGet<UserProfile>(LOCAL_USER_KEY);
    const user: UserProfile = existing ?? {
      id: `local-${newId()}`,
      email: null,
      displayName: 'ضيف',
      plan: 'free',
      isLocal: true,
    };
    await kvSet(LOCAL_USER_KEY, user);
    set({ user });
    await auditLog(user.id, 'auth_login', { method: 'local' });
  },

  signOut: async () => {
    const user = get().user;
    if (user && !user.isLocal && hasSupabase()) {
      await (await supabase()).auth.signOut();
    }
    if (user?.isLocal) await kvSet(LOCAL_USER_KEY, null);
    if (user) await auditLog(user.id, 'auth_logout', {});
    set({ user: null });
  },
}));
