import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { match } from './router.ts';
import { cors, rateLimit, requestId, secureHeaders } from './middleware.ts';
import { fail, sendJson } from './respond.ts';

// Route modules register themselves on import.
import '../routes/system.ts';
import '../routes/hadiths.ts';
import '../routes/catalogue.ts';
import '../routes/search.ts';
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
    if (url.pathname === '/' || url.pathname === '/api/v1') {
      sendJson(res, 200, {
        success: true,
        data: { name: 'FALAH Hadith API', version: 'v1', docs: '/openapi.yaml' },
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
