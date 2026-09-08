import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { join, extname } from 'path';
const root = '/home/user/-/flutter_app/build/web';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.otf': 'font/otf', '.ttf': 'font/ttf', '.png': 'image/png' };
const srv = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  let file = join(root, p);
  try { await stat(file); } catch { file = join(root, 'index.html'); }
  try { res.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream'); res.end(await readFile(file)); }
  catch { res.statusCode = 404; res.end(); }
});
await new Promise((r) => srv.listen(4191, r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
await page.route('https://www.gstatic.com/flutter-canvaskit/**', async (r) => {
  const tail = new URL(r.request().url()).pathname.split('/').slice(3).join('/');
  try {
    const body = await readFile(join(root, 'canvaskit', tail));
    await r.fulfill({ body, contentType: tail.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' });
  } catch { await r.abort(); }
});
await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
await page.goto('http://localhost:4191/');
await page.waitForTimeout(12000);
await page.screenshot({ path: 'fl-home.png' });
const tapNav = async (x) => { await page.mouse.click(x, 820); await page.waitForTimeout(2200); };
await tapNav(262);   // القرآن (RTL order)
await page.screenshot({ path: 'fl-quran.png' });
await page.mouse.click(210, 180);  // first surah tile (الفاتحة)
await page.waitForTimeout(2500);
await page.screenshot({ path: 'fl-reader.png' });
await tapNav(158);   // السبحة
for (let i = 0; i < 3; i++) { await page.mouse.click(210, 360); await page.waitForTimeout(250); }
await page.screenshot({ path: 'fl-tasbih.png' });
await tapNav(52);    // الإعدادات
await page.screenshot({ path: 'fl-settings.png' });
await browser.close();
srv.close();
console.log('done');
