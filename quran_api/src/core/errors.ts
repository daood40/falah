export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'RATE_LIMITED'
  | 'LICENSE_RESTRICTED'
  | 'INTERNAL_ERROR';

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  RATE_LIMITED: 429,
  LICENSE_RESTRICTED: 451,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }

  static notFound(what = 'Resource not found'): ApiError {
    return new ApiError('NOT_FOUND', what);
  }
}

/**
 * Maps the PostgreSQL SQLSTATEs a client can legitimately trigger onto API
 * errors, so a bad reference is a 4xx instead of a leaked 500. Anything else
 * stays unmapped and becomes a generic INTERNAL_ERROR.
 */
export function mapDatabaseError(error: unknown): ApiError | null {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case '23503': // foreign_key_violation
      return new ApiError('VALIDATION_ERROR', 'Referenced resource does not exist');
    case '23505': // unique_violation
      return new ApiError('VALIDATION_ERROR', 'Resource already exists');
    case '22P02': // invalid_text_representation (e.g. a malformed uuid)
      return new ApiError('VALIDATION_ERROR', 'Invalid identifier format');
    case '22003': // numeric_value_out_of_range
      return new ApiError('VALIDATION_ERROR', 'Numeric value out of range');
    case '42501': // insufficient_privilege (RLS / grants)
      return new ApiError('FORBIDDEN', 'Not allowed');
    default:
      return null;
  }
}
