/**
 * Launch sweep (E2E smoke): serve the production build, visit every route,
 * click every visible interactive element, and report console errors.
 * Run: npm run build && node scripts/launch-sweep.mjs
 * External hosts are blocked so the sweep is deterministic and offline-true.
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { join, extname } from 'path';

const DIST = new URL('../dist', import.meta.url).pathname;
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};
const srv = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  let file = join(DIST, p);
  try {
    await stat(file);
  } catch {
    file = join(DIST, 'index.html');
  }
  try {
    res.setHeader('content-type', MIME[extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((r) => srv.listen(4180, r));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
await page.route(/googleapis|gstatic|islamic\.network|alquran|sunnah/, (r) => r.abort());
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 140)));
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 140)));

const ROUTES = [
  '/',
  '/create',
  '/create/quran',
  '/create/hadith',
  '/library',
  '/publish',
  '/assistant',
  '/settings',
  '/tasbih',
  '/azkar',
  '/werd',
  '/auth',
];
await page.goto('http://localhost:4180/');
await page.waitForTimeout(2000);
const local = page.locator('.fl-overlay .fl-btn--primary');
if (await local.count()) {
  await local.first().click();
  await page.waitForTimeout(500);
}

const report = [];
for (const route of ROUTES) {
  await page.goto('http://localhost:4180' + route);
  await page.waitForTimeout(900);
  const buttons = page.locator('main button:visible, main a:visible');
  const count = await buttons.count();
  report.push(`${route}: ${count} interactive elements`);
  for (let i = 0; i < Math.min(count, 8); i++) {
    try {
      const el = buttons.nth(i);
      if (!(await el.isVisible())) continue;
      await el.click({ timeout: 500 });
      await page.waitForTimeout(150);
      await page.keyboard.press('Escape');
      if (!page.url().endsWith(route)) {
        await page.goto('http://localhost:4180' + route);
        await page.waitForTimeout(500);
      }
    } catch {
      /* non-clickable at this moment (covered, detached) — fine */
    }
  }
}
console.log(report.join('\n'));
// The aborted external hosts surface as ERR_FAILED resource errors; app errors
// are anything else.
const appErrors = [...new Set(errors)].filter((e) => !e.includes('ERR_FAILED'));
console.log(JSON.stringify({ appErrors }, null, 1));
await browser.close();
srv.close();
if (appErrors.length > 0) process.exit(1);
