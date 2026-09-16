import type { ServerResponse } from 'node:http';
import { ApiError } from './errors.ts';

export interface Meta {
  page?: number;
  limit?: number;
  total?: number;
  total_pages?: number;
  [k: string]: unknown;
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { ...JSON_HEADERS, 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

export function ok(res: ServerResponse, data: unknown, meta?: Meta, status = 200): void {
  sendJson(res, status, meta ? { success: true, data, meta } : { success: true, data });
}

export function paginated(
  res: ServerResponse,
  data: unknown[],
  page: number,
  limit: number,
  total: number,
  extra: Meta = {},
): void {
  ok(res, data, {
    page,
    limit,
    total,
    total_pages: limit > 0 ? Math.ceil(total / limit) : 0,
    ...extra,
  });
}

/** Errors never leak SQL, stack traces, secrets or connection strings (§23). */
export function fail(res: ServerResponse, err: unknown, requestId: string): void {
  if (err instanceof ApiError) {
    sendJson(res, err.status, {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
      meta: { request_id: requestId },
    });
    return;
  }
  console.error(`[${requestId}] unhandled`, err);
  sendJson(res, 500, {
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    meta: { request_id: requestId },
  });
}
