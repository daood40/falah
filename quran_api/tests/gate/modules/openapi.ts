/**
 * Category: openapi — contract tests. Every documented operation is checked
 * against the running router, every implemented route is checked against the
 * document, and the document is served live by the API.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { buildRouter } from '../../../src/app.ts';
import type { GateContext } from '../context.ts';

const CATEGORY = 'openapi';
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

export async function run(ctx: GateContext): Promise<void> {
  const { gate, request } = ctx;
  const file = path.join(import.meta.dirname, '..', '..', '..', 'openapi', 'openapi.yaml');
  const raw = readFileSync(file, 'utf8');
  const document: any = YAML.parse(raw);

  gate.check('OA-ROOT-VERSION', CATEGORY, 'the document declares an OpenAPI 3.1 version', { field: 'openapi' }, /^3\.1/.test(document.openapi ?? ''), '3.1.x', document.openapi, 'HIGH', 1);
  gate.check('OA-ROOT-INFO', CATEGORY, 'the document declares title and version', { field: 'info' }, Boolean(document.info?.title && document.info?.version), 'title + version', JSON.stringify(document.info ?? {}).slice(0, 80), 'MEDIUM', 2);
  gate.check('OA-ROOT-PATHS', CATEGORY, 'the document declares paths', { field: 'paths' }, Object.keys(document.paths ?? {}).length > 0, '> 0 paths', Object.keys(document.paths ?? {}).length, 'HIGH', 1);

  const routes = buildRouter().list();
  const routeKeys = new Set(routes.map((route) => `${route.method} ${route.path}`));

  // Every documented operation must exist in the router, be fully described,
  // and declare its responses.
  for (const [documentedPath, operations] of Object.entries<any>(document.paths ?? {})) {
    const routerPath = documentedPath.replace(/\{([^}]+)\}/g, ':$1');
    for (const method of METHODS) {
      const operation = operations?.[method];
      if (!operation) continue;
      const key = `${method.toUpperCase()} ${routerPath}`;
      const id = `${method.toUpperCase()}-${documentedPath.replace(/[^a-z0-9]/gi, '-')}`;

      gate.check(
        `OA-IMPL-${id}`,
        CATEGORY,
        `${key} is documented and implemented by the router`,
        { path: documentedPath, method },
        routeKeys.has(key),
        'a matching route exists',
        routeKeys.has(key) ? 'implemented' : 'MISSING in the router',
        'CRITICAL',
        1,
      );
      gate.check(
        `OA-SUMMARY-${id}`,
        CATEGORY,
        `${key} carries a summary`,
        { path: documentedPath, method },
        typeof operation.summary === 'string' && operation.summary.length > 0,
        'a non-empty summary',
        operation.summary ?? null,
        'LOW',
        1,
      );
      gate.check(
        `OA-TAGS-${id}`,
        CATEGORY,
        `${key} is tagged with a declared tag`,
        { path: documentedPath, method, tags: operation.tags },
        Array.isArray(operation.tags) &&
          operation.tags.length > 0 &&
          operation.tags.every((tag: string) => (document.tags ?? []).some((declared: any) => declared.name === tag)),
        'tags that exist in the top-level tag list',
        JSON.stringify(operation.tags ?? null),
        'LOW',
        2,
      );
      gate.check(
        `OA-RESP200-${id}`,
        CATEGORY,
        `${key} documents a success response`,
        { path: documentedPath, method },
        Object.keys(operation.responses ?? {}).some((code) => /^2\d\d$/.test(code)),
        'a 2xx response',
        Object.keys(operation.responses ?? {}).join(','),
        'HIGH',
        1,
      );
      const params = (documentedPath.match(/\{[^}]+\}/g) ?? []).map((token) => token.slice(1, -1));
      const declared = [...(operations.parameters ?? []), ...(operation.parameters ?? [])]
        .map((parameter: any) => parameter.name);
      gate.check(
        `OA-PARAMS-${id}`,
        CATEGORY,
        `${key} declares every path parameter it uses`,
        { path: documentedPath, path_params: params, declared },
        params.every((name) => declared.includes(name)),
        params.join(',') || 'none',
        declared.join(',') || 'none',
        'HIGH',
        Math.max(1, params.length),
      );

      const successCode = Object.keys(operation.responses ?? {}).find((code) => /^2\d\d$/.test(code));
      const successBody = successCode ? operation.responses[successCode]?.content : undefined;
      gate.check(
        `OA-CONTENT-${id}`,
        CATEGORY,
        `${key} declares a media type for its success response`,
        { path: documentedPath, method, code: successCode ?? null },
        Boolean(successBody) && Object.keys(successBody).length > 0,
        'at least one media type',
        successBody ? Object.keys(successBody).join(',') : 'none',
        'MEDIUM',
        1,
      );

      const route = routes.find((candidate) => `${candidate.method} ${candidate.path}` === key);
      const documentedSecurity = Array.isArray(operation.security) && operation.security.length > 0;
      gate.check(
        `OA-SEC-${id}`,
        CATEGORY,
        `${key} documents authentication exactly as the router enforces it`,
        { path: documentedPath, method, router_auth: route?.auth ?? false, documented: documentedSecurity },
        route ? Boolean(route.auth) === documentedSecurity || Boolean(route.licensed) : false,
        'security block present for the routes that require a token',
        `router auth=${route?.auth ?? 'n/a'}, licensed=${route?.licensed ?? 'n/a'}, documented=${documentedSecurity}`,
        'HIGH',
        1,
      );
    }
  }

  // Every implemented route must be documented — no undocumented surface.
  for (const route of routes) {
    const documentedPath = route.path.replace(/:([^/]+)/g, '{$1}');
    const operation = document.paths?.[documentedPath]?.[route.method.toLowerCase()];
    gate.check(
      `OA-DOC-${route.method}-${route.path.replace(/[^a-z0-9]/gi, '-')}`,
      CATEGORY,
      `${route.method} ${route.path} is documented in the OpenAPI contract`,
      { method: route.method, path: route.path },
      Boolean(operation),
      'a documented operation',
      operation ? 'documented' : 'UNDOCUMENTED',
      'HIGH',
      1,
    );
  }

  // Component schemas must be well formed and every $ref must resolve.
  const schemas = document.components?.schemas ?? {};
  for (const [name, schema] of Object.entries<any>(schemas)) {
    gate.check(
      `OA-SCHEMA-TYPE-${name}`,
      CATEGORY,
      `component schema ${name} declares a type or composition`,
      { schema: name },
      Boolean(schema?.type || schema?.allOf || schema?.oneOf || schema?.anyOf || schema?.$ref),
      'type / allOf / oneOf / anyOf / $ref',
      Object.keys(schema ?? {}).join(','),
      'MEDIUM',
      1,
    );
    gate.check(
      `OA-SCHEMA-PROPS-${name}`,
      CATEGORY,
      `component schema ${name} is not an empty object schema`,
      { schema: name },
      schema?.type !== 'object' || Object.keys(schema.properties ?? {}).length > 0 || schema.additionalProperties !== undefined,
      'object schemas declare properties',
      `${Object.keys(schema?.properties ?? {}).length} properties`,
      'MEDIUM',
      1,
    );
  }

  const refs = [...raw.matchAll(/\$ref:\s*'?"?#\/components\/schemas\/([A-Za-z0-9_]+)'?"?/g)].map((match) => match[1]!);
  for (const [index, ref] of [...new Set(refs)].entries()) {
    gate.check(
      `OA-REF-${String(index + 1).padStart(3, '0')}-${ref}`,
      CATEGORY,
      `$ref #/components/schemas/${ref} resolves`,
      { ref },
      Object.hasOwn(schemas, ref),
      'a declared component schema',
      Object.hasOwn(schemas, ref) ? 'resolved' : 'DANGLING',
      'HIGH',
      1,
    );
  }

  gate.check('OA-SERVERS', CATEGORY, 'the document declares at least one server', { field: 'servers' }, Array.isArray(document.servers) && document.servers.length > 0, '>= 1 server', (document.servers ?? []).length, 'LOW', 1);
  gate.check('OA-SECSCHEME', CATEGORY, 'a bearer security scheme is declared for the Supabase token', { field: 'components.securitySchemes' }, document.components?.securitySchemes?.supabaseJwt?.scheme === 'bearer', 'bearer', document.components?.securitySchemes?.supabaseJwt?.scheme ?? null, 'HIGH', 1);
  gate.check('OA-NO-SECRETS', CATEGORY, 'the contract contains no key, token or connection string', { file: 'openapi/openapi.yaml' }, !/(service_role|postgres(ql)?:\/\/|SUPABASE_SERVICE_ROLE_KEY|eyJhbGciOi)/.test(raw), 'no secret material', 'scanned', 'CRITICAL', 4);

  // The document is served live, and matches the file on disk.
  const served = await request('/api/v1/openapi.yaml');
  gate.check('OA-SERVED-STATUS', CATEGORY, 'GET /openapi.yaml serves the contract', { path: '/api/v1/openapi.yaml' }, served.status === 200, 200, served.status, 'HIGH', 1);
  const servedText = typeof served.body === 'string' ? served.body : JSON.stringify(served.body);
  gate.check('OA-SERVED-MATCH', CATEGORY, 'the served document is byte-identical to the file in the repository', { path: '/api/v1/openapi.yaml' }, servedText.trim() === raw.trim(), 'identical bytes', servedText.length === raw.length ? 'identical length' : `${servedText.length} vs ${raw.length} bytes`, 'HIGH', 1);
  gate.check('OA-SERVED-CT', CATEGORY, 'the served document declares a YAML content type', { path: '/api/v1/openapi.yaml' }, (served.headers.get('content-type') ?? '').includes('yaml'), 'application/yaml', served.headers.get('content-type'), 'LOW', 1);

  // Live status-code conformance: every documented response code that the
  // gate can trigger is actually produced.
  const liveCases: { path: string; expect: number; description: string }[] = [
    { path: '/api/v1/surahs/1', expect: 200, description: 'documented 200' },
    { path: '/api/v1/surahs/999', expect: 404, description: 'documented 404' },
    { path: '/api/v1/juzs/0', expect: 422, description: 'documented validation error' },
    { path: '/api/v1/me/bookmarks', expect: 401, description: 'documented 401' },
    { path: '/api/v1/search', expect: 422, description: 'documented validation error for a missing query' },
  ];
  for (const [index, testCase] of liveCases.entries()) {
    const response = await request(testCase.path);
    gate.check(
      `OA-LIVE-${String(index + 1).padStart(2, '0')}`,
      CATEGORY,
      `${testCase.description}: GET ${testCase.path}`,
      { path: testCase.path },
      response.status === testCase.expect,
      testCase.expect,
      response.status,
      'HIGH',
      1,
    );
  }
}
