import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Db } from './db/pool.ts';
import { withRls } from './db/pool.ts';
import type { Env } from './config/env.ts';
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
  const router = buildRouter();
  const rateLimiter = new RateLimiter(env.rateLimit.windowMs, env.rateLimit.max);

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
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
      // Licence gate: content endpoints are public only when redistribution is
      // confirmed; otherwise they stay available to authenticated staging users.
      if (route.licensed && !env.flags.publicDataEnabled && !userId) {
        throw new ApiError(
          'LICENSE_RESTRICTED',
          'Public data is disabled until redistribution rights are confirmed; authenticate to read in staging',
        );
      }

      const result = await withRls(db, userId, (client) =>
        route.handler({ req, res, url, query: url.searchParams, params, env, userId, client }),
      );
      if (req.method === 'HEAD') {
        res.writeHead(result.status ?? 200, { 'content-type': 'application/json; charset=utf-8' });
        res.end();
        return;
      }
      sendSuccess(res, result.data, result.meta ?? {}, result.status ?? 200);
    } catch (error) {
      const mapped = error instanceof ApiError ? error : mapDatabaseError(error);
      if (!mapped) {
        console.error('[api] unhandled error', error instanceof Error ? error.message : error);
      }
      sendError(res, mapped ?? error);
    }
  };

  return { handler, router, rateLimiter };
}

export { sendJson };
