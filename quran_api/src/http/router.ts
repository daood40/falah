import type { IncomingMessage, ServerResponse } from 'node:http';
import type pg from 'pg';
import type { Env } from '../config/env.ts';
import { ApiError } from '../core/errors.ts';
import type { Meta } from '../core/response.ts';

export type Ctx = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  query: URLSearchParams;
  params: Record<string, string>;
  env: Env;
  userId: string | null;
  client: pg.PoolClient;
};

export type HandlerResult = {
  data: unknown;
  meta?: Meta;
  status?: number;
  /** The handler already wrote the response (e.g. the OpenAPI document). */
  raw?: boolean;
};
export type Handler = (ctx: Ctx) => Promise<HandlerResult>;

export type Route = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  /** requires a valid Supabase JWT regardless of licence flags */
  auth?: boolean;
  /** content route: readable publicly only when PUBLIC_DATA_ENABLED=true */
  licensed?: boolean;
  handler: Handler;
};

type CompiledRoute = Route & { regex: RegExp; keys: string[] };

export class Router {
  private readonly routes: CompiledRoute[] = [];

  add(route: Route): this {
    const keys: string[] = [];
    const pattern = route.path
      .split('/')
      .map((segment) => {
        if (!segment.startsWith(':')) return escapeRegex(segment);
        keys.push(segment.slice(1));
        return '([^/]+)';
      })
      .join('/');
    this.routes.push({ ...route, keys, regex: new RegExp(`^${pattern}/?$`) });
    return this;
  }

  addAll(routes: Route[]): this {
    routes.forEach((route) => this.add(route));
    return this;
  }

  list(): Route[] {
    return this.routes.map(({ method, path, auth, licensed, handler }) => ({
      method,
      path,
      auth,
      licensed,
      handler,
    }));
  }

  match(method: string, pathname: string): { route: CompiledRoute; params: Record<string, string> } {
    let pathExists = false;
    for (const route of this.routes) {
      const match = route.regex.exec(pathname);
      if (!match) continue;
      pathExists = true;
      if (route.method !== method) continue;
      const params: Record<string, string> = {};
      route.keys.forEach((key, index) => {
        const raw = match[index + 1] ?? '';
        try {
          params[key] = decodeURIComponent(raw);
        } catch {
          // Malformed percent-encoding is caller error, not a server fault.
          throw new ApiError('VALIDATION_ERROR', 'Invalid percent-encoding in path');
        }
        // A NUL byte cannot be stored or compared in Postgres text.
        if (params[key]!.includes('\u0000')) {
          throw new ApiError('VALIDATION_ERROR', 'Input contains a NUL byte');
        }
      });
      return { route, params };
    }
    if (pathExists) throw new ApiError('METHOD_NOT_ALLOWED', 'Method not allowed');
    throw ApiError.notFound('Resource not found');
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
