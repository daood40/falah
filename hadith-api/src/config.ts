/** Environment + feature flags. No secret ever reaches a client response. */

function env(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    return '';
  }
  return v;
}

function bool(key: string, fallback = false): boolean {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return v === 'true' || v === '1';
}

function int(key: string, fallback: number): number {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

export const config = {
  environment: env('ENVIRONMENT', 'staging'),
  port: int('PORT', 8787),
  /** §3 — while false the public API withholds hadith text. */
  contentLicenseConfirmed: bool('CONTENT_LICENSE_CONFIRMED', false),
  databaseUrl: env('DATABASE_URL'),
  supabaseUrl: env('SUPABASE_URL'),
  /** Server-side only. Never sent to Flutter, never logged. */
  supabaseServiceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY'),
  supabaseJwtSecret: env('SUPABASE_JWT_SECRET'),
  adminApiKey: env('ADMIN_API_KEY'),
  corsOrigins: env('CORS_ORIGINS', '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  pagination: {
    defaultLimit: int('DEFAULT_PAGE_LIMIT', 20),
    maxLimit: int('MAX_PAGE_LIMIT', 100),
  },
  rateLimit: {
    windowMs: int('RATE_LIMIT_WINDOW_MS', 60_000),
    max: int('RATE_LIMIT_MAX', 120),
  },
  activeDatasetVersion: env('ACTIVE_DATASET_VERSION', 'JAMI-KAMIL-1437-V1'),
} as const;

export type Config = typeof config;
