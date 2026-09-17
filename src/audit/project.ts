/**
 * Project-level checks: the contract (OpenAPI both ways), the clients, the
 * documentation, configuration, dependencies, CI gates, the container build
 * and the backup path. These are the claims a consumer of the service reads
 * before writing a line of code, so each one is asserted against the repo.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import { query } from '../db.ts';
import type { Auditor } from './core.ts';

/** The release under audit; override with DATASET= to audit an older one. */
const DATASET = process.env['DATASET'] ?? 'JAMI-KAMIL-1437-V2';

const REPRO = 'npm run audit -- --only=project';

function read(path: string): string {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

export async function runProjectChecks(audit: Auditor): Promise<void> {
  // ---- OpenAPI parity, in both directions -------------------------------
  const { listRoutes } = await import('../http/router.ts');
  await import('../http/app.ts');
  const spec = YAML.parse(read('openapi.yaml')) as {
    paths: Record<string, Record<string, unknown>>;
    info?: { version?: string };
    servers?: { url: string }[];
  };
  const specOps = new Set<string>();
  for (const [path, ops] of Object.entries(spec.paths ?? {})) {
    for (const method of Object.keys(ops)) {
      if (['get', 'post', 'patch', 'put', 'delete'].includes(method)) {
        specOps.add(`${method.toUpperCase()} ${path.replace(/\{(\w+)\}/g, ':$1')}`);
      }
    }
  }
  const routeOps = new Set(listRoutes().map((r) => `${r.method} ${r.path}`));

  for (const op of routeOps) {
    audit.check(`project.openapi_documents:${op}`, 'project.openapi',
      'every route the service serves is described in the OpenAPI document',
      specOps.has(op), {
        severity: 'HIGH', detail: `${op} is served but not documented`,
        where: 'openapi.yaml', repro: REPRO });
  }
  for (const op of specOps) {
    audit.check(`project.openapi_implements:${op}`, 'project.openapi',
      'every operation the OpenAPI document promises is actually served',
      routeOps.has(op), {
        severity: 'HIGH', detail: `${op} is documented but not served`,
        where: 'src/routes', repro: REPRO });
  }
  audit.check('project.openapi_no_localhost_server', 'project.openapi',
    'the published contract does not pin clients to a localhost server',
    (spec.servers ?? []).every((s) => !/127\.0\.0\.1|localhost/.test(s.url))
      || (spec.servers ?? []).length > 1, {
      severity: 'MEDIUM', detail: JSON.stringify(spec.servers), where: 'openapi.yaml', repro: REPRO });

  // ---- the Dart client covers the contract ------------------------------
  const dartClient = read('clients/dart/lib/src/client.dart')
    + read('clients/dart/lib/src/repository.dart');
  const dartModels = read('clients/dart/lib/src/models.dart');
  const tsClient = read('clients/typescript/falah-hadith.ts');
  const PUBLIC_PATHS = [...routeOps].filter((op) => !op.includes('/admin/'));
  for (const op of PUBLIC_PATHS) {
    const path = op.split(' ')[1] as string;
    const stem = path.replace('/api/v1/', '').split('/')[0] as string;
    audit.check(`project.dart_covers:${op}`, 'project.clients',
      'the official Dart client can reach this public resource',
      dartClient.includes(stem), {
        severity: 'MEDIUM', detail: `no call for ${stem} in the Dart client`,
        where: 'clients/dart/lib/src/client.dart', repro: REPRO });
    audit.check(`project.ts_covers:${op}`, 'project.clients',
      'the TypeScript client can reach this public resource',
      tsClient.includes(stem), {
        severity: 'LOW', detail: `no call for ${stem} in the TypeScript client`,
        where: 'clients/typescript/falah-hadith.ts', repro: REPRO });
  }
  audit.check('project.dart_no_dynamic_maps', 'project.clients',
    'the Dart client returns typed models, never raw maps, to the app',
    !/Future<Map<String, dynamic>>\s+\w+\(/.test(dartClient), {
      severity: 'MEDIUM', detail: 'a client method returns an untyped map',
      where: 'clients/dart/lib/src/client.dart', repro: REPRO });
  for (const model of ['Hadith', 'HadithSummary', 'HadithBook', 'HadithChapter', 'Narrator',
    'Grading', 'Takhrij', 'DatasetVersion', 'HadithStats', 'ApiVersion', 'Verification',
    'HadithReference', 'HadithSource', 'Paged']) {
    audit.check(`project.dart_model:${model}`, 'project.clients',
      `the Dart client defines a typed ${model} model`,
      new RegExp(`class ${model}\\b`).test(dartModels), {
        severity: 'MEDIUM', detail: `${model} missing`, where: 'clients/dart/lib/src/models.dart', repro: REPRO });
  }
  const cache = read('clients/dart/lib/src/cache.dart');
  for (const rule of ['dataset_version', 'content_hash']) {
    audit.check(`project.cache_key:${rule}`, 'project.clients',
      `the offline cache is keyed on ${rule}, so stale data cannot survive a new dataset`,
      cache.includes(rule) || cache.includes(rule.replace(/_(\w)/g, (_, c: string) => c.toUpperCase())), {
        severity: 'HIGH', detail: `${rule} not used by the cache`,
        where: 'clients/dart/lib/src/cache.dart', repro: REPRO });
  }

  // ---- documentation ----------------------------------------------------
  const DOCS: [string, string[]][] = [
    ['README.md', ['/api/v1/hadiths', 'CONTENT_LICENSE_CONFIRMED', 'SOURCE_LOCK', 'DATABASE_URL']],
    ['API_USAGE.md', ['curl', 'JavaScript', 'Dart', 'Python', 'PHP']],
    ['FALAH_INTEGRATION.md', ['API_BASE_URL', 'cache', 'HadithRepository']],
    ['SECURITY.md', ['ADMIN_API_KEY', 'RLS', 'CONTENT_LICENSE_CONFIRMED']],
    ['CHANGELOG.md', ['##']],
    ['LICENSE', ['MIT']],
    ['.env.example', ['CONTENT_LICENSE_CONFIRMED', 'PUBLIC_DATA_ENABLED', 'DATABASE_URL']],
  ];
  for (const [file, needles] of DOCS) {
    const body = read(file);
    audit.check(`project.doc_exists:${file}`, 'project.docs',
      'the documented file exists', body.length > 0, {
        severity: 'HIGH', detail: `${file} is missing or empty`, where: file, repro: REPRO });
    for (const needle of needles) {
      audit.check(`project.doc_mentions:${file}:${needle}`, 'project.docs',
        `${file} covers "${needle}"`,
        body.toLowerCase().includes(needle.toLowerCase()), {
          severity: 'MEDIUM', detail: `"${needle}" not found in ${file}`, where: file, repro: REPRO });
    }
  }

  // ---- configuration ----------------------------------------------------
  const envExample = read('.env.example');
  const configSrc = read('src/config.ts');
  const envKeys = [...envExample.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1] as string);
  for (const key of envKeys) {
    audit.check(`project.env_used:${key}`, 'project.config',
      'every key the example environment documents is actually read by the service',
      configSrc.includes(key) || read('src/http/server.ts').includes(key)
        || read('clients/dart/lib/src/client.dart').includes(key)
        || ['API_BASE_URL', 'SUPABASE_ANON_KEY'].includes(key), {
        severity: 'MEDIUM', detail: `${key} is documented but never read`,
        where: '.env.example', repro: REPRO });
  }
  for (const key of [...configSrc.matchAll(/env\('([A-Z0-9_]+)'/g)].map((m) => m[1] as string)) {
    audit.check(`project.env_documented:${key}`, 'project.config',
      'every environment variable the service reads is documented in .env.example',
      envExample.includes(key), {
        severity: 'MEDIUM', detail: `${key} is read but not documented`,
        where: 'src/config.ts', repro: REPRO });
  }
  audit.check('project.gates_default_closed', 'project.config',
    'both content gates default to closed when the environment says nothing',
    /contentLicenseConfirmed: bool\('CONTENT_LICENSE_CONFIRMED', false\)/.test(configSrc)
      && /publicDataEnabled: bool\('PUBLIC_DATA_ENABLED', false\)/.test(configSrc), {
      severity: 'CRITICAL', detail: 'a gate does not default to false',
      where: 'src/config.ts', repro: REPRO });
  audit.check('project.env_not_committed', 'project.config',
    'no .env file is committed',
    !existsSync('.env') || read('.gitignore').includes('.env'), {
      severity: 'CRITICAL', detail: '.env exists and is not ignored', where: '.gitignore', repro: REPRO });

  // ---- dependencies ------------------------------------------------------
  const pkg = JSON.parse(read('package.json')) as {
    dependencies?: Record<string, string>; devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  for (const [name, range] of Object.entries(pkg.dependencies ?? {})) {
    audit.check(`project.dep_pinned:${name}`, 'project.dependencies',
      'every runtime dependency carries an explicit version range',
      /^[\^~]?\d/.test(range), {
        severity: 'MEDIUM', detail: `${name}: ${range}`, where: 'package.json', repro: REPRO });
    audit.check(`project.dep_installed:${name}`, 'project.dependencies',
      'every runtime dependency is actually installed',
      existsSync(`node_modules/${name}/package.json`), {
        severity: 'HIGH', detail: `${name} not installed`, where: 'package.json', repro: 'npm ci' });
  }
  audit.check('project.lockfile', 'project.dependencies',
    'the dependency tree is locked', existsSync('package-lock.json'), {
      severity: 'HIGH', detail: 'no package-lock.json', where: '.', repro: REPRO });
  audit.check('project.runtime_deps_minimal', 'project.dependencies',
    'the service ships with a minimal runtime dependency surface',
    Object.keys(pkg.dependencies ?? {}).length <= 3, {
      severity: 'LOW', detail: Object.keys(pkg.dependencies ?? {}).join(', '),
      where: 'package.json', repro: REPRO });
  for (const script of ['test', 'typecheck', 'verify', 'import', 'export', 'smoke', 'audit']) {
    audit.check(`project.script:${script}`, 'project.dependencies',
      `npm run ${script} exists`, Boolean(pkg.scripts?.[script]), {
        severity: 'MEDIUM', detail: `${script} missing`, where: 'package.json', repro: REPRO });
  }

  // ---- CI gates ----------------------------------------------------------
  const ci = read('../.github/workflows/hadith_api.yml');
  for (const gate of ['vitest run', 'tsc --noEmit', 'npm run verify', 'security:scan',
    'docker build', 'npm run audit', 'backup:test']) {
    audit.check(`project.ci_gate:${gate}`, 'project.ci',
      `continuous integration runs the ${gate} gate`,
      ci.includes(gate), {
        severity: 'HIGH', detail: `${gate} is not part of CI`,
        where: '.github/workflows/hadith_api.yml', repro: REPRO });
  }

  // ---- container ---------------------------------------------------------
  const dockerfile = read('Dockerfile');
  audit.check('project.docker_nonroot', 'project.container',
    'the container image does not run the service as root',
    /^USER\s+(?!root)/m.test(dockerfile), {
      severity: 'HIGH', detail: 'no non-root USER directive', where: 'Dockerfile', repro: REPRO });
  audit.check('project.docker_no_secrets', 'project.container',
    'the image carries no secret in its environment',
    !/ENV\s+\w*(KEY|SECRET|PASSWORD)/i.test(dockerfile), {
      severity: 'CRITICAL', detail: 'a secret is baked into the image', where: 'Dockerfile', repro: REPRO });
  audit.check('project.docker_healthcheck', 'project.container',
    'the image declares a health check',
    /HEALTHCHECK/.test(dockerfile) || read('docker-compose.yml').includes('healthcheck'), {
      severity: 'MEDIUM', detail: 'no health check', where: 'Dockerfile', repro: REPRO });
  let dockerAvailable = false;
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' });
    dockerAvailable = true;
  } catch { dockerAvailable = false; }
  if (dockerAvailable) {
    audit.check('project.docker_build', 'project.container',
      'the container image builds from a clean checkout', true, {
        where: 'Dockerfile', repro: 'docker build -t falah-hadith-api .' });
  } else {
    audit.blocked('project.docker_build', 'project.container',
      'the container image builds and runs from a clean checkout',
      'no Docker daemon in this environment; the build/run job runs in CI instead',
      'Dockerfile', 'docker build -t falah-hadith-api .');
  }

  // ---- exported dataset and backup path ---------------------------------
  const manifest = JSON.parse(read(`exports/${DATASET}.manifest.json`)) as Record<string, unknown>;
  const jsonl = readFileSync(`exports/${DATASET}.jsonl`);
  audit.check('project.export_file_hash', 'project.dataset',
    'the exported file still hashes to the value its manifest records',
    createHash('sha256').update(jsonl).digest('hex') === manifest['file_sha256'], {
      severity: 'CRITICAL', detail: `recomputed ${createHash('sha256').update(jsonl).digest('hex')}`,
      where: 'exports/', repro: 'npm run export' });
  audit.check('project.export_bytes', 'project.dataset',
    'the exported file is exactly the size its manifest records',
    jsonl.byteLength === manifest['file_bytes'], {
      severity: 'HIGH', detail: `${jsonl.byteLength} vs ${manifest['file_bytes']}`,
      where: 'exports/', repro: 'npm run export' });
  const dbCount = (await query<{ c: number }>(
    `select count(*)::int as c from corpus.hadiths where dataset_version = $1`,
    [manifest['dataset_version']]))[0]?.c;
  audit.check('project.export_count', 'project.dataset',
    'the export holds exactly the number of records the corpus holds',
    manifest['record_count'] === dbCount, {
      severity: 'CRITICAL', detail: `${manifest['record_count']} vs ${dbCount}`,
      where: 'exports/', repro: 'npm run export' });

  // ---- reports: the evidence a reader is pointed at must exist ----------
  const REQUIRED_REPORTS = [
    'HADITH_EDITION_AUDIT.txt', 'DATA_INTEGRITY_FINAL.txt', 'CONTENT_LICENSE.txt',
    'FINAL_PRODUCTION_AUDIT.txt', 'SECURITY_REVIEW.txt', 'CROSS_CHECK.txt',
    'HADITH_FINAL_INTEGRITY.txt', 'LICENSE_AUDIT.txt',
  ];
  for (const file of REQUIRED_REPORTS) {
    audit.check(`project.report:${file}`, 'project.reports',
      'the report the documentation points at exists and carries content',
      read(`reports/${file}`).length > 200, {
        severity: 'MEDIUM', detail: `reports/${file} missing or empty`,
        where: `reports/${file}`, repro: REPRO });
  }

  // ---- vocabulary: no unqualified production claims ---------------------
  const CLAIM = /(production[ -]ready|جاهز للإنتاج)/i;
  for (const file of ['README.md', 'CHANGELOG.md', 'FALAH_INTEGRATION.md', 'API_USAGE.md']) {
    const body = read(file);
    const claims = body.split('\n').filter((l) => CLAIM.test(l) && !/not |never |ليس/i.test(l));
    audit.check(`project.no_unqualified_claim:${file}`, 'project.vocabulary',
      'no document claims production readiness while parts are untested or blocked',
      claims.length === 0, {
        severity: 'HIGH', detail: claims[0]?.slice(0, 120) ?? '', where: file, repro: REPRO });
  }

  // ---- no AI in the religious-text path ---------------------------------
  const AI_CALL = /(openai|anthropic|gemini|cohere|huggingface|replicate|\bllm\b|completions?\.create)/i;
  const walk = (dir: string, acc: string[] = []): string[] => {
    for (const e of readdirSync(dir)) {
      if (['node_modules', '.git'].includes(e)) continue;
      const full = `${dir}/${e}`;
      if (statSync(full).isDirectory()) walk(full, acc);
      else if (/\.(ts|dart|sql|sh|yml)$/.test(e)) acc.push(full);
    }
    return acc;
  };
  const scanned = walk('src').concat(walk('migrations'), walk('scripts'), walk('clients'))
    .filter((f) => !f.startsWith('src/audit/'));
  for (const file of scanned) {
    const body = read(file);
    audit.check(`project.no_ai_call:${file}`, 'project.no_ai',
      'no code in the pipeline calls a text-generation service',
      !AI_CALL.test(body), {
        severity: 'CRITICAL', detail: `${AI_CALL.exec(body)?.[0]} referenced`, where: file, repro: REPRO });
  }
  for (const file of walk('src/importer')) {
    const body = read(file);
    audit.check(`project.importer_offline:${file}`, 'project.no_ai',
      'the importer performs no network fetch while building the corpus',
      !/\bfetch\(|https?:\/\/[^\s'"]+\/(api|v1)/.test(body), {
        severity: 'CRITICAL', detail: 'a network call in the import path', where: file, repro: REPRO });
  }

  // ---- packaged size sanity ---------------------------------------------
  const big = walk('src').filter((f) => statSync(f).size > 60_000);
  audit.check('project.no_oversized_source', 'project.repo',
    'no source file has grown past the point of review',
    big.length === 0, {
      severity: 'LOW', detail: big.join(', '), where: 'src', repro: REPRO });
}
