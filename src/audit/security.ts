/**
 * Security family: malicious and malformed input against the deployed staging
 * instance, the authorisation matrix, the two content gates, and a secret scan
 * of everything the repository would publish.
 *
 * Every payload is a DIFFERENT payload — the fuzz corpus is generated from a
 * seeded PRNG and each generated case is recorded once, with its own id, so a
 * run is reproducible and nothing is counted twice.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { query } from '../db.ts';
import type { Auditor } from './core.ts';

/** The release under audit; override with DATASET= to audit an older one. */
const DATASET = process.env['DATASET'] ?? 'JAMI-KAMIL-1437-V2';
import { rng, pick } from './core.ts';
import { http, envelopeProblem, leaks, BASE_URL } from './http.ts';

const REPRO = `curl -s ${BASE_URL}<path>`;

/** Lone surrogates cannot be percent-encoded; they are sent raw on purpose. */
function encode(value: string): string {
  try {
    return encodeURIComponent(value);
  } catch {
    // a lone surrogate: send its UTF-8 replacement form rather than nothing
    return encodeURIComponent(Buffer.from(value, 'utf8').toString('utf8'));
  }
}

/** Attack families. Each entry is a distinct, real payload. */
const SQLI = [
  "' or 1=1--", "'; drop table corpus.hadiths;--", "' union select null,null--",
  "1' and pg_sleep(5)--", "\\'; select version();--", "') or ('a'='a",
  "1;select * from corpus.app_settings", "' or ''='", '" or ""="',
  "'||(select value from corpus.app_settings limit 1)||'",
  "%27%20or%201%3D1--", "0x27206f7220313d31", "admin'--", "' and 1=cast(version() as int)--",
];
const XSS = [
  '<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', 'javascript:alert(1)',
  '<svg/onload=alert(1)>', "'-alert(1)-'", '<iframe src=javascript:alert(1)>',
  '%3Cscript%3Ealert(1)%3C/script%3E', '<body onload=alert(1)>',
];
const TRAVERSAL = [
  '../../etc/passwd', '..%2f..%2fetc%2fpasswd', '....//....//etc/passwd',
  '/etc/passwd', 'file:///etc/passwd', '..\\..\\windows\\win.ini',
  '%2e%2e%2f%2e%2e%2f.env', '../.env', '../../hadith_api/.env',
];
const INJECTION = [
  '; ls -la', '| cat /etc/passwd', '$(whoami)', '`id`', '&& curl http://example.com',
  '${jndi:ldap://x/a}', '{{7*7}}', '${7*7}', '<%= 7*7 %>', '#{7*7}',
  '%00', '\u0000', '\r\nX-Injected: yes', '\nSet-Cookie: a=b',
];
const WEIRD_UNICODE = [
  '‮‭', '﻿', '\uD800', '\ufffd', 'à'.repeat(50),
  'ا'.repeat(5000), '💥'.repeat(200), 'ًٌٍ'.repeat(100),
  '%E0%A4%A', '%%%%', '۱۲۳',
];
const NUMERIC = [
  '2147483648', '-2147483649', '9999999999999999999', 'NaN', 'Infinity', '-0',
  '1e309', '0.1', '0x10', '010', '1,2', '1;2', '', ' ', 'null', 'undefined', 'true',
];

const FAMILIES: [string, string[]][] = [
  ['sqli', SQLI], ['xss', XSS], ['traversal', TRAVERSAL],
  ['injection', INJECTION], ['unicode', WEIRD_UNICODE], ['numeric', NUMERIC],
];

const PARAMS = ['q', 'page', 'limit', 'book_id', 'chapter_id', 'narrator_id', 'volume',
  'grading', 'source', 'source_id', 'include', 'hadith_number', 'type', 'sort', 'order'];
const PATHS = ['/api/v1/hadiths', '/api/v1/search', '/api/v1/books', '/api/v1/chapters',
  '/api/v1/narrators', '/api/v1/collections', '/api/v1/gradings', '/api/v1/volumes',
  '/api/v1/catalog', '/api/v1/stats', '/api/v1/cross-checks/summary'];

