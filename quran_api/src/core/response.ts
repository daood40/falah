import type { ServerResponse } from 'node:http';
import { ApiError } from './errors.ts';

export type Meta = Record<string, unknown>;

export type SuccessBody<T> = { success: true; data: T; meta: Meta };
export type ErrorBody = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

export function successBody<T>(data: T, meta: Meta = {}): SuccessBody<T> {
  return { success: true, data, meta };
}

export function errorBody(code: string, message: string, details?: unknown): ErrorBody {
  return { success: false, error: details === undefined ? { code, message } : { code, message, details } };
}

export function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

export function sendSuccess<T>(res: ServerResponse, data: T, meta: Meta = {}, status = 200): void {
  sendJson(res, status, successBody(data, meta));
}

/**
 * Error responses never leak SQL text, stack traces, secrets or internal paths:
 * only known ApiError messages reach the client.
 */
export function sendError(res: ServerResponse, err: unknown): void {
  if (err instanceof ApiError) {
    sendJson(res, err.status, errorBody(err.code, err.message, err.details));
    return;
  }
  sendJson(res, 500, errorBody('INTERNAL_ERROR', 'Internal server error'));
}
