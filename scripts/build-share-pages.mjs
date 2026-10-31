// صفحات المشاركة: لكل إعلان صفحة صغيرة فيها صورته وعنوانه وسعره (Open Graph)
// حتى يظهر الرابط في واتساب وفيسبوك وإكس بصورة الإعلان، ثم تنقل الزائر فورًا لصفحة الإعلان.
// يُشغَّل تلقائيًا من GitHub Actions (.github/workflows/share-pages.yml) كل ساعة وعند كل تحديث.
// التشغيل اليدوي: node scripts/build-share-pages.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 's');
const SITE = 'https://anaaqar.com';
const src = fs.readFileSync(path.join(ROOT, 'supabase-client.js'), 'utf8');
const SB_URL = (src.match(/SUPABASE_URL\s*=\s*'([^']+)'/) || [])[1];
const SB_KEY = (src.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/) || [])[1];

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Number(n || 0).toLocaleString('en-US');
const abs = (u) => !u ? `${SITE}/icons/icon-app-1024.png` : /^https?:/.test(u) ? u : `${SITE}/${String(u).replace(/^\.?\//, '')}`;
// صور Unsplash نطلبها بحجم مناسب للمعاينة
const ogImg = (u) => /images\.unsplash\.com/.test(u || '') ? String(u).replace(/[?&]w=\d+/, '').replace(/\?.*$/, '') + '?q=75&w=1200&h=630&fit=crop' : abs(u);

let restFailed = false;
async function rest(table, query) {
  if (!SB_URL || !SB_KEY) { restFailed = true; return []; }
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
    if (!r.ok) { restFailed = true; console.warn(table, r.status, await r.text()); return []; }
    return await r.json();
  } catch (e) { restFailed = true; console.warn(table, e.message); return []; }
}
const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { return []; } };

