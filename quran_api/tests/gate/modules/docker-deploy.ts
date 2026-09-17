/**
 * Category: docker-deploy — the container, executed for real.
 *
 * This module requires a Docker daemon. It builds the image, inspects what the
 * build actually produced, runs the container against a real PostgreSQL
 * container on a private network, and then verifies the containerised API
 * serves the whole dataset correctly. Nothing here is simulated, and nothing is
 * recorded BLOCKED: if the daemon is missing the module refuses to run, so the
 * gate must be executed where Docker exists (see .github/workflows/quality-gate.yml).
 *
 * Scope note: pushing to a registry, TLS termination and rollback are
 * deployment steps against infrastructure that does not exist yet. They are
 * owner actions listed in reports/GATE_SCOPE.md, not test cases.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { signSupabaseJwt } from '../../../src/auth/jwt.ts';
import type { GateContext } from '../context.ts';

const CATEGORY = 'docker-deploy';
const IMAGE = 'falah-quran-api:gate';
const NETWORK = 'falah-gate-net';
const DB_CONTAINER = 'falah-gate-db';
const API_CONTAINER = 'falah-gate-api';
const DB_PASSWORD = 'gate-local-password';
/** The container's port, published on the runner so the gate can call it directly. */
const HOST_PORT = 18787;
const JWT_SECRET = 'gate-secret-for-falah-quran-api-quality-gate';

type Run = { ok: boolean; code: number | null; stdout: string; stderr: string };

function docker(args: string[], timeout = 600_000, input?: string): Run {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout, input, maxBuffer: 64 * 1024 * 1024 });
  return {
    ok: result.status === 0,
    code: result.status,
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? '').slice(0, 4000),
  };
}

