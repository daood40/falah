import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { listRoutes } from '../src/http/router.ts';
import '../src/http/app.ts';

const spec = parse(readFileSync('openapi.yaml', 'utf8')) as {
  openapi: string;
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> };
};

/** Turns '/api/v1/hadiths/:id' into the OpenAPI '/api/v1/hadiths/{id}'. */
const toSpecPath = (p: string) => p.replace(/:([a-zA-Z_]+)/g, '{$1}');

describe('OpenAPI specification', () => {
  it('is a valid OpenAPI 3.1 document', () => {
    expect(spec.openapi).toMatch(/^3\.1/);
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
    expect(spec.components.securitySchemes['adminAuth']).toBeDefined();
  });

  it('documents every route the server actually serves', () => {
    const missing = listRoutes()
      .map((r) => ({ ...r, spec: toSpecPath(r.path) }))
      .filter((r) => !spec.paths[r.spec]?.[r.method.toLowerCase()]);
    expect(missing.map((m) => `${m.method} ${m.spec}`)).toEqual([]);
  });

  it('documents no route the server does not serve', () => {
    const served = new Set(listRoutes().map((r) => `${r.method.toLowerCase()} ${toSpecPath(r.path)}`));
    const extra = Object.entries(spec.paths).flatMap(([path, ops]) =>
      Object.keys(ops)
        .filter((m) => ['get', 'post', 'patch', 'delete'].includes(m))
        .map((m) => `${m} ${path}`)
        .filter((k) => !served.has(k)),
    );
    expect(extra).toEqual([]);
  });

  it('marks every admin path as requiring the admin credential', () => {
    const unguarded = Object.entries(spec.paths)
      .filter(([p]) => p.includes('/admin/'))
      .flatMap(([p, ops]) =>
        Object.entries(ops)
          .filter(([, op]) => !(op as { security?: unknown[] }).security?.length)
          .map(([m]) => `${m} ${p}`),
      );
    expect(unguarded).toEqual([]);
  });

  it('describes every source-dependent field as nullable', () => {
    const detail = spec.components.schemas['Hadith'] as {
      properties: Record<string, { type: unknown }>;
    };
    const item = spec.components.schemas['HadithListItem'] as {
      properties: Record<string, { type: unknown }>;
    };
    for (const field of ['number', 'text']) {
      expect(detail.properties[field]?.type, `detail.${field}`).toContain('null');
      expect(item.properties[field]?.type, `list.${field}`).toContain('null');
    }
    for (const field of ['source', 'book', 'chapter']) {
      expect(detail.properties[field]?.type, `detail.${field}`).toContain('null');
    }
    const takhrij = spec.components.schemas['Takhrij'] as {
      properties: Record<string, { type: unknown }>;
    };
    expect(takhrij.properties['takhrij_text']?.type).toContain('null');
  });

  it('documents the Falah contract resources', () => {
    const required = [
      '/api/v1/hadiths', '/api/v1/hadiths/{id}', '/api/v1/hadiths/random',
      '/api/v1/hadiths/daily', '/api/v1/hadiths/{id}/narrators',
      '/api/v1/hadiths/{id}/references', '/api/v1/hadiths/{id}/takhrij',
      '/api/v1/hadiths/{id}/gradings', '/api/v1/hadiths/{id}/verification',
      '/api/v1/sources', '/api/v1/sources/{id}', '/api/v1/books', '/api/v1/books/{id}',
      '/api/v1/books/{id}/chapters', '/api/v1/books/{id}/hadiths', '/api/v1/chapters/{id}',
      '/api/v1/chapters/{id}/hadiths', '/api/v1/narrators', '/api/v1/gradings',
      '/api/v1/search', '/api/v1/catalog', '/api/v1/stats', '/api/v1/health',
      '/api/v1/version', '/api/v1/datasets',
    ];
    const missing = required.filter((path) => !spec.paths[path]);
    expect(missing).toEqual([]);
  });
});