function page({ key, title, desc, img, target }) {
  const url = `${SITE}/s/${key}.html`, to = `${SITE}/${target}`;
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="أنا عقار AnaAqar">
<meta property="og:locale" content="ar_AE">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:secure_url" content="${esc(img)}">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<script>location.replace(${JSON.stringify(to)});</script>
<noscript><meta http-equiv="refresh" content="0; url=${esc(to)}"></noscript>
<style>body{font-family:Tajawal,Tahoma,sans-serif;text-align:center;padding:40px 16px;color:#0f172a}img{max-width:100%;border-radius:14px}</style>
</head><body><a href="${esc(to)}"><img src="${esc(img)}" alt=""><h1>${esc(title)}</h1><p>${esc(desc)}</p><p>افتح الإعلان على أنا عقار ←</p></a></body></html>
`;
}

const pages = [];
const add = (p) => { if (p && p.key && p.title) pages.push(p); };
const CITY = (c) => c || 'الإمارات';

// ===== العقارات والإقامات القصيرة =====
const props = await rest('properties', 'select=*&status=eq.approved&limit=5000');
for (const p of props) {
  const id = 'sb-' + p.id, daily = p.rent_period === 'daily';
  const price = daily ? `${num(p.nightly_price || p.price_aed)} درهم / الليلة` : `${num(p.price_aed)} درهم${p.deal_type === 'rent' ? (p.rent_period === 'monthly' ? ' / شهريًا' : ' / سنويًا') : ''}`;
  const facts = [p.bedrooms === 0 ? 'استوديو' : p.bedrooms ? `${p.bedrooms} غرف` : '', p.bathrooms ? `${p.bathrooms} حمام` : '', p.area_m2 ? `${p.area_m2} م²` : '', CITY(p.city)].filter(Boolean).join(' · ');
  add({ key: 'p-' + id, title: `${p.title} — ${price}`, desc: `${facts} | ${daily ? 'إقامة قصيرة' : p.deal_type === 'rent' ? 'للإيجار' : 'للبيع'} على أنا عقار`, img: ogImg((p.image_urls || [])[0]), target: (daily ? 'stay.html?id=' : 'property-details.html?id=') + encodeURIComponent(id) });
}
for (const p of readJSON('properties.json')) {
  const price = `${num(p.priceAED)} درهم${p.dealType === 'rent' ? ' / سنويًا' : ''}`;
  const facts = [p.bedrooms === 0 ? 'استوديو' : p.bedrooms ? `${p.bedrooms} غرف` : '', p.bathrooms ? `${p.bathrooms} حمام` : '', p.area_m2 ? `${p.area_m2} م²` : '', CITY(p.city)].filter(Boolean).join(' · ');
  add({ key: 'p-' + p.id, title: `${p.title} — ${price}`, desc: `${facts} | ${p.dealType === 'rent' ? 'للإيجار' : 'للبيع'} على أنا عقار`, img: ogImg(p.image || (p.imagesList || [])[0]), target: 'property-details.html?id=' + encodeURIComponent(p.id) });
}
for (const p of readJSON('stays.json')) {
  add({ key: 'p-' + p.id, title: `${p.title} — ${num(p.nightlyPrice || p.priceAED)} درهم / الليلة`, desc: `${[p.area, CITY(p.city)].filter(Boolean).join('، ')} · حتى ${p.maxGuests || 2} ضيوف | إقامة قصيرة على أنا عقار`, img: ogImg(p.image || (p.imagesList || [])[0]), target: 'stay.html?id=' + encodeURIComponent(p.id) });
}

// ===== موتورات =====
const PER = { hourly: 'ساعة', daily: 'يوم', weekly: 'أسبوع', monthly: 'شهر' };
const KIND = { car: 'سيارة', moto: 'دراجة نارية', yacht: 'يخت' };
const DEAL = { sale: 'للبيع', rent: 'للإيجار', parts: 'قطع غيار', service: 'صيانة' };
const carPage = (c) => {
  const name = c.title || [c.make, c.model, c.year].filter(Boolean).join(' ');
  const price = c.deal === 'service' ? (c.price ? `يبدأ من ${num(c.price)} درهم` : '') : `${num(c.price)} درهم${c.deal === 'rent' ? ' / ' + (PER[c.rent_period] || 'يوم') : ''}`;
  add({ key: 'c-' + c.id, title: price ? `${name} — ${price}` : name, desc: `${KIND[c.kind || 'car'] || ''} ${DEAL[c.deal] || ''} · ${[c.year, c.mileage_km != null ? num(c.mileage_km) + ' كم' : '', CITY(c.city)].filter(Boolean).join(' · ')} | موتورات على أنا عقار`, img: ogImg((c.images || [])[0]), target: 'car.html?id=' + encodeURIComponent(c.id) });
};
(await rest('cars', 'select=*&status=eq.approved&limit=5000')).forEach(carPage);
readJSON('cars.json').forEach(carPage);

// ===== المشاريع =====
for (const p of await rest('projects', 'select=id,name,city,area,price_from,images,handover&review_status=eq.approved&limit=2000')) {
  add({ key: 'pr-' + p.id, title: `${p.name}${p.price_from ? ' — يبدأ من ' + num(p.price_from) + ' درهم' : ''}`, desc: `${[p.area, CITY(p.city)].filter(Boolean).join('، ')}${p.handover ? ' · التسليم ' + p.handover : ''} | مشروع على الخارطة على أنا عقار`, img: ogImg((p.images || [])[0]), target: 'project.html?id=' + p.id });
}

// لا نحذف الصفحات القديمة إن تعذّر الاتصال بقاعدة البيانات، حتى لا تختفي معاينات الإعلانات الحقيقية
if (!restFailed) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const p of pages) fs.writeFileSync(path.join(OUT, p.key.replace(/[^\w.-]/g, '_') + '.html'), page(p));
let keys = pages.map((p) => p.key);
if (restFailed) { try { keys = [...new Set(JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8')).concat(keys))]; } catch (e) {} }
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(keys));
console.log('share pages:', pages.length);
