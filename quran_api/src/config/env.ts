/** Environment, private-mode switch and licence flags. Never logs secret values. */

const bool = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export type LicenseFlags = {
  contentLicenseConfirmed: boolean;
  translationsLicenseConfirmed: boolean;
  audioLicenseConfirmed: boolean;
  tafsirLicenseConfirmed: boolean;
  qiraatLicenseConfirmed: boolean;
  dataRedistributionAllowed: boolean;
  publicDataEnabled: boolean;
  publicApiEnabled: boolean;
};

export type Env = {
  environment: 'development' | 'staging' | 'production' | 'test';
  /** PRIVATE_MODE=true (the default) forces every public switch off. */
  privateMode: boolean;
  host: string;
  port: number;
  databaseUrl: string;
  /** False when no DATABASE_URL/SUPABASE_DB_URL was given and the fallback is in use. */
  databaseUrlProvided: boolean;
  /** Supabase JWT secret (HS256). Absent → authenticated endpoints return 401. */
  jwtSecret: string | null;
  datasetVersion: string;
  flags: LicenseFlags;
  corsOrigins: string[];
  rateLimit: { windowMs: number; max: number };
  maxPageLimit: number;
  defaultPageLimit: number;
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const environment = (source.ENVIRONMENT ?? 'staging') as Env['environment'];
  // Private by default: the flag must be switched off deliberately, and even
  // then every public switch still needs its own licence confirmation.
  const privateMode = bool(source.PRIVATE_MODE, true);

  const requested: LicenseFlags = {
    contentLicenseConfirmed: bool(source.CONTENT_LICENSE_CONFIRMED),
    translationsLicenseConfirmed: bool(source.TRANSLATIONS_LICENSE_CONFIRMED),
    audioLicenseConfirmed: bool(source.AUDIO_LICENSE_CONFIRMED),
    tafsirLicenseConfirmed: bool(source.TAFSIR_LICENSE_CONFIRMED),
    qiraatLicenseConfirmed: bool(source.QIRAAT_LICENSE_CONFIRMED),
    dataRedistributionAllowed: bool(source.DATA_REDISTRIBUTION_ALLOWED),
    publicDataEnabled: bool(source.PUBLIC_DATA_ENABLED),
    publicApiEnabled: bool(source.PUBLIC_API_ENABLED),
  };

  const flags: LicenseFlags = privateMode
    ? {
        ...requested,
        // In private mode nothing is public, whatever the environment says.
        publicDataEnabled: false,
        publicApiEnabled: false,
        dataRedistributionAllowed: false,
      }
    : requested;

  return {
    environment,
    privateMode,
    // Private mode binds to loopback unless a host is given explicitly, so an
    // internal instance is not reachable from the network by accident.
    host: source.HOST ?? (privateMode ? '127.0.0.1' : '0.0.0.0'),
    port: int(source.PORT, 8787),
    databaseUrl:
      source.DATABASE_URL ??
      source.SUPABASE_DB_URL ??
      'postgresql://postgres@localhost:5432/postgres',
    databaseUrlProvided: Boolean(source.DATABASE_URL ?? source.SUPABASE_DB_URL),
    jwtSecret: source.SUPABASE_JWT_SECRET ?? null,
    datasetVersion: source.QURAN_DATASET_VERSION ?? 'unset',
    flags,
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

/**
 * Configuration that must never run: anything that would expose religious
 * content publicly without the matching confirmed licence. Returns the reasons;
 * the server refuses to start when the list is not empty.
 */
export function unsafeConfiguration(env: Env): string[] {
  const problems: string[] = [];

  // Boot-critical configuration, checked in every posture: a deployment with no
  // database of its own would silently fall back to a local one, and a short
  // JWT secret is guessable, so both must stop the process instead of serving.
  // The test environment builds its own configuration and is exempt.
  if (env.environment !== 'test') {
    if (!env.databaseUrlProvided) {
      problems.push('no DATABASE_URL (or SUPABASE_DB_URL) was given');
    }
    if (env.jwtSecret !== null && env.jwtSecret.length < 32) {
      problems.push('SUPABASE_JWT_SECRET is shorter than 32 characters');
    }
  }

  if (env.privateMode) return problems; // private mode already forced everything off

  if (env.flags.publicDataEnabled && !env.flags.contentLicenseConfirmed) {
    problems.push('PUBLIC_DATA_ENABLED without CONTENT_LICENSE_CONFIRMED');
  }
  if (env.flags.publicDataEnabled && !env.flags.dataRedistributionAllowed) {
    problems.push('PUBLIC_DATA_ENABLED without DATA_REDISTRIBUTION_ALLOWED');
  }
  if (env.flags.publicApiEnabled && !env.flags.publicDataEnabled) {
    problems.push('PUBLIC_API_ENABLED without PUBLIC_DATA_ENABLED');
  }
  if (env.flags.audioLicenseConfirmed && !env.flags.contentLicenseConfirmed) {
    problems.push('AUDIO_LICENSE_CONFIRMED without CONTENT_LICENSE_CONFIRMED');
  }
  return problems;
}
