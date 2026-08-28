/** Drive FALAH in a real browser and capture preview screenshots. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4173';
const OUT = process.env.SHOT_DIR ?? './shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function settle(page, ms = 700) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
}

async function dismissWelcome(page) {
  const btn = page.getByRole('button', { name: 'المتابعة محليًا' });
  try {
    await btn.click({ timeout: 5000 });
  } catch {
    /* already dismissed */
  }
}

/* ---------- Mobile (390×844, like iPhone 14) ---------- */
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'ar',
});
const page = await mobile.newPage();

// 1. Home (light)
await page.goto(BASE + '/');
await dismissWelcome(page);
await settle(page, 1500);
await page.screenshot({ path: `${OUT}/01-home-light.png` });

// 2. Drawer open
await page.getByRole('button', { name: 'القائمة' }).first().click();
await settle(page);
await page.screenshot({ path: `${OUT}/02-drawer.png` });

// 3. Switch to dark, close drawer, home dark
await page.getByRole('radio', { name: 'داكن' }).click();
await page.getByRole('button', { name: 'إغلاق' }).first().click();
await settle(page);
await page.screenshot({ path: `${OUT}/03-home-dark.png` });

// 4. Create hub
await page.goto(BASE + '/create');
await settle(page);
await page.screenshot({ path: `${OUT}/04-create-hub.png` });

// 5. Quran create — Ayat al-Kursi via reference search
await page.goto(BASE + '/create/quran?surah=2&ayah=255');
await page.waitForSelector('.ayah-card', { timeout: 15000 });
await settle(page, 1200);
await page.screenshot({ path: `${OUT}/05-quran-create.png` });

// 6. Open in editor
await page.getByRole('button', { name: 'افتح في المحرر' }).click();
await page.waitForSelector('.stage', { timeout: 15000 });
await settle(page, 1200);
await page.screenshot({ path: `${OUT}/06-editor.png` });

// 7. Apply a template
await page.getByRole('tab', { name: 'قوالب' }).click();
await settle(page, 400);
await page.getByRole('button', { name: /فحمي ذهبي/ }).click();
await settle(page, 600);
await page.screenshot({ path: `${OUT}/07-editor-template.png` });

// Save so the library has content
await page.getByRole('button', { name: /حفظ/ }).first().click();
await settle(page, 900);

// 8. Hadith create
await page.goto(BASE + '/create/hadith');
await page.waitForSelector('.hadith-card', { timeout: 15000 });
await settle(page, 800);
await page.screenshot({ path: `${OUT}/08-hadith.png` });

// 9. AI assistant with a real exchange
await page.goto(BASE + '/assistant');
await settle(page, 600);
await page.getByRole('textbox').fill('ما أفضل أبعاد لريلز إنستغرام؟');
await page.getByRole('button', { name: 'إرسال' }).click();
await page.waitForSelector('text=9:16', { timeout: 10000 });
await settle(page, 400);
await page.screenshot({ path: `${OUT}/09-assistant.png` });

// 10. Library (contains the saved design)
await page.goto(BASE + '/library');
await settle(page, 1000);
await page.screenshot({ path: `${OUT}/10-library.png` });

// 11. Settings
await page.goto(BASE + '/settings');
await settle(page, 800);
await page.screenshot({ path: `${OUT}/11-settings.png` });

await mobile.close();

/* ---------- Tablet / desktop (1280×800) ---------- */
const tablet = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  locale: 'ar',
});
const tpage = await tablet.newPage();
await tpage.goto(BASE + '/');
await dismissWelcome(tpage);
await settle(tpage, 1200);
await tpage.screenshot({ path: `${OUT}/12-tablet-home.png` });

// Tablet editor: reuse the saved project via the library
await tpage.goto(BASE + '/library');
await settle(tpage, 900);
const item = tpage.locator('.library-item__preview').first();
if (await item.count()) {
  await item.click();
  await tpage.waitForSelector('.stage', { timeout: 15000 });
  await settle(tpage, 1200);
  await tpage.screenshot({ path: `${OUT}/13-tablet-editor.png` });
}

await tablet.close();
await browser.close();
console.log('screenshots done');