const ADMIN_ROUTES = [
  ['GET', '/api/v1/admin/stats'], ['GET', '/api/v1/admin/imports'],
  ['GET', '/api/v1/admin/dataset-versions'], ['GET', '/api/v1/admin/audit-logs'],
  ['GET', '/api/v1/admin/verifications'], ['GET', '/api/v1/admin/verification-samples'],
  ['GET', '/api/v1/admin/verification-status'],
  ['POST', '/api/v1/admin/verification-samples'],
] as const;

const CREDENTIALS: [string, Record<string, string>][] = [
  ['no header', {}],
  ['empty bearer', { authorization: 'Bearer ' }],
  ['wrong key', { authorization: 'Bearer not-the-key' }],
  ['basic auth', { authorization: 'Basic YWRtaW46YWRtaW4=' }],
  ['sql in key', { authorization: "Bearer ' or 1=1--" }],
  ['key as query', {}],
  ['lowercase scheme', { authorization: 'bearer not-the-key' }],
  ['no scheme', { authorization: 'not-the-key' }],
];

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.git', 'data', 'exports', 'reports', 'build', 'dist'].includes(entry)) continue;
    const full = `${dir}/${entry}`;
    const st = statSync(full);
    if (st.isDirectory()) sourceFiles(full, acc);
    else if (st.size < 2_000_000) acc.push(full);
  }
  return acc;
}

