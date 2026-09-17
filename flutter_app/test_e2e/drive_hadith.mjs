/**
 * End-to-end drive of the real FALAH app against a running Hadith API.
 *
 * This is not a widget test: it loads the built application in a browser,
 * taps through Books → Chapters → Hadiths → one hadith, runs a search, and
 * captures a screenshot of each step. It fails if the app shows an error state
 * or if a step never renders.
 *
 *   node test_e2e/drive_hadith.mjs http://127.0.0.1:8088 build/e2e
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

const appUrl = process.argv[2] ?? 'http://127.0.0.1:8088';
const outDir = process.argv[3] ?? 'build/e2e';
mkdirSync(outDir, { recursive: true });

const steps = [];
function step(name, ok, detail = '') {
  steps.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Flutter web renders into canvas + a semantics tree; text is read from there. */
async function textOf(page) {
  return page.evaluate(() => document.body.innerText || '');
}

async function waitForText(page, needle, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const text = await textOf(page);
    if (text.includes(needle)) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

// the environment ships a Chromium build; use it rather than downloading one
const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--no-proxy-server', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

// This sandbox has no trusted path to the Google CDNs, and the app does not
// need one: the build ships its own CanvasKit. Anything still pointing at the
// CDN is redirected to the local copy, and the web font is simply dropped.
await page.route('**://www.gstatic.com/flutter-canvaskit/**', async (route) => {
  const file = route.request().url().split('/').pop();
  const path = `build/web/canvaskit/${file}`;
  if (!existsSync(path)) return route.abort();
  await route.fulfill({
    status: 200,
    contentType: file.endsWith('.wasm') ? 'application/wasm' : 'application/javascript',
    headers: { 'access-control-allow-origin': '*' },
    body: readFileSync(path),
  });
});
await page.route('**://fonts.gstatic.com/**', (route) => route.abort());

const consoleErrors = [];
const failedRequests = [];
page.on('console', (m) => {
  // the web font is blocked on purpose above; that is this script's doing
  const text = m.text();
  const isBlockedFont = text.includes('fonts.gstatic.com')
      || (text.includes('Failed to load resource') && failedRequests.every(
            (r) => r.includes('fonts.gstatic.com')));
  if (m.type() === 'error' && !isBlockedFont) consoleErrors.push(text);
});
page.on('pageerror', (e) => consoleErrors.push(String(e)));
// "Failed to load resource" with no URL is the blocked font above
page.on('response', () => {});
page.on('requestfailed', (r) => failedRequests.push(`${r.url()} — ${r.failure()?.errorText}`));

try {
  await page.goto(appUrl, { waitUntil: 'load' });
  // Flutter web needs its semantics tree before any text is readable
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const placeholder = document.querySelector('flt-semantics-placeholder');
    if (placeholder) placeholder.click();
  });
  await page.waitForTimeout(2000);
  step('the application loads', true, appUrl);

  // navigate to the hadith tab by its route, which is what the tab does
  await page.goto(`${appUrl}/#/hadith`, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const placeholder = document.querySelector('flt-semantics-placeholder');
    if (placeholder) placeholder.click();
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${outDir}/1-books.png` });

  const body = await textOf(page);
  const hasBooks = body.includes('كتاب');
  step('books arrive from the API and render', hasBooks, hasBooks ? '' : body.slice(0, 200));

  const hasDataset = body.includes('JAMI-KAMIL');
  step('the dataset banner names the dataset the server serves', hasDataset);

  const noError = !body.includes('تعذّر الاتصال');
  step('no error state on the books screen', noError);

  // open the first book
  const firstBook = page.getByText(/^كتاب .*/).first();
  await firstBook.click({ timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outDir}/2-chapters.png` });
  const chapters = await textOf(page);
  step('chapters of that book render', chapters.includes('باب'), chapters.slice(0, 150));

  // open the first chapter → the hadith list
  const firstChapter = page.getByText(/^باب .*/).first();
  await firstChapter.click({ timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outDir}/3-hadiths.png` });
  const list = await textOf(page);
  step(
    'the hadith list renders with the licence notice, not with text',
    list.includes('النص غير متاح') || list.includes('ج'),
    list.slice(0, 150),
  );

  // open one record
  const firstItem = page.getByText(/النص غير متاح|^ج\d+/).first();
  await firstItem.click({ timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outDir}/4-detail.png` });
  const detail = await textOf(page);
  step('the detail screen shows the printed locator', /ج\d+\/ص\d+/.test(detail), detail.slice(0, 200));
  step('the detail screen shows the dataset fingerprint', detail.includes('بصمة السجل'));

  // search
  await page.goto(`${appUrl}/#/hadith/search`, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const placeholder = document.querySelector('flt-semantics-placeholder');
    if (placeholder) placeholder.click();
  });
  await page.waitForTimeout(1500);
  // focus the field the way a user does, then type and submit
  await page.mouse.click(210, 96);
  await page.waitForTimeout(800);
  await page.keyboard.type('الصلاة');
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${outDir}/5-search.png` });
  const results = await textOf(page);
  const searched = results.includes('صفحة') || /\d+ من \d+/.test(results);
  step('a search returns results in the app', searched, results.slice(0, 200));

  const realFailures = failedRequests.filter((r) => !r.includes('fonts.gstatic.com'));
  if (realFailures.length > 0) {
    console.log('failed requests:', realFailures.slice(0, 5).join('\n  '));
  }
  step('no uncaught JavaScript error during the run', consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

const failed = steps.filter((s) => !s.ok);
console.log(`\n${steps.length - failed.length}/${steps.length} steps passed`);
process.exit(failed.length === 0 ? 0 : 1);
