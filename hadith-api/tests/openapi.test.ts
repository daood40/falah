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

  it('describes the hadith schema with nullable source-dependent fields', () => {
    const hadith = spec.components.schemas['Hadith'] as {
      properties: Record<string, { type: unknown }>;
    };
    for (const field of ['raw_text', 'matn', 'isnad', 'takhrij', 'grading', 'hadith_number']) {
      expect(hadith.properties[field]?.type).toContain('null');
    }
  });
});
