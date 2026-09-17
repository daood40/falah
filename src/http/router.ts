import type { IncomingMessage, ServerResponse } from 'node:http';
import { ApiError } from './errors.ts';

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  query: URLSearchParams;
  requestId: string;
}

export type Handler = (ctx: Ctx) => Promise<void>;

interface Route {
  method: string;
  segments: string[];
  handler: Handler;
  path: string;
}

const routes: Route[] = [];

export function route(method: string, path: string, handler: Handler): void {
  routes.push({ method, path, segments: path.split('/').filter(Boolean), handler });
}

export const get = (path: string, handler: Handler) => route('GET', path, handler);
export const post = (path: string, handler: Handler) => route('POST', path, handler);
export const patch = (path: string, handler: Handler) => route('PATCH', path, handler);

export function listRoutes(): { method: string; path: string }[] {
  return routes.map((r) => ({ method: r.method, path: r.path }));
}

export function match(
  method: string,
  pathname: string,
): { handler: Handler; params: Record<string, string> } {
  const parts = pathname.split('/').filter(Boolean);
  let pathMatched = false;

  for (const r of routes) {
    if (r.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let hit = true;
    for (let i = 0; i < r.segments.length; i++) {
      const seg = r.segments[i] as string;
      const part = parts[i] as string;
      if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(part);
      else if (seg !== part) {
        hit = false;
        break;
      }
    }
    if (!hit) continue;
    pathMatched = true;
    if (r.method === method) return { handler: r.handler, params };
  }

  if (pathMatched) throw new ApiError('METHOD_NOT_ALLOWED', `${method} is not allowed here`);
  throw new ApiError('NOT_FOUND', 'Endpoint not found');
}