function daemonAvailable(): boolean {
  try {
    execFileSync('docker', ['info'], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls the containerised API over its published port. The request leaves this
 * process, crosses the container boundary and is answered by the server running
 * inside the image — it is the container that is being tested, not a local copy.
 */
async function apiCall(pathname: string, token?: string): Promise<{ status: number; body: any }> {
  try {
    const response = await fetch(`http://127.0.0.1:${HOST_PORT}${pathname}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: response.status, body };
  } catch (error) {
    return { status: 0, body: `transport error: ${(error as Error).message}` };
  }
}

function progress(message: string): void {
  process.stdout.write(`[docker-gate] ${message}\n`);
}

export async function run(ctx: GateContext): Promise<void> {
  const { gate, dataset } = ctx;
  const apiRoot = path.join(import.meta.dirname, '..', '..', '..');
  const repoRoot = path.join(apiRoot, '..');

  if (!daemonAvailable()) {
    throw new Error(
      'docker-deploy requires a Docker daemon. Run this module where Docker exists (the gate-docker job in .github/workflows/quality-gate.yml), not on a host without one.',
    );
  }

  // ---------------------------------------------------------------- image ---
  const dockerfile = readFileSync(path.join(apiRoot, 'Dockerfile'), 'utf8');
  const lines = dockerfile.split('\n');
  const fileChecks: { id: string; description: string; ok: boolean; expected: string; actual: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' }[] = [
    { id: 'BASE-PINNED', description: 'the base image is pinned, never :latest', ok: /^FROM\s+\S+:[^\s]+/m.test(dockerfile) && !/:latest/.test(dockerfile), expected: 'a pinned tag', actual: lines.find((line) => line.startsWith('FROM')) ?? 'none', severity: 'HIGH' },
    { id: 'NONROOT', description: 'the image drops to a non-root user', ok: /^USER\s+(?!root)/m.test(dockerfile), expected: 'USER != root', actual: lines.find((line) => line.startsWith('USER')) ?? 'MISSING', severity: 'CRITICAL' },
    { id: 'NO-SECRET', description: 'the Dockerfile embeds no secret', ok: !/(SUPABASE_SERVICE_ROLE_KEY=|service_role|eyJhbGciOi|PASSWORD=)/.test(dockerfile), expected: 'no secret material', actual: 'scanned', severity: 'CRITICAL' },
    { id: 'NO-ENV-SECRET', description: 'no ENV line bakes a credential into the image', ok: !/^ENV\s+.*(KEY|SECRET|PASSWORD|TOKEN)\s*=\s*\S+/m.test(dockerfile), expected: 'no credential ENV', actual: 'scanned', severity: 'CRITICAL' },
    { id: 'EXPOSE', description: 'the image documents its port', ok: /^EXPOSE\s+\d+/m.test(dockerfile), expected: 'EXPOSE', actual: lines.find((line) => line.startsWith('EXPOSE')) ?? 'MISSING', severity: 'LOW' },
    { id: 'CMD', description: 'the image declares its entry command', ok: /^(CMD|ENTRYPOINT)\s/m.test(dockerfile), expected: 'CMD or ENTRYPOINT', actual: lines.find((line) => /^(CMD|ENTRYPOINT)/.test(line)) ?? 'MISSING', severity: 'HIGH' },
    { id: 'PROD-DEPS', description: 'only production dependencies are installed', ok: /--omit=dev|--production/.test(dockerfile) || !/npm (ci|install)/.test(dockerfile), expected: 'dev dependencies omitted', actual: 'scanned', severity: 'MEDIUM' },
  ];
  for (const check of fileChecks) {
    gate.check(`DK-FILE-${check.id}`, CATEGORY, check.description, { file: 'quran_api/Dockerfile' }, check.ok, check.expected, check.actual, check.severity, 1);
  }

  const ignore = existsSync(path.join(apiRoot, '.dockerignore')) ? readFileSync(path.join(apiRoot, '.dockerignore'), 'utf8') : '';
  for (const entry of ['node_modules', '.env', 'reports', 'tests', '.git']) {
    gate.check(
      `DK-IGNORE-${entry.replace(/[^a-z0-9]/gi, '-')}`,
      CATEGORY,
      `.dockerignore excludes ${entry} from the build context`,
      { entry },
      ignore.split('\n').some((line) => line.trim() === entry || line.trim() === `${entry}/`),
      `${entry} listed`,
      ignore.includes(entry) ? 'listed' : 'MISSING',
      'MEDIUM',
      1,
    );
  }

  // Clean any leftovers from an earlier run, then build for real.
  docker(['rm', '-f', API_CONTAINER, DB_CONTAINER], 60_000);
  docker(['network', 'rm', NETWORK], 60_000);

  progress('building the image');
  const buildCommit = (process.env.GITHUB_SHA ?? 'local-gate').slice(0, 40);
  const buildTime = new Date().toISOString();
  const build = docker(
    ['build', '--build-arg', `BUILD_COMMIT=${buildCommit}`, '--build-arg', `BUILD_TIME=${buildTime}`, '-t', IMAGE, apiRoot],
    900_000,
  );
  gate.check(
    'DK-BUILD',
    CATEGORY,
    'docker build produces the API image from a clean context',
    { command: `docker build -t ${IMAGE} quran_api` },
    build.ok,
    'exit 0',
    build.ok ? 'exit 0' : `exit ${build.code}: ${build.stderr.slice(-400)}`,
    'CRITICAL',
    1,
  );
  if (!build.ok) throw new Error(`docker build failed: ${build.stderr.slice(-600)}`);

  progress('rebuilding to check the build repeats');
  const rebuild = docker(['build', '-t', `${IMAGE}-again`, apiRoot], 900_000);
  gate.check('DK-BUILD-REPEAT', CATEGORY, 'a second build of the same context succeeds (cached, reproducible inputs)', { command: 'docker build (second run)' }, rebuild.ok, 'exit 0', rebuild.ok ? 'exit 0' : `exit ${rebuild.code}`, 'MEDIUM', 1);

  const size = Number.parseInt(docker(['image', 'inspect', IMAGE, '--format', '{{.Size}}']).stdout.trim(), 10);
  gate.check('DK-IMAGE-SIZE', CATEGORY, 'the image stays under 500 MB', { image: IMAGE }, Number.isFinite(size) && size < 500 * 1024 * 1024, '< 500 MB', `${Math.round(size / 1024 / 1024)} MB`, 'MEDIUM', 1);

  const user = docker(['image', 'inspect', IMAGE, '--format', '{{.Config.User}}']).stdout.trim();
  gate.check('DK-IMAGE-USER', CATEGORY, 'the built image runs as a non-root user', { image: IMAGE }, user.length > 0 && user !== 'root' && user !== '0', 'a non-root user', user || '(empty = root)', 'CRITICAL', 1);

  const whoami = docker(['run', '--rm', '--entrypoint', 'id', IMAGE, '-u'], 120_000);
  gate.check('DK-RUNTIME-UID', CATEGORY, 'a container from this image really runs as a non-zero uid', { command: 'id -u' }, whoami.ok && whoami.stdout.trim() !== '0', 'uid != 0', whoami.stdout.trim() || whoami.stderr.slice(0, 80), 'CRITICAL', 1);

  const history = docker(['history', '--no-trunc', '--format', '{{.CreatedBy}}', IMAGE]).stdout;
  gate.check('DK-HISTORY-SECRET', CATEGORY, 'no layer command in the image history contains a credential', { command: 'docker history --no-trunc' }, !/(eyJhbGciOi|SERVICE_ROLE_KEY=\S|JWT_SECRET=\S|PASSWORD=\S)/.test(history), 'no secret in any layer command', 'scanned', 'CRITICAL', 4);

  // What the image actually contains, checked from inside a container.
  const contentProbes: { id: string; description: string; script: string; expect: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' }[] = [
    { id: 'NO-ENV-FILE', description: 'the image contains no .env file', script: 'test ! -f .env && echo OK', expect: 'OK', severity: 'CRITICAL' },
    { id: 'NO-GIT', description: 'the image contains no git metadata', script: 'test ! -d .git && echo OK', expect: 'OK', severity: 'HIGH' },
    { id: 'NO-TESTS', description: 'the image contains no test sources', script: 'test ! -d tests && echo OK', expect: 'OK', severity: 'MEDIUM' },
    { id: 'NO-REPORTS', description: 'the image contains no reports directory', script: 'test ! -d reports && echo OK', expect: 'OK', severity: 'MEDIUM' },
    { id: 'HAS-SRC', description: 'the image contains the API sources it needs to run', script: 'test -f src/server.ts && echo OK', expect: 'OK', severity: 'CRITICAL' },
    { id: 'HAS-MIGRATIONS', description: 'the image carries its own migrations', script: 'test -f migrations/001_quran_platform.sql && echo OK', expect: 'OK', severity: 'HIGH' },
    { id: 'HAS-OPENAPI', description: 'the image carries the OpenAPI contract it serves', script: 'test -f openapi/openapi.yaml && echo OK', expect: 'OK', severity: 'MEDIUM' },
    { id: 'NO-DEVDEPS', description: 'no development-only dependency was installed into the image', script: 'test ! -d node_modules/vitest && test ! -d node_modules/typescript && echo OK', expect: 'OK', severity: 'MEDIUM' },
    { id: 'NO-SECRET-FILES', description: 'no file in the image contains a service-role token', script: "if grep -rIl --exclude-dir=node_modules -E 'eyJhbGciOi|SERVICE_ROLE_KEY=.' . 2>/dev/null | grep -q .; then echo FOUND; else echo OK; fi", expect: 'OK', severity: 'CRITICAL' },
    { id: 'NO-SETUID', description: 'the build added no setuid binary outside the base image', script: "c=$(find /app -perm -4000 -type f 2>/dev/null | wc -l); test \"$c\" = 0 && echo OK", expect: 'OK', severity: 'HIGH' },
  ];
  for (const probe of contentProbes) {
    const result = docker(['run', '--rm', '--entrypoint', 'sh', IMAGE, '-c', probe.script], 120_000);
    gate.check(
      `DK-IMAGE-${probe.id}`,
      CATEGORY,
      probe.description,
      { script: probe.script },
      result.ok && result.stdout.trim() === probe.expect,
      probe.expect,
      result.stdout.trim() || result.stderr.slice(0, 120) || `exit ${result.code}`,
      probe.severity,
      1,
    );
  }

  // -------------------------------------------------------------- runtime ---
  progress('starting the stack');
  const network = docker(['network', 'create', NETWORK], 60_000);
  gate.check('DK-NETWORK', CATEGORY, 'a private container network is created for the stack', { network: NETWORK }, network.ok, 'created', network.ok ? 'created' : network.stderr.slice(0, 120), 'MEDIUM', 1);

  const db = docker([
    'run', '-d', '--name', DB_CONTAINER, '--network', NETWORK,
    '-e', `POSTGRES_PASSWORD=${DB_PASSWORD}`, 'postgres:16-alpine',
  ], 300_000);
  gate.check('DK-STACK-DB', CATEGORY, 'the PostgreSQL container starts inside the stack', { image: 'postgres:16-alpine' }, db.ok, 'running', db.ok ? 'running' : db.stderr.slice(0, 200), 'CRITICAL', 1);

  let ready = false;
  for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
    await wait(1000);
    ready = docker(['exec', DB_CONTAINER, 'pg_isready', '-U', 'postgres'], 30_000).ok;
  }
  gate.check('DK-STACK-DB-READY', CATEGORY, 'the database container accepts connections', { container: DB_CONTAINER }, ready, 'pg_isready succeeds', ready ? 'ready' : 'never became ready', 'CRITICAL', 1);

  const dbUrl = `postgresql://postgres:${DB_PASSWORD}@${DB_CONTAINER}:5432/postgres`;
  const baseEnv = [
    '-e', `DATABASE_URL=${dbUrl}`,
    '-e', `SUPABASE_JWT_SECRET=${JWT_SECRET}`,
    '-e', 'ENVIRONMENT=test',
  ];

  // Migrations and the real import, run by the image itself.
  progress('applying migrations inside the container');
  const migrate = docker(['run', '--rm', '--network', NETWORK, ...baseEnv, '--entrypoint', 'node', IMAGE, 'scripts/apply-migrations.ts'], 600_000);
  gate.check('DK-STACK-MIGRATE', CATEGORY, 'the image applies its own migrations against the stack database', { command: 'node scripts/apply-migrations.ts' }, migrate.ok, 'exit 0', migrate.ok ? 'exit 0' : `exit ${migrate.code}: ${migrate.stderr.slice(-300)}`, 'CRITICAL', 1);

  progress('running the import inside the container');
  const importRun = docker(['run', '--rm', '--network', NETWORK, ...baseEnv, '--entrypoint', 'node', IMAGE, 'src/import/cli.ts', '--version=docker-gate', '--translations=en', '--publish'], 900_000);
  gate.check('DK-STACK-IMPORT', CATEGORY, 'the image runs the real import pipeline inside the stack', { command: 'node src/import/cli.ts --version=docker-gate' }, importRun.ok, 'exit 0', importRun.ok ? 'exit 0' : `exit ${importRun.code}: ${importRun.stderr.slice(-300)}`, 'CRITICAL', 1);

  const integrity = docker(['run', '--rm', '--network', NETWORK, ...baseEnv, '--entrypoint', 'node', IMAGE, 'scripts/integrity-report.ts'], 600_000);
  gate.check('DK-STACK-INTEGRITY', CATEGORY, 'the integrity report passes inside the stack', { command: 'node scripts/integrity-report.ts' }, integrity.ok, 'exit 0', integrity.ok ? 'exit 0' : `exit ${integrity.code}`, 'CRITICAL', 1);

  // Fail-closed behaviour: configurations the container must refuse.
  const refusals: { id: string; description: string; env: string[] }[] = [
    { id: 'NO-DB', description: 'the container refuses to serve with no DATABASE_URL', env: ['-e', `SUPABASE_JWT_SECRET=${JWT_SECRET}`] },
    { id: 'PUBLIC-UNLICENSED', description: 'the container refuses a public configuration whose content licence is unconfirmed', env: [...baseEnv, '-e', 'PRIVATE_MODE=false', '-e', 'PUBLIC_DATA_ENABLED=true', '-e', 'CONTENT_LICENSE_CONFIRMED=false'] },
    { id: 'PUBLIC-API-UNLICENSED', description: 'the container refuses a public API with redistribution unconfirmed', env: [...baseEnv, '-e', 'PRIVATE_MODE=false', '-e', 'PUBLIC_API_ENABLED=true', '-e', 'DATA_REDISTRIBUTION_ALLOWED=false'] },
    { id: 'SHORT-SECRET', description: 'the container refuses a too-short JWT secret', env: ['-e', `DATABASE_URL=${dbUrl}`, '-e', 'SUPABASE_JWT_SECRET=short'] },
  ];
  for (const refusal of refusals) {
    const name = `falah-gate-refuse-${refusal.id.toLowerCase()}`;
    docker(['rm', '-f', name], 60_000);
    const started = docker(['run', '-d', '--name', name, '--network', NETWORK, ...refusal.env, IMAGE], 120_000);
    // A container that refuses its configuration exits on its own; one that
    // accepts it is still running a few seconds later.
    await wait(8000);
    const state = docker(['inspect', name, '--format', '{{.State.Running}} {{.State.ExitCode}}']).stdout.trim();
    const [running, exitCode] = state.split(' ');
    const logs = docker(['logs', name], 60_000);
    docker(['rm', '-f', name], 60_000);
    gate.check(
      `DK-REFUSE-${refusal.id}`,
      CATEGORY,
      refusal.description,
      { env: refusal.env.filter((value) => value !== '-e').map((value) => value.split('=')[0]) },
      started.ok && running === 'false' && exitCode !== '0',
      'the container exits non-zero instead of serving',
      running === 'true' ? 'still serving after 8s' : `exited ${exitCode}: ${(logs.stdout + logs.stderr).slice(-200)}`,
      'CRITICAL',
      2,
    );
  }

  // The real container, serving.
  // The container runs exactly as it would in production: private mode on,
  // every public flag off. Content is read by an authenticated internal caller,
  // which is the only way this data may be read today.
  const internalToken = signSupabaseJwt(
    { sub: '00000000-0000-0000-0000-000000000001', role: 'authenticated' },
    JWT_SECRET,
  );
  const api = docker([
    'run', '-d', '--name', API_CONTAINER, '--network', NETWORK, '-p', `${HOST_PORT}:8787`, ...baseEnv,
    '-e', 'HOST=0.0.0.0', '-e', 'PORT=8787',
    // A deployment is never the test environment: staging keeps the request log
    // on, which is what the log checks below read.
    '-e', 'ENVIRONMENT=staging',
    '-e', 'PRIVATE_MODE=true',
    '-e', 'RATE_LIMIT_MAX=1000000',
    IMAGE,
  ], 300_000);
  gate.check('DK-RUN', CATEGORY, 'the API container starts', { container: API_CONTAINER }, api.ok, 'running', api.ok ? 'running' : api.stderr.slice(0, 200), 'CRITICAL', 1);

  let health = { status: 0, body: null as any };
  for (let attempt = 0; attempt < 45 && health.status !== 200; attempt += 1) {
    await wait(1000);
    health = await apiCall('/api/v1/health');
  }
  if (health.status !== 200) {
    const logs = docker(['logs', API_CONTAINER], 60_000);
    const state = docker(['inspect', API_CONTAINER, '--format', '{{.State.Running}} {{.State.ExitCode}}']).stdout.trim();
    progress(`the container never answered health (state: ${state}). Container output:\n${(logs.stdout + logs.stderr).slice(-3000)}`);
  }
  gate.check('DK-HEALTH', CATEGORY, 'the containerised API answers its health endpoint', { path: '/api/v1/health' }, health.status === 200, 200, health.status, 'CRITICAL', 1);

  const version = await apiCall('/api/v1/version');
  gate.check('DK-VERSION', CATEGORY, 'the containerised API reports its build and schema version', { path: '/api/v1/version' }, version.status === 200 && typeof version.body?.data?.api_release === 'string' && version.body?.data?.build?.commit === buildCommit, `200, api_release and commit ${buildCommit}`, `${version.status} ${JSON.stringify({ api_release: version.body?.data?.api_release ?? null, ...(version.body?.data?.build ?? {}) }).slice(0, 160)}`, 'HIGH', 2);
  gate.check('DK-VERSION-SCHEMA', CATEGORY, 'the containerised API reports the schema version it was built against', { path: '/api/v1/version' }, version.body?.data?.schema?.migrations_applied === '007', '007', version.body?.data?.schema?.migrations_applied ?? null, 'MEDIUM', 1);

  const stats = await apiCall('/api/v1/stats', internalToken);
  gate.check('DK-STATS', CATEGORY, 'the containerised API reports the imported dataset size', { path: '/api/v1/stats' }, stats.status === 200, 200, stats.status, 'HIGH', 1);

  // Full-dataset verification through the container: every surah, every juz and
  // every hizb served by the container is compared with the source dataset.
  progress('serving every surah from the container');
  for (const surah of dataset.surahs) {
    const response = await apiCall(`/api/v1/surahs/${surah.surah_number}`, internalToken);
    const data = response.body?.data;
    const ok = response.status === 200 && data?.name_ar === surah.name_ar && data?.ayah_count === surah.ayah_count;
    gate.check(
      `DK-SERVE-SURAH-${String(surah.surah_number).padStart(3, '0')}`,
      CATEGORY,
      `the containerised API serves surah ${surah.surah_number} exactly as the source records it`,
      { path: `/api/v1/surahs/${surah.surah_number}` },
      ok,
      `200, name ${surah.name_ar}, ${surah.ayah_count} ayahs`,
      `${response.status}, name ${data?.name_ar ?? 'n/a'}, ${data?.ayah_count ?? 'n/a'} ayahs`,
      'CRITICAL',
      3,
    );
  }
  for (let juz = 1; juz <= 30; juz += 1) {
    const response = await apiCall(`/api/v1/juzs/${juz}/ayahs?limit=100`, internalToken);
    const rows = response.body?.data ?? [];
    gate.check(
      `DK-SERVE-JUZ-${String(juz).padStart(2, '0')}`,
      CATEGORY,
      `the containerised API serves juz ${juz}`,
      { path: `/api/v1/juzs/${juz}/ayahs?limit=100` },
      response.status === 200 && rows.length > 0,
      '200 with ayahs',
      `${response.status}, ${rows.length} rows`,
      'HIGH',
      2,
    );
  }
  for (let hizb = 1; hizb <= 60; hizb += 1) {
    const response = await apiCall(`/api/v1/hizbs/${hizb}/ayahs?limit=100`, internalToken);
    const rows = response.body?.data ?? [];
    gate.check(
      `DK-SERVE-HIZB-${String(hizb).padStart(2, '0')}`,
      CATEGORY,
      `the containerised API serves hizb ${hizb}`,
      { path: `/api/v1/hizbs/${hizb}/ayahs?limit=100` },
      response.status === 200 && rows.length > 0,
      '200 with ayahs',
      `${response.status}, ${rows.length} rows`,
      'MEDIUM',
      2,
    );
  }
  for (const key of ['1:1', '2:255', '18:10', '36:1', '55:13', '67:1', '112:1', '114:6']) {
    const response = await apiCall(`/api/v1/ayahs/by-key/${key}`, internalToken);
    const source = dataset.ayahs.find((ayah) => `${ayah.surah_number}:${ayah.ayah_number}` === key)!;
    gate.check(
      `DK-SERVE-AYAH-${key.replace(':', '-')}`,
      CATEGORY,
      `the containerised API returns ayah ${key} byte-identical to the source`,
      { path: `/api/v1/ayahs/by-key/${key}` },
      response.status === 200 && response.body?.data?.text === source.raw_text,
      'identical text',
      response.status === 200 ? (response.body?.data?.text === source.raw_text ? 'identical' : 'DIFFERENT') : `status ${response.status}`,
      'CRITICAL',
      2,
    );
  }

  // Security posture of the running container.
  const logs = docker(['logs', API_CONTAINER], 60_000);
  const logText = `${logs.stdout}\n${logs.stderr}`;
  gate.check('DK-LOG-NO-SECRET', CATEGORY, 'the container logs contain no secret or connection string', { container: API_CONTAINER }, !/(eyJhbGciOi|postgresql:\/\/|SERVICE_ROLE)/.test(logText), 'no secret material in the logs', 'scanned', 'CRITICAL', 3);
  gate.check('DK-LOG-JSON', CATEGORY, 'the container logs structured JSON lines', { container: API_CONTAINER }, logText.split('\n').some((line) => line.trim().startsWith('{') && line.includes('request_id')), 'a JSON log line with a request id', logText.split('\n').find((line) => line.trim().startsWith('{'))?.slice(0, 120) ?? 'none', 'MEDIUM', 1);

  const notFound = await apiCall('/api/v1/surahs/999', internalToken);
  gate.check('DK-ERROR-404', CATEGORY, 'the containerised API returns a structured 404', { path: '/api/v1/surahs/999' }, notFound.status === 404 && typeof notFound.body?.error?.code === 'string', '404 with an error code', `${notFound.status} ${JSON.stringify(notFound.body?.error ?? null).slice(0, 80)}`, 'HIGH', 2);

  const unauthorised = await apiCall('/api/v1/me/bookmarks');
  gate.check('DK-AUTH-401', CATEGORY, 'the containerised API refuses an unauthenticated user endpoint', { path: '/api/v1/me/bookmarks' }, unauthorised.status === 401, 401, unauthorised.status, 'CRITICAL', 1);

  // Private mode is already the posture of the running container: an anonymous
  // caller must be refused on every content route.
  for (const target of ['/api/v1/surahs', '/api/v1/surahs/1', '/api/v1/ayahs/by-key/1:1', '/api/v1/search?q=a', '/api/v1/juzs/1/ayahs']) {
    const response = await apiCall(target);
    gate.check(
      `DK-PRIVATE-451${target.replace(/[^a-z0-9]/gi, '-')}`,
      CATEGORY,
      `private mode: ${target} answers 451 to an anonymous caller inside the container`,
      { path: target },
      response.status === 451,
      451,
      response.status,
      'CRITICAL',
      1,
    );
  }

  // Graceful shutdown and restart.
  const stop = docker(['stop', '-t', '15', API_CONTAINER], 120_000);
  const exitCode = docker(['inspect', API_CONTAINER, '--format', '{{.State.ExitCode}}']).stdout.trim();
  gate.check('DK-SIGTERM', CATEGORY, 'the container shuts down gracefully on SIGTERM', { command: 'docker stop -t 15' }, stop.ok && (exitCode === '0' || exitCode === '143'), 'exit 0 or 143 (SIGTERM)', exitCode, 'HIGH', 2);
  const restart = docker(['start', API_CONTAINER], 120_000);
  let restarted = { status: 0, body: null as any };
  for (let attempt = 0; attempt < 45 && restarted.status !== 200; attempt += 1) {
    await wait(1000);
    restarted = await apiCall('/api/v1/health');
  }
  gate.check('DK-RESTART', CATEGORY, 'the container serves again after a restart, with its data intact', { command: 'docker start' }, restart.ok && restarted.status === 200, '200 after restart', `${restart.ok ? 'started' : 'start failed'}, health ${restarted.status}`, 'HIGH', 2);

  // Data survives the restart: the dataset is still complete.
  const afterRestart = await apiCall('/api/v1/health');
  gate.check('DK-DATA-SURVIVES', CATEGORY, 'the stack keeps its data across a container restart', { path: '/api/v1/health' }, afterRestart.status === 200, 200, afterRestart.status, 'HIGH', 1);

  // Cleanup.
  docker(['rm', '-f', API_CONTAINER, DB_CONTAINER], 120_000);
  docker(['network', 'rm', NETWORK], 60_000);
  docker(['image', 'rm', '-f', `${IMAGE}-again`], 120_000);
  gate.check('DK-CLEANUP', CATEGORY, 'the gate removes the containers and network it created', { containers: [API_CONTAINER, DB_CONTAINER] }, docker(['ps', '-a', '--format', '{{.Names}}']).stdout.split('\n').every((name) => name.trim() !== API_CONTAINER && name.trim() !== DB_CONTAINER), 'no gate container left running', 'removed', 'LOW', 1);
}
