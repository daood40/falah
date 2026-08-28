/**
 * Central, typed access to environment configuration.
 * Secrets never live in client code — only public keys/URLs (see .env.example).
 */
export interface AppEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  sunnahApiKey: string;
  quranApiBase: string;
}

function readEnv(key: string): string {
  const value = (import.meta.env as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

export const env: AppEnv = {
  supabaseUrl: readEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: readEnv('VITE_SUPABASE_ANON_KEY'),
  sunnahApiKey: readEnv('VITE_SUNNAH_API_KEY'),
  quranApiBase: readEnv('VITE_QURAN_API_BASE') || 'https://api.alquran.cloud/v1',
};

/** True when a Supabase backend is configured; otherwise FALAH runs in local mode. */
export const hasSupabase = (): boolean => env.supabaseUrl !== '' && env.supabaseAnonKey !== '';

/** True when the sunnah.com API key is configured for live hadith fetching. */
export const hasSunnahApi = (): boolean => env.sunnahApiKey !== '';
