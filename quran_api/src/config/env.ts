/** Environment + licence feature flags. Never logs or exposes secret values. */

const bool = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export type Env = {
  environment: 'development' | 'staging' | 'production' | 'test';
  port: number;
  databaseUrl: string;
  /** Supabase JWT secret (HS256). Absent → authenticated endpoints return 401. */
  jwtSecret: string | null;
  datasetVersion: string;
  flags: {
    contentLicenseConfirmed: boolean;
    audioLicenseConfirmed: boolean;
    publicDataEnabled: boolean;
  };
  corsOrigins: string[];
  rateLimit: { windowMs: number; max: number };
  maxPageLimit: number;
  defaultPageLimit: number;
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const environment = (source.ENVIRONMENT ?? 'staging') as Env['environment'];
  return {
    environment,
    port: int(source.PORT, 8787),
    databaseUrl:
      source.DATABASE_URL ??
      source.SUPABASE_DB_URL ??
      'postgresql://postgres@localhost:5432/postgres',
    jwtSecret: source.SUPABASE_JWT_SECRET ?? null,
    datasetVersion: source.QURAN_DATASET_VERSION ?? 'unset',
    flags: {
      contentLicenseConfirmed: bool(source.CONTENT_LICENSE_CONFIRMED),
      audioLicenseConfirmed: bool(source.AUDIO_LICENSE_CONFIRMED),
      publicDataEnabled: bool(source.PUBLIC_DATA_ENABLED),
    },
    corsOrigins: (source.API_CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    rateLimit: {
      windowMs: int(source.RATE_LIMIT_WINDOW_MS, 60_000),
      max: int(source.RATE_LIMIT_MAX, 120),
    },
    maxPageLimit: int(source.API_MAX_LIMIT, 100),
    defaultPageLimit: int(source.API_DEFAULT_LIMIT, 20),
  };
}
