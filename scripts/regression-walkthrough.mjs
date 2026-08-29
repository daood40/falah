import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { join, extname } from 'path';

const DIST = '/home/user/-/dist';
const OUT = '/tmp/claude-0/-home-user--/8fd501fa-66be-5b27-9377-60e7284fcf32/scratchpad';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  let file = join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { file = join(DIST, 'index.html'); }
  try { res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }); res.end(await readFile(file)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(4519, r));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 160)));

const shot = (n) => page.screenshot({ path: `${OUT}/rg-${n}.png` });

await page.goto('http://localhost:4519/');
await page.waitForTimeout(1200);
await page.locator('[role="dialog"] .fl-btn--primary').first().click();
await page.waitForTimeout(600);
await shot('home-empty');

// Create a real project: quran flow → editor → save
await page.goto('http://localhost:4519/create/quran');
await page.waitForTimeout(1000);
await page.locator('input').first().fill('2:255');
await page.waitForTimeout(900);
await page.locator('.fl-btn--primary').first().click(); // افتح في المحرر
await page.waitForTimeout(1500);
await shot('editor');
// templates tab → save current as user template
const tabs = page.locator('.editor-tabs button, [role="tablist"] button, .fl-chip');
await page.getByText('قوالب', { exact: false }).first().click().catch(() => {});
await page.waitForTimeout(500);
await page.locator('input[placeholder="اسم القالب"]').fill('هويتي الذهبية').catch(() => {});
await page.getByText('حفظ', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(500);
await shot('editor-templates');
// save project
await page.getByText('حفظ', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(600);

await page.goto('http://localhost:4519/');
await page.waitForTimeout(1000);
await shot('home-dashboard');

await page.goto('http://localhost:4519/publish');
await page.waitForTimeout(900);
await shot('publish');

// dark mode with the real storage key
await page.evaluate(() => localStorage.setItem('falah.theme', 'dark'));
await page.goto('http://localhost:4519/');
await page.waitForTimeout(900);
await shot('home-dark');
await page.goto('http://localhost:4519/publish');
await page.waitForTimeout(700);
await shot('publish-dark');

// skip link visibility on first Tab
await page.goto('http://localhost:4519/');
await page.waitForTimeout(700);
await page.keyboard.press('Tab');
await shot('skiplink');

const filtered = errors.filter((e) => !/fonts.googleapis|fonts.gstatic|alquran.cloud|islamic.network|ERR_TUNNEL|ERR_CONNECTION|Failed to load resource/.test(e));
console.log(JSON.stringify({ appErrors: [...new Set(filtered)], rawNetworkErrors: errors.length - filtered.length }, null, 1));
await browser.close(); server.close();
