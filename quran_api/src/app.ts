import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Db } from './db/pool.ts';
import { withRls } from './db/pool.ts';
import { unsafeConfiguration, type Env } from './config/env.ts';
import { ApiError, mapDatabaseError } from './core/errors.ts';
import { sendError, sendJson, sendSuccess } from './core/response.ts';
import { Router } from './http/router.ts';
import { RateLimiter, applyCors, applySecurityHeaders, authenticate } from './http/middleware.ts';
import { metaRoutes } from './routes/meta.ts';
import { quranRoutes } from './routes/quran.ts';
import { searchRoutes } from './routes/search.ts';
import { audioRoutes } from './routes/audio.ts';
import { downloadRoutes } from './routes/downloads.ts';
import { userRoutes } from './routes/user.ts';

export function buildRouter(): Router {
  return new Router()
    .addAll(metaRoutes)
    .addAll(quranRoutes)
    .addAll(searchRoutes)
    .addAll(audioRoutes)
    .addAll(downloadRoutes)
    .addAll(userRoutes);
}

export type App = {
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  router: Router;
  rateLimiter: RateLimiter;
};

export function createApp(env: Env, db: Db): App {
  const problems = unsafeConfiguration(env);
  if (problems.length > 0) {
    throw new Error(
      `refusing to start — unsafe public configuration: ${problems.join('; ')}`,
    );
  }
  const router = buildRouter();
  const rateLimiter = new RateLimiter(env.rateLimit.windowMs, env.rateLimit.max);

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // One id per request, echoed to the caller and used in every log line for
    // this request. Never contains user data.
    const requestId =
      (req.headers['x-request-id'] as string | undefined)?.slice(0, 64) ?? randomUUID();
    const startedAt = process.hrtime.bigint();
    res.setHeader('x-request-id', requestId);

    applySecurityHeaders(res);
    applyCors(req, res, env);

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const clientKey =
        (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
        req.socket.remoteAddress ??
        'unknown';
      rateLimiter.check(clientKey);

      // HEAD is answered like GET with an empty body (health checks use it).
      const method = req.method === 'HEAD' ? 'GET' : (req.method ?? 'GET');
      const { route, params } = router.match(method, url.pathname);
      const userId = authenticate(req, env);

      if (route.auth && !userId) {
        throw new ApiError('UNAUTHORIZED', 'Authentication required');
      }
      // Private mode / licence gate: while the project is private, or while
      // redistribution rights are unconfirmed, religious content is served only
      // to an authenticated internal caller — never anonymously.
      if (route.licensed && !env.flags.publicDataEnabled && !userId) {
        throw new ApiError(
          'LICENSE_RESTRICTED',
          env.privateMode
            ? 'PRIVATE_MODE: this instance is internal only — authenticate to read'
            : 'Public data is disabled until redistribution rights are confirmed; authenticate to read',
        );
      }

      const result = await withRls(db, userId, (client) =>
        route.handler({ req, res, url, query: url.searchParams, params, env, userId, client }),
      );
      logRequest(env, {
        requestId,
        method: req.method ?? 'GET',
        path: url.pathname,
        status: result.status ?? 200,
        durationMs: elapsedMs(startedAt),
        authenticated: Boolean(userId),
      });
      if (result.raw) return; // handler wrote the body itself
      if (req.method === 'HEAD') {
        res.writeHead(result.status ?? 200, { 'content-type': 'application/json; charset=utf-8' });
        res.end();
        return;
      }
      sendSuccess(res, result.data, result.meta ?? {}, result.status ?? 200);
    } catch (error) {
      const mapped = error instanceof ApiError ? error : mapDatabaseError(error);
      // An unmapped error gets its own id so a report can be traced to a log
      // line without ever putting internals in the response body.
      const errorId = mapped ? undefined : randomUUID();
      if (!mapped) {
        console.error(
          JSON.stringify({
            level: 'error',
            request_id: requestId,
            error_id: errorId,
            method: req.method ?? 'GET',
            path: (req.url ?? '/').split('?')[0],
            message: error instanceof Error ? error.message : 'unknown error',
          }),
        );
        res.setHeader('x-error-id', errorId!);
      } else {
        logRequest(env, {
          requestId,
          method: req.method ?? 'GET',
          path: (req.url ?? '/').split('?')[0] ?? '/',
          status: mapped.status,
          durationMs: elapsedMs(startedAt),
          authenticated: false,
          code: mapped.code,
        });
      }
      sendError(res, mapped ?? error);
    }
  };

  return { handler, router, rateLimiter };
}

/**
 * Structured access log. It carries only routing facts — never a query string,
 * a token, a body, a connection string or any content.
 */
function logRequest(
  env: Env,
  entry: {
    requestId: string;
    method: string;
    path: string;
    status: number;
    durationMs: number;
    authenticated: boolean;
    code?: string;
  },
): void {
  if (env.environment === 'test') return;
  console.log(
    JSON.stringify({
      level: entry.status >= 500 ? 'error' : entry.status >= 400 ? 'warn' : 'info',
      request_id: entry.requestId,
      method: entry.method,
      path: entry.path,
      status: entry.status,
      duration_ms: entry.durationMs,
      authenticated: entry.authenticated,
      ...(entry.code ? { code: entry.code } : {}),
    }),
  );
}

const elapsedMs = (startedAt: bigint): number =>
  Number(process.hrtime.bigint() - startedAt) / 1_000_000;

export { sendJson };
