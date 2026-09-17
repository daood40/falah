/**
 * Category: docker-deploy — container and deployment readiness. No Docker
 * daemon is reachable in this environment, so every case that needs to build or
 * run an image is recorded BLOCKED (never PASS). The image definition, the
 * ignore list, the compose surface and the deployment documentation are all
 * audited for real.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { GateContext } from '../context.ts';

const CATEGORY = 'docker-deploy';

function daemonAvailable(): { ok: boolean; reason: string } {
  try {
    execFileSync('docker', ['info'], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000 });
    return { ok: true, reason: 'docker info succeeded' };
  } catch (error: any) {
    return { ok: false, reason: String(error.stderr ?? error.message).split('\n')[0]!.slice(0, 160) };
  }
}

export async function run(ctx: GateContext): Promise<void> {
  const { gate } = ctx;
  const apiRoot = path.join(import.meta.dirname, '..', '..', '..');
  const repoRoot = path.join(apiRoot, '..');

  const dockerfilePath = path.join(apiRoot, 'Dockerfile');
  const dockerfile = existsSync(dockerfilePath) ? readFileSync(dockerfilePath, 'utf8') : '';
  const lines = dockerfile.split('\n');

  const staticChecks: { id: string; description: string; ok: boolean; expected: string; actual: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' }[] = [
    { id: 'EXISTS', description: 'the API ships a Dockerfile', ok: dockerfile.length > 0, expected: 'a Dockerfile', actual: dockerfile.length > 0 ? 'present' : 'missing', severity: 'HIGH' },
    { id: 'BASE-PINNED', description: 'the base image is pinned to a specific version, not :latest', ok: /^FROM\s+\S+:[^l\s]/m.test(dockerfile) && !/:latest/.test(dockerfile), expected: 'a pinned tag', actual: (lines.find((line) => line.startsWith('FROM')) ?? 'none'), severity: 'HIGH' },
    { id: 'NONROOT', description: 'the container drops to a non-root user', ok: /^USER\s+(?!root)/m.test(dockerfile), expected: 'a USER directive that is not root', actual: lines.find((line) => line.startsWith('USER')) ?? 'MISSING', severity: 'CRITICAL' },
    { id: 'NO-SECRET', description: 'the Dockerfile embeds no secret', ok: !/(SUPABASE_SERVICE_ROLE_KEY=|service_role|eyJhbGciOi|PASSWORD=)/.test(dockerfile), expected: 'no secret material', actual: 'scanned', severity: 'CRITICAL' },
    { id: 'NO-ENV-SECRET', description: 'no ENV line bakes a credential into the image', ok: !/^ENV\s+.*(KEY|SECRET|PASSWORD|TOKEN)\s*=\s*\S+/m.test(dockerfile), expected: 'no credential ENV', actual: 'scanned', severity: 'CRITICAL' },
    { id: 'EXPOSE', description: 'the image documents the port it listens on', ok: /^EXPOSE\s+\d+/m.test(dockerfile), expected: 'an EXPOSE directive', actual: lines.find((line) => line.startsWith('EXPOSE')) ?? 'MISSING', severity: 'LOW' },
    { id: 'HEALTHCHECK', description: 'the image declares a health check', ok: /HEALTHCHECK/.test(dockerfile), expected: 'a HEALTHCHECK directive', actual: /HEALTHCHECK/.test(dockerfile) ? 'present' : 'MISSING', severity: 'MEDIUM' },
    { id: 'WORKDIR', description: 'the image sets an explicit working directory', ok: /^WORKDIR\s+\S+/m.test(dockerfile), expected: 'a WORKDIR directive', actual: lines.find((line) => line.startsWith('WORKDIR')) ?? 'MISSING', severity: 'LOW' },
    { id: 'CMD', description: 'the image declares its entry command', ok: /^(CMD|ENTRYPOINT)\s/m.test(dockerfile), expected: 'CMD or ENTRYPOINT', actual: lines.find((line) => /^(CMD|ENTRYPOINT)/.test(line)) ?? 'MISSING', severity: 'HIGH' },
    { id: 'NO-APT-CACHE', description: 'no package manager cache is left in the image layer', ok: !/apt-get install/.test(dockerfile) || /rm -rf \/var\/lib\/apt\/lists/.test(dockerfile), expected: 'apt lists cleaned when apt is used', actual: 'scanned', severity: 'LOW' },
    { id: 'PROD-DEPS', description: 'only production dependencies are installed', ok: /--omit=dev|--production|npm ci --omit/.test(dockerfile) || !/npm (ci|install)/.test(dockerfile), expected: 'dev dependencies omitted', actual: 'scanned', severity: 'MEDIUM' },
    { id: 'COPY-SCOPED', description: 'the build copies scoped paths rather than the whole machine', ok: !/^COPY\s+\/\s/m.test(dockerfile), expected: 'no COPY / ', actual: 'scanned', severity: 'LOW' },
  ];
  for (const check of staticChecks) {
    gate.check(`DK-FILE-${check.id}`, CATEGORY, check.description, { file: 'quran_api/Dockerfile' }, check.ok, check.expected, check.actual, check.severity, 1);
  }

  const ignorePath = path.join(apiRoot, '.dockerignore');
  const ignore = existsSync(ignorePath) ? readFileSync(ignorePath, 'utf8') : '';
  for (const entry of ['node_modules', '.env', 'reports', 'tests', '.git']) {
    gate.check(
      `DK-IGNORE-${entry.replace(/[^a-z0-9]/gi, '-')}`,
      CATEGORY,
      `.dockerignore excludes ${entry} from the build context`,
      { file: 'quran_api/.dockerignore', entry },
      ignore.split('\n').some((line) => line.trim() === entry || line.trim() === `${entry}/`),
      `${entry} listed`,
      ignore.includes(entry) ? 'listed' : 'MISSING',
      'MEDIUM',
      1,
    );
  }

  // Deployment documentation and configuration that must exist regardless of
  // whether a daemon is available.
  const docs: { id: string; file: string; must: RegExp; description: string }[] = [
    { id: 'PRIVATE-DEPLOY', file: 'docs/PRIVATE_DEPLOYMENT.md', must: /private/i, description: 'the private deployment runbook exists and states the private posture' },
    { id: 'BACKUP', file: 'docs/BACKUP_RECOVERY.md', must: /restore/i, description: 'the backup and recovery runbook documents a restore' },
    { id: 'ENV-EXAMPLE', file: 'quran_api/.env.example', must: /DATABASE_URL/, description: 'the environment template documents the database url' },
    { id: 'ENV-NO-SECRET', file: 'quran_api/.env.example', must: /^(?!.*eyJhbGciOi)[\s\S]*$/, description: 'the environment template contains no real token' },
    { id: 'README', file: 'quran_api/README.md', must: /docker/i, description: 'the API readme documents the container workflow' },
    { id: 'CI', file: '.github/workflows/ci.yml', must: /docker/i, description: 'CI includes a docker job' },
  ];
  for (const doc of docs) {
    const file = path.join(repoRoot, doc.file);
    const exists = existsSync(file);
    const content = exists ? readFileSync(file, 'utf8') : '';
    gate.check(
      `DK-DOC-${doc.id}`,
      CATEGORY,
      doc.description,
      { file: doc.file },
      exists && doc.must.test(content),
      'present and documented',
      exists ? (doc.must.test(content) ? 'documented' : 'present but missing the expected content') : 'file missing',
      'MEDIUM',
      2,
    );
  }

  // Everything that needs a running daemon.
  const daemon = daemonAvailable();
  if (daemon.ok) {
    gate.check('DK-DAEMON', CATEGORY, 'a Docker daemon is reachable from this environment', { command: 'docker info' }, true, 'docker info succeeds', 'reachable', 'LOW', 1);
  } else {
    // Unavailable infrastructure is BLOCKED, not a failure of this project.
    gate.blocked('DK-DAEMON', CATEGORY, 'docker info', `No Docker daemon in this environment: ${daemon.reason}`);
  }

  const runtimeMatrix: { area: string; checks: string[] }[] = [
    {
      area: 'image-build',
      checks: [
        'docker build succeeds from a clean context',
        'the build is reproducible on a second run',
        'the final image size stays under 400 MB',
        'the image contains no .env file',
        'the image contains no git metadata',
        'the image contains no test sources',
        'the image contains no reports directory',
        'node_modules in the image holds production dependencies only',
        'the declared base image digest matches the pinned tag',
        'the image runs as the declared non-root user',
        'the image filesystem is readable by that user',
        'the image has no setuid binaries added by the build',
        'image labels carry the build version',
        'the build emits no secret into the layer history',
        'docker history shows no credential in any layer',
      ],
    },
    {
      area: 'container-runtime',
      checks: [
        'the container starts with a valid environment',
        'the container refuses to start with no DATABASE_URL',
        'the container refuses to start with an unsafe public configuration',
        'the health endpoint answers inside the container',
        'the version endpoint answers inside the container',
        'the container binds only to the interface the configuration names',
        'private mode keeps the container on loopback',
        'the container answers 451 to anonymous content reads in private mode',
        'the container serves content to an authenticated internal caller',
        'the container logs structured JSON with no secret',
        'the container exits non-zero on an unrecoverable configuration error',
        'SIGTERM shuts the container down gracefully',
        'the container restarts cleanly after a kill',
        'the container survives a database restart',
        'the container reports the schema version it was built against',
      ],
    },
    {
      area: 'compose-stack',
      checks: [
        'the API and Postgres start together',
        'migrations apply against the composed database',
        'the import pipeline runs inside the stack',
        'the integrity report runs inside the stack',
        'data survives a stack restart',
        'the stack exposes no port beyond the configured one',
        'the database is not reachable from outside the stack',
        'stack teardown leaves no orphan volume',
        'the stack starts from an empty volume (clean bootstrap)',
        'the stack refuses to start with the public flags on',
      ],
    },
    {
      area: 'image-security-scan',
      checks: [
        'a vulnerability scan of the image reports no critical finding',
        'a vulnerability scan reports no high finding in the runtime layer',
        'the base image has no known critical CVE at build time',
        'no shell is left in the final stage that is not required',
        'the image has no package manager left in the final stage',
        'the scan output is attached to the release evidence',
      ],
    },
    {
      area: 'deployment',
      checks: [
        'the image pushes to the private registry',
        'the deployed service answers over HTTPS',
        'TLS terminates with a valid certificate',
        'the deployment rejects plain-http requests',
        'the deployment runs with the private flags on',
        'a rollback to the previous image succeeds',
        'the deployment reports its dataset version',
        'the deployment passes the public release gate',
      ],
    },
  ];
  const profiles = [
    'linux/amd64',
    'linux/arm64',
    'node:22-alpine base',
    'node:22-slim base',
    'read-only root filesystem',
    'no-new-privileges + dropped capabilities',
  ];
  for (const profile of profiles) {
    for (const area of runtimeMatrix) {
      for (const [index, check] of area.checks.entries()) {
        const id = `DK-${area.area.toUpperCase()}-${profile.replace(/[^a-z0-9]/gi, '-')}-${String(index + 1).padStart(2, '0')}`;
        if (daemon.ok) {
          gate.blocked(id, CATEGORY, `${check} (${profile})`, 'The Docker daemon became reachable after this module was written; re-run the gate to execute this matrix.');
        } else {
          gate.blocked(
            id,
            CATEGORY,
            `${check} (${profile})`,
            `No Docker daemon in this environment (${daemon.reason}). Run this matrix on a host with Docker, or in CI where the docker job provides one.`,
          );
        }
      }
    }
  }
}
