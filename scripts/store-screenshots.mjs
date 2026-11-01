// صور متجر آبل لتطبيق «أنا عقار» — مقاس آيفون 6.9 إنش (1320×2868) من الموقع الحقيقي.
// يُشغَّل من GitHub Actions (.github/workflows/store-screenshots.yml) ويحفظ في store/ios/screenshots:
//   raw/   لقطات الشاشة كما هي
//   framed/ لقطات بإطار وعنوان تسويقي بالعربية (الأجمل للمتجر)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_DIR ? path.join(process.env.PW_DIR, 'x.js') : import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'store/ios/screenshots');
const SITE = process.env.SITE || 'https://anaaqar.com/';
const SHOTS = [
  ['01-home', 'index.html', 'كل عقارات الإمارات في تطبيق واحد', 'شراء وإيجار وإقامات قصيرة وموتورات'],
  ['02-listings', 'listings.html', 'ابحث بسهولة واعثر على عقارك', 'فلاتر ذكية بالسعر والمنطقة والغرف'],
  ['03-property', 'property-details.html?id=101', 'كل تفاصيل العقار بين يديك', 'الصور والمساحة والسعر والتواصل المباشر'],
  ['04-stays', 'stays.html', 'الإقامات القصيرة: يومي وشهري', 'احجز إقامتك بالسعر الكامل الواضح'],
  ['05-motors', 'cars.html', 'موتورات: سيارات ودراجات ويخوت', 'بيع وإيجار وقطع غيار وصيانة'],
  ['06-services', 'services-directory.html', 'دليل الخدمات العقارية', 'شركات الصيانة والنقل والتنظيف وغيرها']
];

fs.mkdirSync(path.join(OUT, 'raw'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'framed'), { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'ar-AE', serviceWorkers: 'block',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148' });
await ctx.addInitScript(() => {
  try {
    sessionStorage.setItem('aqe_welcome_done', '1'); localStorage.setItem('aqe_welcome_done', '1');
    localStorage.setItem('aq_coach_stays', 'true'); localStorage.setItem('aq_cookie_ok', '1');
  } catch (e) {}
});
const page = await ctx.newPage();
for (const [name, url] of SHOTS) {
  try {
    await page.goto(SITE + url, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) { console.warn(name, e.message); }
  await page.waitForTimeout(3500);
  // إخفاء أي نافذة منبثقة متبقية
  await page.evaluate(() => document.querySelectorAll('.aqe-ov, .aqe-tip, .aqs-ov, .aqs-coach, [class*="cookie"], #pwaInstallBanner').forEach((el) => el.remove()));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'raw', name + '.png') });
  console.log('shot', name);
}

// الإطار التسويقي: عنوان أعلى الصورة، والشاشة بزوايا دائرية
const frame = await ctx.newPage();
for (const [name, , title, sub] of SHOTS) {
  const img = 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, 'raw', name + '.png')).toString('base64');
  await frame.setContent(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=440, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@700;900&display=swap" rel="stylesheet">
  <style>html,body{margin:0;width:440px;height:956px;overflow:hidden}
  body{background:linear-gradient(160deg,#00a896 0%,#007d70 60%,#0b3d39 100%);font-family:Tajawal,sans-serif;color:#fff;text-align:center}
  h1{font-size:33px;font-weight:900;margin:58px 22px 8px;line-height:1.3}p{font-size:19px;font-weight:700;margin:0 24px;opacity:.9}
  .ph{position:absolute;left:50%;top:205px;transform:translateX(-50%);width:356px;height:774px;border-radius:44px;overflow:hidden;border:9px solid #0f172a;box-shadow:0 30px 60px rgba(0,0,0,.35);background:#fff}
  .ph img{width:100%;display:block}</style></head><body><h1>${title}</h1><p>${sub}</p><div class="ph"><img src="${img}"></div></body></html>`, { waitUntil: 'networkidle' });
  await frame.waitForTimeout(400);
  await frame.screenshot({ path: path.join(OUT, 'framed', name + '.png') });
}
await b.close();
console.log('done');
