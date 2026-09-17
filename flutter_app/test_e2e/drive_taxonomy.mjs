/**
 * End-to-end drive of every classification screen in the real app.
 *
 * Walks the hub, then each classification the service publishes — volumes,
 * cited collections, gradings, narrators, editions, the catalogue, statistics
 * and the cross-check evidence — and captures a screenshot of each.
 *
 *   node test_e2e/drive_taxonomy.mjs http://127.0.0.1:8088 build/e2e
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

const appUrl = process.argv[2] ?? 'http://127.0.0.1:8088';
const outDir = process.argv[3] ?? 'build/e2e';
mkdirSync(outDir, { recursive: true });

const steps = [];
function step(name, ok, detail = '') {
  steps.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail.slice(0, 120)}` : ''}`);
}

const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({
  executablePath,
  args: ['--no-sandbox', '--no-proxy-server', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

// no trusted path to the Google CDNs here; the build ships its own CanvasKit
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

async function open(route, shot) {
  await page.goto(`${appUrl}/#${route}`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const placeholder = document.querySelector('flt-semantics-placeholder');
    if (placeholder) placeholder.click();
  });
  await page.waitForTimeout(2500);
  if (shot) await page.screenshot({ path: `${outDir}/${shot}.png` });
  return page.evaluate(() => document.body.innerText || '');
}

try {
  const hub = await open('/hadith', 't1-hub');
  step('the hub lists every classification', [
    'كتب الجامع', 'المجلدات', 'كتب التخريج', 'الدرجات', 'الرواة',
    'الطبعات', 'التحقق المتقاطع', 'إحصاءات المجموعة',
  ].every((label) => hub.includes(label)), hub);

  const volumes = await open('/hadith/volumes', 't2-volumes');
  step('volumes render with their page ranges',
    volumes.includes('المجلد 1') && volumes.includes('الصفحات'), volumes);

  const collections = await open('/hadith/collections', 't3-collections');
  step('cited collections render with counts',
    collections.includes('البخاري') && collections.includes('حديثًا'), collections);

  const gradings = await open('/hadith/gradings', 't4-gradings');
  step('gradings render with the grader the edition names',
    gradings.includes('صحيح') && gradings.includes('الحاكم على الحديث'), gradings);

  const narrators = await open('/hadith/narrators', 't5-narrators');
  // the pager sits below the fold and Flutter does not put a field's hint in
  // the semantics tree, so this step checks what a reader actually sees: the
  // screen title and real narrator names from the API
  step('narrators render on their own screen',
    narrators.includes('الرواة') && /بن /.test(narrators), narrators);

  const editions = await open('/hadith/editions', 't6-editions');
  step('the edition, its source and its dataset versions render',
    editions.includes('الجامع الكامل') && editions.includes('JAMI-KAMIL'), editions);

  const catalog = await open('/hadith/catalog', 't7-catalog');
  step('the catalogue renders books as a tree', catalog.includes('كتاب'), catalog);

  const stats = await open('/hadith/stats', 't8-stats');
  step('statistics render real counts', stats.includes('15959') || /\d{4,}/.test(stats), stats);

  const cross = await open('/hadith/cross-checks', 't9-crosschecks');
  step('the cross-check summary and review queue render',
    cross.includes('مقارنة آلية') && cross.includes('طابور المراجعة'), cross);
  step('the cross-check screen states it is not a ruling',
    cross.includes('ليست حكمًا على الحديث'), cross);
} finally {
  await browser.close();
}

const failed = steps.filter((s) => !s.ok);
console.log(`\n${steps.length - failed.length}/${steps.length} steps passed`);
process.exit(failed.length === 0 ? 0 : 1);
