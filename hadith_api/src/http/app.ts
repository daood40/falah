import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { match, listRoutes } from './router.ts';
import { cors, rateLimit, requestId, secureHeaders } from './middleware.ts';
import { fail, sendJson } from './respond.ts';

// Route modules register themselves on import.
import '../routes/system.ts';
import '../routes/hadiths.ts';
import '../routes/hadith-parts.ts';
import '../routes/catalogue.ts';
import '../routes/search.ts';
import '../routes/classification.ts';
import '../routes/admin.ts';

export async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const reqId = requestId(req);
  try {
    secureHeaders(res, reqId);
    cors(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    rateLimit(req, res);
    const url = new URL(req.url ?? '/', 'http://localhost');
    // The service describes itself: an integrator needs no repository access.
    if (url.pathname === '/openapi.yaml' || url.pathname === '/api/v1/openapi.yaml') {
      const spec = readFileSync(new URL('../../openapi.yaml', import.meta.url), 'utf8');
      res.writeHead(200, {
        'content-type': 'application/yaml; charset=utf-8',
        'content-length': Buffer.byteLength(spec),
        'cache-control': 'public, max-age=300',
      });
      res.end(spec);
      return;
    }

    if (url.pathname === '/' || url.pathname === '/api/v1') {
      sendJson(res, 200, {
        success: true,
        data: {
          name: 'FALAH Hadith API',
          version: 'v1',
          openapi: '/openapi.yaml',
          endpoints: listRoutes().length,
          resources: {
            hadiths: '/api/v1/hadiths',
            search: '/api/v1/search?q=…',
            catalog: '/api/v1/catalog',
            books: '/api/v1/books',
            chapters: '/api/v1/chapters',
            narrators: '/api/v1/narrators',
            collections: '/api/v1/collections',
            gradings: '/api/v1/gradings',
            volumes: '/api/v1/volumes',
            editions: '/api/v1/editions',
            sources: '/api/v1/sources',
            cross_checks: '/api/v1/cross-checks/summary',
            stats: '/api/v1/stats',
            health: '/api/v1/health',
          },
        },
      });
      return;
    }
    const { handler, params } = match(req.method ?? 'GET', url.pathname);
    await handler({ req, res, params, query: url.searchParams, requestId: reqId });
  } catch (err) {
    fail(res, err, reqId);
  }
}

export function createServer(): http.Server {
  return http.createServer((req, res) => {
    void handle(req, res);
  });
}
