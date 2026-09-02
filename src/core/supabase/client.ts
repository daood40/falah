/**
 * Supabase client (lazy, code-split). The SDK is dynamically imported the
 * first time a remote call is actually made, so local-mode users never
 * download it at all (it is excluded from the main bundle). When env vars
 * are absent, FALAH runs in local mode and every remote call is guarded by
 * `hasSupabase()`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { env, hasSupabase } from '../config/env';

let clientPromise: Promise<SupabaseClient> | null = null;

export function supabase(): Promise<SupabaseClient> {
  if (!hasSupabase()) {
    return Promise.reject(
      new Error('Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)'),
    );
  }
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    }),
  );
  return clientPromise;
}

export { hasSupabase };
