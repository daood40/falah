/**
 * Unified error handling.
 * Technical details are logged; users only ever see a translated, friendly message
 * (the `messageKey` is resolved through i18n at render time).
 */
export type AppErrorKind =
  | 'network'
  | 'auth'
  | 'storage'
  | 'rendering'
  | 'publishing'
  | 'database'
  | 'validation'
  | 'source_lock'
  | 'not_configured'
  | 'unknown';

const KIND_MESSAGE_KEY: Record<AppErrorKind, string> = {
  network: 'errors.network',
  auth: 'errors.auth',
  storage: 'errors.storage',
  rendering: 'errors.rendering',
  publishing: 'errors.publishing',
  database: 'errors.database',
  validation: 'errors.validation',
  source_lock: 'errors.sourceLock',
  not_configured: 'errors.notConfigured',
  unknown: 'errors.unknown',
};

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly messageKey: string;
  readonly cause?: unknown;

  constructor(kind: AppErrorKind, technicalMessage: string, cause?: unknown) {
    super(technicalMessage);
    this.name = 'AppError';
    this.kind = kind;
    this.messageKey = KIND_MESSAGE_KEY[kind];
    this.cause = cause;
  }
}

type ErrorListener = (error: AppError) => void;
const listeners = new Set<ErrorListener>();

export function onAppError(listener: ErrorListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Log the technical error and notify UI listeners with the safe version. */
export function reportError(error: unknown, kind: AppErrorKind = 'unknown'): AppError {
  const appError =
    error instanceof AppError
      ? error
      : new AppError(kind, error instanceof Error ? error.message : String(error), error);
  // Technical log — never shown to users.
  console.error(`[FALAH:${appError.kind}]`, appError.message, appError.cause ?? '');
  listeners.forEach((l) => l(appError));
  return appError;
}

export function toAppError(error: unknown, kind: AppErrorKind = 'unknown'): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return new AppError('network', error.message, error);
  }
  return new AppError(kind, error instanceof Error ? error.message : String(error), error);
}
