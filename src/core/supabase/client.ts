/**
 * Supabase client (lazy). When env vars are absent, FALAH runs in local mode
 * and every remote call is guarded by `hasSupabase()`.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, hasSupabase } from '../config/env';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!hasSupabase()) {
    throw new Error('Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)');
  }
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

export { hasSupabase };
