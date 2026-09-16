#!/usr/bin/env node
/**
 * OpenAPI validation + contract check:
 *  1. the document parses and has the required OpenAPI structure,
 *  2. every $ref resolves,
 *  3. the documented paths/methods match the live router exactly.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'yaml';
import { buildRouter } from '../src/app.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SPEC_PATH = path.join(here, '..', 'openapi', 'openapi.yaml');

export type SpecIssue = string;

export function loadSpec(specPath = SPEC_PATH): Record<string, any> {
  return parse(readFileSync(specPath, 'utf8')) as Record<string, any>;
}

function collectRefs(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((item) => collectRefs(item, found));
  else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') found.push(value);
      else collectRefs(value, found);
    }
  }
  return found;
}

function resolveRef(spec: Record<string, any>, ref: string): boolean {
  if (!ref.startsWith('#/')) return false;
  let node: any = spec;
  for (const segment of ref.slice(2).split('/')) {
    node = node?.[segment.replace(/~1/g, '/').replace(/~0/g, '~')];
    if (node === undefined) return false;
  }
  return true;
}

export function validateSpec(spec: Record<string, any>): SpecIssue[] {
  const issues: SpecIssue[] = [];
  if (!/^3\.[01]\./.test(String(spec.openapi))) issues.push('openapi version must be 3.0.x or 3.1.x');
  if (!spec.info?.title) issues.push('info.title is required');
  if (!spec.info?.version) issues.push('info.version is required');
  if (!spec.paths || Object.keys(spec.paths).length === 0) issues.push('paths is required');
  if (!spec.components?.securitySchemes?.supabaseJwt) {
    issues.push('components.securitySchemes.supabaseJwt is required');
  }

  for (const ref of new Set(collectRefs(spec))) {
    if (!resolveRef(spec, ref)) issues.push(`unresolved $ref: ${ref}`);
  }

  for (const [route, item] of Object.entries(spec.paths as Record<string, any>)) {
    for (const [method, operation] of Object.entries(item as Record<string, any>)) {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;
      if (!operation.summary) issues.push(`${method.toUpperCase()} ${route}: missing summary`);
      if (!operation.responses || Object.keys(operation.responses).length === 0) {
        issues.push(`${method.toUpperCase()} ${route}: missing responses`);
      }
      const declared = new Set(
        (operation.parameters ?? [])
          .map((p: any) => p.name ?? p.$ref?.split('/').pop())
          .filter(Boolean),
      );
      for (const name of route.matchAll(/\{([^}]+)\}/g)) {
        if (!declared.has(name[1])) {
          issues.push(`${method.toUpperCase()} ${route}: path parameter ${name[1]} not documented`);
        }
      }
      if (route.startsWith('/api/v1/me/') && !operation.security) {
        issues.push(`${method.toUpperCase()} ${route}: user endpoint must declare security`);
      }
    }
  }
  return issues;
}

export function contractIssues(spec: Record<string, any>): SpecIssue[] {
  const issues: SpecIssue[] = [];
  const documented = new Set<string>();
  for (const [route, item] of Object.entries(spec.paths as Record<string, any>)) {
    for (const method of Object.keys(item as Record<string, any>)) {
      if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
        documented.add(`${method.toUpperCase()} ${route}`);
      }
    }
  }
  const implemented = new Set(
    buildRouter()
      .list()
      .map((route) => `${route.method} ${route.path.replace(/:([^/]+)/g, '{$1}')}`),
  );
  for (const key of implemented) {
    if (!documented.has(key)) issues.push(`implemented but not documented: ${key}`);
  }
  for (const key of documented) {
    if (!implemented.has(key)) issues.push(`documented but not implemented: ${key}`);
  }
  return issues;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const spec = loadSpec();
  const issues = [...validateSpec(spec), ...contractIssues(spec)];
  if (issues.length > 0) {
    console.error(`OpenAPI validation failed (${issues.length} issue(s)):`);
    issues.forEach((issue) => console.error(` - ${issue}`));
    process.exit(1);
  }
  const operations = Object.values(spec.paths as Record<string, any>).reduce(
    (sum, item) => sum + Object.keys(item).filter((k) => ['get', 'post', 'put', 'delete'].includes(k)).length,
    0,
  );
  console.log(`OpenAPI OK — ${Object.keys(spec.paths).length} paths, ${operations} operations, contract matches router.`);
}
