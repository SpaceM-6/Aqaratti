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

function page({ key, title, desc, text, img, target }) {
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
<script type="application/json" id="aq-ad">${JSON.stringify({ text: text || '' }).replace(/</g, '\\u003c')}</script>
<style>body{font-family:Tajawal,Tahoma,sans-serif;text-align:center;padding:40px 16px;color:#0f172a}img{max-width:100%;border-radius:14px}</style>
</head><body><a href="${esc(to)}"><img src="${esc(img)}" alt=""><h1>${esc(title)}</h1><p style="white-space:pre-line;text-align:start;display:inline-block">${esc((text || desc).replace(/\*/g, ''))}</p><p>افتح الإعلان على أنا عقار ←</p></a></body></html>
`;
}

const pages = [];
const add = (p) => { if (p && p.key && p.title) pages.push(p); };
const CITY = (c) => c || 'الإمارات';

// ===== صياغة تفاصيل الإعلان (تظهر في المعاينة وفي نص الرسالة) =====
const UNIT = { apartment: 'شقة', studio: 'استوديو', villa: 'فيلا', townhouse: 'تاون هاوس', penthouse: 'بنتهاوس', duplex: 'دوبلكس', chalet: 'شاليه', hotel_apt: 'شقة فندقية', room: 'غرفة', office: 'مكتب', shop: 'محل تجاري', warehouse: 'مستودع', showroom: 'معرض تجاري', land: 'أرض', building: 'بناية كاملة' };
const FURN = { furnished: 'مفروش', unfurnished: 'غير مفروش', partly: 'مفروش جزئيًا' };
const DONE = { ready: 'جاهز للسكن', under_construction: 'تحت الإنشاء', off_plan: 'على الخارطة' };
const rooms = (n) => n === 0 ? 'استوديو' : n == null || n === '' ? '' : +n === 1 ? 'غرفة نوم واحدة' : +n === 2 ? 'غرفتا نوم' : +n <= 10 ? `${n} غرف نوم` : `${n} غرفة نوم`;
const sqm = (m) => m ? `${num(m)} م² (${num(Math.round(m * 10.7639))} قدم²)` : '';
const line = (ic, label, v) => v ? `${ic} ${label}: ${v}` : '';
// نص الإعلان المصغّر: أول سطر عريض في واتساب (*...*)، ثم التفاصيل سطرًا سطرًا
const adText = (head, name, lines) => [`*${head}*`, name && name !== head ? name : '', ...lines].filter(Boolean).join('\n') + '\n\nالتفاصيل وكل الصور على «أنا عقار» 👇';
const facts = (l) => l.filter(Boolean).join(' · ');

function propertyAd(o) {
  const type = UNIT[o.unit] || (o.type || '').replace(/\s*\/\s*استوديو$/, '') || (o.beds === 0 ? 'استوديو' : 'عقار');
  const deal = o.daily ? 'للإيجار اليومي' : o.deal === 'rent' ? 'للإيجار' : 'للبيع';
  const head = `${type} ${deal}`;
  const price = o.daily ? `${num(o.nightly)} درهم / الليلة${o.monthly ? ` (شهريًا ${num(o.monthly)} درهم)` : ''}` : o.price ? `${num(o.price)} درهم${o.deal === 'rent' ? (o.period === 'monthly' ? ' / شهريًا' : ' / سنويًا') : ''}` : 'السعر عند التواصل';
  const loc = [o.area, CITY(o.city)].filter(Boolean).join('، ');
  const text = adText(head, o.name, [
    line('💰', 'السعر', price),
    line('🏠', 'نوع العقار', type),
    type === 'استوديو' ? '' : line('🛏', 'الغرف', rooms(o.beds)),
    line('🛁', 'الحمامات', o.baths),
    o.guests ? line('👥', 'يتسع حتى', o.guests + ' ضيوف') : '',
    line('📐', 'المساحة', sqm(o.m2)),
    line('🛋', 'التأثيث', FURN[o.furnishing]),
    line('🏗', 'الحالة', DONE[o.completion]),
    o.minNights > 1 ? line('🌙', 'أقل مدة', o.minNights + ' ليالٍ') : '',
    line('📍', 'الموقع', loc),
    o.permit ? line('✅', 'رقم التصريح', o.permit) : ''
  ].filter(Boolean));
  return {
    title: `${head} — ${price}`,
    desc: facts([rooms(o.beds), o.baths ? o.baths + ' حمام' : '', o.m2 ? num(o.m2) + ' م²' : '', o.guests ? 'حتى ' + o.guests + ' ضيوف' : '', loc]) + (o.name ? ' | ' + o.name : ''),
    text
  };
}

// ===== العقارات والإقامات القصيرة =====
const props = await rest('properties', 'select=*&status=eq.approved&limit=5000');
for (const p of props) {
  const id = 'sb-' + p.id, daily = p.rent_period === 'daily';
  const nightly = p.nightly_price || p.price_aed;
  const ad = propertyAd({ name: p.title, unit: p.unit_type || p.stay_category, type: p.property_type, deal: p.deal_type, daily, period: p.rent_period, price: p.price_aed, nightly, monthly: daily && p.monthly_discount ? Math.round(nightly * 30 * (1 - p.monthly_discount / 100)) : 0, beds: p.bedrooms, baths: p.bathrooms, m2: p.area_m2, guests: daily ? p.max_guests : 0, minNights: daily ? p.min_nights : 0, furnishing: p.furnishing, completion: p.completion_status, city: p.city, permit: p.permit_number });
  add({ key: 'p-' + id, ...ad, img: ogImg((p.image_urls || [])[0]), target: (daily ? 'stay.html?id=' : 'property-details.html?id=') + encodeURIComponent(id) });
}
for (const p of readJSON('properties.json')) {
  const ad = propertyAd({ name: p.title, unit: p.unitType, type: p.propertyType, deal: p.dealType, period: p.rentPeriod, price: p.priceAED, beds: p.bedrooms, baths: p.bathrooms, m2: p.area_m2, furnishing: p.furnishing, completion: p.completionStatus, city: p.city, permit: p.permitNumber });
  add({ key: 'p-' + p.id, ...ad, img: ogImg(p.image || (p.imagesList || [])[0]), target: 'property-details.html?id=' + encodeURIComponent(p.id) });
}
for (const p of readJSON('stays.json')) {
  const nightly = p.nightlyPrice || p.priceAED;
  const ad = propertyAd({ name: p.title, unit: p.stayCategory, deal: 'rent', daily: true, nightly, monthly: p.monthlyDiscount ? Math.round(nightly * 30 * (1 - p.monthlyDiscount / 100)) : 0, beds: p.bedrooms, baths: p.bathrooms, guests: p.maxGuests, minNights: p.minNights, area: p.area, city: p.city, permit: p.holidayPermit });
  add({ key: 'p-' + p.id, ...ad, img: ogImg(p.image || (p.imagesList || [])[0]), target: 'stay.html?id=' + encodeURIComponent(p.id) });
}

// ===== موتورات (نستخدم نفس دوال صفحة الموتورات حتى تتطابق التسميات) =====
const vm = await import('node:vm');
const W = {}, ctx = { window: W, console, navigator: {}, location: { search: '' }, document: { head: { appendChild() {} }, createElement: () => ({}), querySelector: () => null } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/aq-cars.js'), 'utf8'), ctx);
const C = W.AQCars;
const carPage = (c) => {
  const k = C.kindOf(c), name = C.name(c), price = C.price(c), sub = C.subLabel(c);
  const PL = { 'سيارة': 'سيارات', 'دراجة نارية': 'دراجات نارية', 'يخت': 'يخوت وقوارب' }, IC = { 'سيارة': '🚘', 'دراجة نارية': '🏍', 'يخت': '⛵' }[k.one] || '🚘';
  const head = c.deal === 'parts' ? `قطعة غيار ${PL[k.one] || ''}` : c.deal === 'service' ? `خدمة صيانة ${PL[k.one] || ''}` : `${k.one} ${C.dealBadge(c)}`;
  const hours = k.unit === 'ساعة تشغيل';
  const text = adText(head, name, [
    line('💰', 'السعر', price),
    line(c.deal === 'service' ? '🔧' : IC, c.deal === 'parts' ? 'الفئة' : c.deal === 'service' ? 'الخدمة' : 'الفئة', sub),
    line('📅', 'سنة الصنع', c.year),
    !hours && c.mileage_km != null && c.deal !== 'rent' ? line('🛣', 'الممشى', num(c.mileage_km) + ' كم') : '',
    hours && c.engine_hours ? line('⏱', 'ساعات التشغيل', num(c.engine_hours)) : '',
    c.length_ft ? line('📏', 'الطول', c.length_ft + ' قدم') : '',
    c.cabins ? line('🛏', 'الكبائن', c.cabins) : '',
    c.seats ? line('💺', 'المقاعد', c.seats) : '',
    line('⚙️', 'ناقل الحركة', C.AR.trans[c.transmission]),
    line('⛽', 'الوقود', C.AR.fuel[c.fuel]),
    line('🌍', 'المواصفات', C.AR.specs[c.regional_specs]),
    c.condition ? line('✨', 'الحالة', c.deal === 'parts' ? (c.condition === 'new' ? 'جديدة' : 'مستعملة') : (c.condition === 'new' ? 'جديد' : 'مستعمل')) : '',
    c.fits ? line('🔩', 'تناسب', c.fits) : '',
    line('📍', 'الموقع', CITY(c.city))
  ].filter(Boolean));
  add({ key: 'c-' + c.id, title: `${name} — ${price}`, desc: facts([head, c.year, !hours && c.mileage_km != null && c.deal !== 'rent' ? num(c.mileage_km) + ' كم' : '', C.AR.trans[c.transmission], CITY(c.city)]), text, img: ogImg((c.images || [])[0]), target: 'car.html?id=' + encodeURIComponent(c.id) });
};
(await rest('cars', 'select=*&status=eq.approved&limit=5000')).forEach(carPage);
readJSON('cars.json').forEach(carPage);

// ===== المشاريع =====
const SALE = { announced: 'أُعلن قريبًا', on_sale: 'متاح للبيع', sold_out: 'تم البيع بالكامل' };
for (const p of await rest('projects', 'select=*&review_status=eq.approved&limit=2000')) {
  const units = Array.isArray(p.unit_types) ? p.unit_types : [], loc = [p.area, CITY(p.city)].filter(Boolean).join('، ');
  const price = p.price_from ? 'يبدأ من ' + num(p.price_from) + ' درهم' : 'السعر عند التواصل';
  const text = adText('مشروع على الخارطة', p.name, [
    line('💰', 'الأسعار', price),
    line('🏠', 'الوحدات', units.map((u) => u && (u.name || u.type)).filter(Boolean).slice(0, 5).join('، ')),
    line('🗓', 'التسليم', p.handover),
    line('📊', 'الحالة', SALE[p.sale_status]),
    Array.isArray(p.payment_plan) && p.payment_plan.length ? line('💳', 'خطة السداد', p.payment_plan.map((x) => x && (x.pct != null ? x.pct + '% ' : '') + (x.label || x.name || '')).filter((x) => x && x.trim()).slice(0, 4).join(' · ')) : '',
    line('📍', 'الموقع', loc)
  ].filter(Boolean));
  add({ key: 'pr-' + p.id, title: `${p.name} — ${price}`, desc: facts(['مشروع على الخارطة', p.handover ? 'التسليم ' + p.handover : '', loc]), text, img: ogImg((p.images || [])[0]), target: 'project.html?id=' + p.id });
}

// لا نحذف الصفحات القديمة إن تعذّر الاتصال بقاعدة البيانات، حتى لا تختفي معاينات الإعلانات الحقيقية
if (!restFailed) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const p of pages) fs.writeFileSync(path.join(OUT, p.key.replace(/[^\w.-]/g, '_') + '.html'), page(p));
let keys = pages.map((p) => p.key);
if (restFailed) { try { keys = [...new Set(JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8')).concat(keys))]; } catch (e) {} }
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(keys));
// ملخص للتشخيص: كم إعلانًا حقيقيًا جاء من قاعدة البيانات، وهل نجح الاتصال
fs.writeFileSync(path.join(OUT, 'status.json'), JSON.stringify({ db_ok: !restFailed, real_properties: pages.filter((p) => p.key.startsWith('p-sb-')).length, real_cars: pages.filter((p) => /^c-(?!demo)/.test(p.key)).length, projects: pages.filter((p) => p.key.startsWith('pr-')).length }));
console.log('share pages:', pages.length);

// ===== خريطة الموقع (sitemap.xml) لمحركات البحث: الصفحات الثابتة + كل إعلان حقيقي + صفحات المناطق =====
async function restSoft(table, query) {
  try { const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }); return r.ok ? await r.json() : []; } catch (e) { return []; }
}
{
  const today = new Date().toISOString().slice(0, 10);
  const STATIC = [
    ['', 'daily', '1.0'], ['listings.html', 'daily', '0.9'], ['stays.html', 'daily', '0.9'], ['cars.html', 'daily', '0.8'], ['projects.html', 'daily', '0.8'],
    ['areas.html', 'weekly', '0.8'], ['valuation.html', 'monthly', '0.7'], ['map.html', 'daily', '0.7'], ['offers.html', 'weekly', '0.7'],
    ['brokers-directory.html', 'weekly', '0.7'], ['services-directory.html', 'weekly', '0.7'], ['sell-or-rent.html', 'monthly', '0.6'], ['request.html', 'monthly', '0.6'],
    ['calculator.html', 'monthly', '0.5'], ['broker-registration.html', 'monthly', '0.4'], ['privacy-policy.html', 'yearly', '0.2'], ['terms-of-service.html', 'yearly', '0.2'], ['account-deletion.html', 'yearly', '0.2']
  ];
  const urls = STATIC.map(([u, f, p]) => ({ loc: `${SITE}/${u}`, f, p }));
  // الإعلانات الحقيقية فقط (لا إعلانات العرض التجريبي)
  for (const p of pages) if (/^(p-sb-|pr-|c-(?!demo))/.test(p.key)) urls.push({ loc: `${SITE}/${p.target}`, f: 'weekly', p: p.key.startsWith('pr-') ? '0.7' : '0.6' });
  // صفحات المناطق: المعروفة + كل منطقة لها صفقات مسجلة
  const W2 = {}; const ctx2 = { window: W2, console };
  vm.createContext(ctx2); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/aq-areas.js'), 'utf8'), ctx2);
  const areaNames = new Set((W2.AQAreas ? W2.AQAreas.AREAS : []).map((a) => a.ar));
  const mapped = new Set((W2.AQAreas ? W2.AQAreas.AREAS : []).flatMap((a) => a.dld || []).map((x) => x.toLowerCase()));
  let mk = [];
  for (let off = 0; off < 50000; off += 1000) { const part = await restSoft('area_market_stats', `select=area_en&kind=eq.sale&order=area_en,month&offset=${off}&limit=1000`); mk = mk.concat(part); if (part.length < 1000) break; }
  for (const r of mk) if (r.area_en && !mapped.has(r.area_en.toLowerCase())) areaNames.add(r.area_en);
  for (const a of areaNames) urls.push({ loc: `${SITE}/areas.html?a=${encodeURIComponent(a)}`, f: 'weekly', p: '0.6' });
  const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const seen = new Set();
  const body = urls.filter((u) => !seen.has(u.loc) && seen.add(u.loc)).slice(0, 49000)
    .map((u) => `  <url><loc>${xmlEsc(u.loc)}</loc><lastmod>${today}</lastmod><changefreq>${u.f}</changefreq><priority>${u.p}</priority></url>`).join('\n');
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
  console.log('sitemap urls:', seen.size);
}