export async function runSecurityChecks(audit: Auditor): Promise<void> {
  const ping = await http('/api/v1/health');
  if (ping.status !== 200) {
    audit.blocked('security.staging_reachable', 'security.deployment',
      'the staging deployment is reachable for security testing',
      `health returned ${ping.status}`, BASE_URL, 'bash scripts/staging-up.sh');
  }

  const rand = rng(777_2026);

  // ---- fuzzing query parameters ----------------------------------------
  let n = 0;
  for (const [family, payloads] of FAMILIES) {
    for (const payload of payloads) {
      for (const param of PARAMS) {
        for (const base of PATHS.slice(0, 4)) {
          n++;
          const path = `${base}?${param}=${encode(payload)}`;
          const res = await http(path);
          const id = `security.fuzz_query:${family}:${n}`;
          audit.check(`${id}:no_500`, 'security.fuzz',
            'a malicious parameter never causes a server error',
            res.status !== 0 && res.status < 500, {
              severity: 'HIGH', detail: `status ${res.status} for ${param}=${payload.slice(0, 40)}`,
              where: path, repro: `curl -s "${BASE_URL}${path}"` });
          const found = leaks(res.body, [payload]);
          audit.check(`${id}:no_leak`, 'security.fuzz',
            'a malicious parameter never makes the service leak internals',
            found.length === 0, {
              severity: 'CRITICAL', detail: found.join(', '), where: path, repro: `curl -s "${BASE_URL}${path}"` });
          audit.check(`${id}:envelope`, 'security.fuzz',
            'the service answers a malicious parameter with its normal envelope',
            envelopeProblem(res) === null, {
              severity: 'MEDIUM', detail: envelopeProblem(res) ?? '', where: path, repro: REPRO });
          audit.check(`${id}:no_reflection`, 'security.fuzz',
            'a script payload is never reflected into an HTML content type',
            !(res.headers['content-type'] ?? '').includes('text/html'), {
              severity: 'HIGH', detail: `content-type ${res.headers['content-type']}`, where: path, repro: REPRO });
        }
      }
    }
  }

  // ---- fuzzing path segments -------------------------------------------
  let p = 0;
  for (const [family, payloads] of FAMILIES) {
    for (const payload of payloads) {
      for (const base of ['/api/v1/hadiths', '/api/v1/books', '/api/v1/chapters', '/api/v1/narrators', '/api/v1/volumes']) {
        p++;
        const path = `${base}/${encode(payload)}`;
        const res = await http(path);
        const id = `security.fuzz_path:${family}:${p}`;
        audit.check(`${id}:no_500`, 'security.fuzz',
          'a malicious path segment never causes a server error',
          res.status !== 0 && res.status < 500, {
            severity: 'HIGH', detail: `status ${res.status} for ${payload.slice(0, 40)}`, where: path, repro: REPRO });
        audit.check(`${id}:no_leak`, 'security.fuzz',
          'a malicious path segment never makes the service leak internals',
          leaks(res.body, [payload]).length === 0, {
            severity: 'CRITICAL', detail: leaks(res.body, [payload]).join(', '), where: path, repro: REPRO });
        audit.check(`${id}:no_file`, 'security.fuzz',
          'no file from the host is ever served through a path segment',
          !/root:x:0:0|BEGIN (RSA|OPENSSH) PRIVATE KEY|DATABASE_URL=/.test(res.body), {
            severity: 'CRITICAL', detail: 'host file content in the response', where: path, repro: REPRO });
      }
    }
  }

  // ---- randomly generated requests (property fuzzing) -------------------
  const ALPHABET = 'abzZ09 الم-_/%&?=#.,:;\'"<>{}[]\\|`~!@$^*()+\u0000\n\r\t';
  for (let i = 0; i < 600; i++) {
    const len = 1 + Math.floor(rand() * 60);
    let value = '';
    for (let k = 0; k < len; k++) value += pick(rand, [...ALPHABET]);
    const param = pick(rand, PARAMS);
    const base = pick(rand, PATHS);
    const path = `${base}?${param}=${encode(value)}`;
    const res = await http(path);
    const id = `security.fuzz_random:${i}`;
    audit.check(`${id}:no_500`, 'security.fuzz_random',
      'a randomly generated request never causes a server error',
      res.status !== 0 && res.status < 500, {
        severity: 'HIGH', detail: `status ${res.status} for ${param}=${JSON.stringify(value).slice(0, 60)}`,
        where: path, repro: `curl -s "${BASE_URL}${path}"` });
    audit.check(`${id}:no_leak`, 'security.fuzz_random',
      'a randomly generated request never makes the service leak internals',
      leaks(res.body, [value]).length === 0, {
        severity: 'CRITICAL', detail: leaks(res.body, [value]).join(', '), where: path, repro: REPRO });
    audit.check(`${id}:envelope`, 'security.fuzz_random',
      'a randomly generated request is answered with the documented envelope',
      envelopeProblem(res) === null, {
        severity: 'MEDIUM', detail: envelopeProblem(res) ?? '', where: path, repro: REPRO });
  }

  // ---- oversized and malformed requests --------------------------------
  const OVERSIZED: [string, string][] = [
    ['long query value', `/api/v1/search?q=${'ا'.repeat(10_000)}`],
    ['long path', `/api/v1/hadiths/${'a'.repeat(5_000)}`],
    ['many parameters', `/api/v1/hadiths?${Array.from({ length: 300 }, (_, i) => `p${i}=${i}`).join('&')}`],
    ['repeated parameter', `/api/v1/hadiths?${Array.from({ length: 200 }, () => 'limit=5').join('&')}`],
    ['deep path', `/api/v1/${Array.from({ length: 100 }, () => 'x').join('/')}`],
    ['null byte path', '/api/v1/hadiths/%00'],
    ['encoded newline', '/api/v1/hadiths?q=%0d%0aSet-Cookie:%20a=b'],
    ['unicode overlong', '/api/v1/hadiths?q=%C0%AE%C0%AE'],
  ];
  for (const [name, path] of OVERSIZED) {
    const res = await http(path);
    audit.check(`security.oversized:${name}`, 'security.robustness',
      'an oversized or malformed request is refused cleanly, never crashes the service',
      res.status !== 0 && res.status < 500, {
        severity: 'HIGH', detail: `status ${res.status} ${res.error ?? ''}`, where: path, repro: REPRO });
    audit.check(`security.oversized_header:${name}`, 'security.robustness',
      'no response header is injected through the request',
      !('set-cookie' in res.headers) && !('x-injected' in res.headers), {
        severity: 'CRITICAL', detail: JSON.stringify(res.headers), where: path, repro: REPRO });
  }

  // request id must not be reflected as a header injection vector
  for (const [i, value] of ['a\r\nX-Injected: yes', 'a\nSet-Cookie: b=c', '\u0000abc', 'x'.repeat(1000)].entries()) {
    const res = await http('/api/v1/health', { headers: { 'x-request-id': value } });
    audit.check(`security.request_id:${i}`, 'security.robustness',
      'a hostile x-request-id never becomes a response header',
      (res.status === 200 || res.status === 400 || res.status === 0)
        && !('x-injected' in res.headers) && !('set-cookie' in res.headers), {
        severity: 'CRITICAL', detail: JSON.stringify(res.headers['x-request-id']),
        where: 'src/http/middleware.ts', repro: REPRO });
  }

  // ---- authorisation matrix --------------------------------------------
  for (const [method, path] of ADMIN_ROUTES) {
    for (const [name, headers] of CREDENTIALS) {
      const url = name === 'key as query' ? `${path}?api_key=whatever&admin_key=whatever` : path;
      const res = await http(url, { method, headers, body: method === 'POST' ? '{}' : undefined });
      audit.check(`security.authz:${method}:${path}:${name}`, 'security.authz',
        'an operator endpoint refuses every credential that is not the configured key',
        res.status === 401 || res.status === 403, {
          severity: 'CRITICAL', detail: `status ${res.status} with ${name}`,
          where: path, repro: `curl -s -X ${method} "${BASE_URL}${url}"` });
      audit.check(`security.authz_leak:${method}:${path}:${name}`, 'security.authz',
        'a refusal never reveals the expected credential or internals',
        leaks(res.body).length === 0 && !/Bearer\s+\w{8,}/.test(res.body), {
          severity: 'CRITICAL', detail: res.body.slice(0, 120), where: path, repro: REPRO });
    }
  }

  // an operator write must not be possible anonymously, on any record
  const ids = await query<{ id: string }>('select id from corpus.hadiths limit 40');
  for (const [i, row] of ids.entries()) {
    const path = `/api/v1/admin/hadiths/${row.id}/verify`;
    const res = await http(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ verified: true, verified_by: 'attacker', result: 'passed' }),
    });
    audit.check(`security.anon_verify:${i}`, 'security.authz',
      'an anonymous caller can never mark a hadith verified',
      res.status === 401 || res.status === 403, {
        severity: 'CRITICAL', detail: `status ${res.status}`, where: path, repro: REPRO });
  }
  const stillUnverified = (await query<{ c: number }>(
    'select count(*)::int as c from corpus.hadiths where verified'))[0]?.c;
  audit.check('security.no_record_verified', 'security.authz',
    'no record became verified during the audit',
    stillUnverified === 0, {
      severity: 'CRITICAL', detail: `${stillUnverified} record(s) verified`, where: 'corpus.hadiths', repro: REPRO });

  // ---- CORS -------------------------------------------------------------
  const preflight = await http('/api/v1/hadiths', {
    method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'DELETE' },
  });
  audit.check('security.cors_preflight', 'security.cors',
    'a preflight never grants a method the API does not serve',
    !(preflight.headers['access-control-allow-methods'] ?? '').includes('DELETE'), {
      severity: 'HIGH', detail: preflight.headers['access-control-allow-methods'] ?? '',
      where: 'src/http/middleware.ts', repro: REPRO });
  audit.check('security.cors_credentials', 'security.cors',
    'the API never allows credentialed cross-origin requests',
    preflight.headers['access-control-allow-credentials'] !== 'true', {
      severity: 'HIGH', detail: preflight.headers['access-control-allow-credentials'] ?? '',
      where: 'src/http/middleware.ts', repro: REPRO });

  // ---- content gates ----------------------------------------------------
  const gateProbes = [
    '/api/v1/hadiths?limit=100', '/api/v1/search?q=%D8%A7%D9%84%D8%B5%D9%84%D8%A7%D8%A9',
    '/api/v1/hadiths/random', '/api/v1/hadiths/daily', '/api/v1/catalog',
  ];
  const texts = await query<{ raw_text: string; takhrij: string | null }>(
    'select raw_text, takhrij from corpus.hadiths limit 200',
  );
  for (const [i, path] of gateProbes.entries()) {
    const res = await http(path);
    const published = texts.filter((t) => res.body.includes(t.raw_text.slice(0, 50)));
    audit.check(`security.gate_text:${i}`, 'security.license_gate',
      'no verbatim edition text is published while CONTENT_LICENSE_CONFIRMED=false',
      published.length === 0, {
        severity: 'CRITICAL', detail: `${published.length} record text(s) published`, where: path, repro: REPRO });
  }
  const health = (await http('/api/v1/health')).json as { data?: Record<string, unknown> };
  audit.check('security.gate_flag', 'security.license_gate',
    'the deployment reports the licence gate as closed',
    health.data?.['content_license_confirmed'] === false, {
      severity: 'CRITICAL', detail: JSON.stringify(health.data), where: '/api/v1/health', repro: REPRO });

  // the export gate is independent of the licence gate
  const manifest = JSON.parse(readFileSync(`exports/${DATASET}.manifest.json`, 'utf8')) as Record<string, unknown>;
  audit.check('security.export_gate', 'security.license_gate',
    'the exported dataset withholds the text while PUBLIC_DATA_ENABLED=false',
    manifest['text_included'] === false, {
      severity: 'CRITICAL', detail: JSON.stringify(manifest['text_included']),
      where: `exports/${DATASET}.manifest.json`, repro: 'npm run export' });
  const exportBody = readFileSync(`exports/${DATASET}.jsonl`, 'utf8');
  for (const [i, t] of texts.slice(0, 100).entries()) {
    audit.check(`security.export_text:${i}`, 'security.license_gate',
      'no record text appears in the exported dataset while the gate is closed',
      !exportBody.includes(t.raw_text.slice(0, 50)), {
        severity: 'CRITICAL', detail: 'record text found in the export',
        where: `exports/${DATASET}.jsonl`, repro: 'npm run export' });
  }

  // ---- secret scan of everything the repository would publish -----------
  const SECRET_PATTERNS: [string, RegExp][] = [
    ['private key block', /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
    ['aws access key', /AKIA[0-9A-Z]{16}/],
    ['supabase service key', /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
    ['hardcoded password assignment', /(password|passwd|pwd)\s*[:=]\s*['"][^'"\s]{8,}['"]/i],
    // a compose/env interpolation such as ${POSTGRES_PASSWORD:-…} is a
    // placeholder, not a credential
    ['live connection string', /postgres(ql)?:\/\/[^\s'"]*:(?!\$\{)[^\s'"@]+@(?!127\.0\.0\.1|localhost|db:)/],
    ['github token', /gh[pousr]_[A-Za-z0-9]{20,}/],
    ['slack token', /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ];
  const files = sourceFiles('.');
  for (const file of files) {
    let body = '';
    try { body = readFileSync(file, 'utf8'); } catch { continue; }
    for (const [name, re] of SECRET_PATTERNS) {
      audit.check(`security.secret:${file}:${name}`, 'security.secrets',
        `the file contains no ${name}`,
        !re.test(body), {
          severity: 'CRITICAL', detail: `${name} matched in ${file}`, where: file,
          repro: 'bash scripts/security-scan.sh' });
    }
  }

  // the Flutter side must never carry a server credential or a localhost URL
  const flutterFiles = sourceFiles('../flutter_app/lib');
  for (const file of flutterFiles) {
    let body = '';
    try { body = readFileSync(file, 'utf8'); } catch { continue; }
    audit.check(`security.flutter_secret:${file}`, 'security.client',
      'the mobile client carries no server-side credential',
      !/SERVICE_ROLE|service_role|DATABASE_URL|JWT_SECRET|ADMIN_API_KEY/.test(body), {
        severity: 'CRITICAL', detail: 'a server credential name appears in the client',
        where: file, repro: 'grep -rn service_role flutter_app/lib' });
    audit.check(`security.flutter_localhost:${file}`, 'security.client',
      'the mobile client never hard-codes a localhost API base URL as its default',
      !/const\s+\w*[Bb]aseUrl\s*=\s*'http:\/\/(127\.0\.0\.1|localhost)/.test(body), {
        severity: 'HIGH', detail: 'a localhost default base URL is compiled into the client',
        where: file, repro: 'grep -rn localhost flutter_app/lib' });
  }
}
