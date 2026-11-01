// صفحات ثابتة مقروءة لمحركات البحث + خريطة الموقع:
//   area/<slug>.html     صفحة لكل منطقة: الأسعار والإيجارات والصفقات والتملّك الحر والمشاريع (نص كامل يقرؤه Google دون برمجة)
//   area/index.html      فهرس كل المناطق
//   property/<id>.html   صفحة لكل إعلان حقيقي معتمد (لا إعلانات العرض)
//   sitemap.xml          كل ما سبق + الصفحات الأساسية
// يُشغَّل من GitHub Actions بعد build-share-pages.mjs. التشغيل اليدوي: node scripts/build-seo-pages.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE = 'https://anaaqar.com';
const V = (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/CACHE_VERSION\s*=\s*['"]?[a-z-]*?(\d+)/) || [])[1] || '1';
const src = fs.readFileSync(path.join(ROOT, 'supabase-client.js'), 'utf8');
const SB_URL = (src.match(/SUPABASE_URL\s*=\s*'([^']+)'/) || [])[1];
const SB_KEY = (src.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/) || [])[1];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('en-US');
const today = new Date().toISOString().slice(0, 10);
const YEAR = new Date().getFullYear();

let dbOk = true;
async function fetchAll(table, query, max = 60000) {
  if (!SB_URL || !SB_KEY) { dbOk = false; return []; }
  let out = [];
  for (let off = 0; off < max; off += 1000) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}&offset=${off}&limit=1000`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
      if (!r.ok) { console.warn(table, r.status); if (r.status >= 500) dbOk = false; return out; }
      const part = await r.json(); out = out.concat(part); if (part.length < 1000) break;
    } catch (e) { console.warn(table, e.message); dbOk = false; return out; }
  }
  return out;
}

// نفس دوال المناطق المستخدمة في الموقع
const ctx = { window: {}, console };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/aq-areas.js'), 'utf8'), ctx);
const A = ctx.window.AQAreas;

const [market, lands, projects, props] = await Promise.all([
  fetchAll('area_market_stats', 'select=*&usage=in.(residential,all)&order=area_en,month'),
  fetchAll('land_area_stats', 'select=*'),
  fetchAll('dld_projects', 'select=*&status=neq.CANCELLED&order=cnt_unit.desc'),
  fetchAll('properties', 'select=*&status=eq.approved')
]);
// أدلة المدينة (اختيارية: إن لم تُرفع بعد تُترك أقسامها)
const dbOk0 = dbOk;
const [schools, buildings] = await Promise.all([fetchAll('schools', 'select=id,name_en,name_ar,rating_en,rating_ar,curriculum_en,curriculum_ar,area_en,area_ar,students'), fetchAll('building_area_stats', 'select=*')]);
dbOk = dbOk0;
if (!dbOk || !market.length) { console.log('قاعدة البيانات غير متاحة الآن؛ تُترك الصفحات الحالية كما هي'); process.exit(0); }
console.log('market', market.length, 'lands', lands.length, 'projects', projects.length, 'properties', props.length);

// ---------- المناطق: المعروفة + كل منطقة رسمية لها صفقات كافية ----------
const lc = (s) => String(s || '').toLowerCase();
const areas = new Map();
for (const a of A.AREAS) areas.set(A.slug(a.ar), { ar: a.ar, en: a.en, city: a.city, names: [...(a.dld || []), a.en].map(lc), words: (a.words || [a.ar]).map(lc), key: a.ar });
const saleBy = {};
market.forEach((r) => { if (r.kind === 'sale' && (r.segment || 'all') === 'all') saleBy[r.area_en] = (saleBy[r.area_en] || 0) + r.deals; });
for (const [en, deals] of Object.entries(saleBy)) {
  if (deals < 30) continue;
  const s = A.slug(en);
  if (!areas.has(s)) areas.set(s, { ar: '', en, city: 'دبي', names: [lc(en)], words: [lc(en)], key: en });
}

const page = ({ title, desc, canonical, h1, sub, body, jsonld, crumbs }) => `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:type" content="website"><meta property="og:site_name" content="أنا عقار AnaAqar">
  <meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${SITE}/icons/icon-app-1024.png">
  <link rel="icon" type="image/png" href="/icons/app-icon-v3-512.png">
  <meta name="theme-color" content="#00a896">
  <script>try { if (localStorage.getItem('anaaqar_theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) {}</script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/aq-pages.css?v=${V}">
  <style>
    .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 16px}@media(max-width:760px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
    .kpi{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 14px;min-width:0}.kpi b{display:block;font-size:21px;font-weight:900;color:#0f766e}.kpi small{display:block;color:var(--muted);font-size:12.5px;font-weight:700;line-height:1.5}
    .box{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;margin:0 0 16px}.box h2{margin:0 0 8px;font-size:18px;font-weight:900}.box p{margin:0 0 8px;line-height:1.9;font-size:15px}
    .lead{font-size:16px;line-height:2;margin:0 0 16px}
    table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:8px;border-top:1px solid var(--line);text-align:start}th{color:var(--muted);font-weight:800}td:first-child{white-space:nowrap}
    .crumbs{font-size:13px;color:var(--muted);font-weight:700;margin:0 0 12px}.crumbs a{color:var(--teal-dark);text-decoration:none}
    .faq details{background:var(--bg);border-radius:12px;padding:10px 14px;margin:0 0 8px}.faq summary{font-weight:900;cursor:pointer}.faq p{margin:8px 0 0;color:var(--muted);font-size:14px}
    .src{color:var(--muted);font-size:12px;font-weight:600}.links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}@media(max-width:700px){.links{grid-template-columns:repeat(2,minmax(0,1fr))}}
    .links a{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;text-decoration:none;font-weight:800;font-size:14px;min-width:0}.links small{display:block;color:var(--muted);font-weight:700;font-size:12px}
    .gal{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0 0 14px}.gal img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px}
  </style>
  ${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
  <header class="topbar"><div class="topbar-in"><a class="brand" href="/index.html"><img src="/icons/logo.svg" alt="" width="98" height="30"><b>أنا عقار</b></a><a class="back" href="/areas.html">دليل المناطق ←</a></div></header>
  <section class="head"><div class="head-in"><h1>${esc(h1)}</h1><p>${esc(sub)}</p></div></section>
  <main>
    ${crumbs ? `<nav class="crumbs">${crumbs.map(([t, u]) => u ? `<a href="${u}">${esc(t)}</a>` : esc(t)).join(' › ')}</nav>` : ''}
    ${body}
  </main>
  <script src="/js/aq-back.js?v=${V}" defer></script>
  <script src="/js/aq-ads.js?v=${V}" defer></script>
</body>
</html>
`;

const kpi = (v, t) => `<div class="kpi"><b>${v}</b><small>${t}</small></div>`;
const wr = (dir, file, html) => { fs.mkdirSync(path.join(ROOT, dir), { recursive: true }); fs.writeFileSync(path.join(ROOT, dir, file), html); };
fs.rmSync(path.join(ROOT, 'area'), { recursive: true, force: true });
const areaIndex = [];

for (const [slug, a] of areas) {
  const rows = market.filter((r) => a.names.includes(lc(r.area_en)) || (a.ar && lc(r.area_ar) === lc(a.ar)));
  const sale = A.summarize(rows, 'sale'), rent = A.summarize(rows, 'rent');
  const ready = A.summarize(rows, 'sale', 'ready'), off = A.summarize(rows, 'sale', 'offplan');
  const land = A.mergeLand(lands.filter((l) => a.names.includes(lc(l.area_en))));
  const fh = land && A.freehold(land);
  const prj = projects.filter((p) => a.names.includes(lc(p.area_en)));
  const listings = props.filter((p) => a.words.some((w) => lc(p.title).includes(w)));
  const RANK = { 'outstanding': 1, 'very good': 2, 'good': 3, 'acceptable': 4, 'weak': 5 };
  const sch = schools.filter((x) => a.names.some((n) => lc(x.area_en).includes(n) || n.includes(lc(x.area_en) || '#')) || (a.ar && x.area_ar && lc(x.area_ar).includes(lc(a.ar)))).sort((x, y) => (RANK[lc(x.rating_en)] || 9) - (RANK[lc(y.rating_en)] || 9));
  const bld = buildings.filter((b) => a.names.includes(lc(b.area_en)));
  const bTot = bld.reduce((t, b) => t + b.buildings, 0), bFl = bld.length ? Math.max(...bld.map((b) => b.floors_max || 0)) : 0;
  if (!sale && !rent && !fh && !prj.length && !listings.length && !sch.length && !bTot) continue;
  const name = a.ar || a.en, nameFull = a.ar ? `${a.ar} (${a.en})` : a.en;
  const base = ready && ready.ppm ? ready : sale;
  const yieldPct = rent && base && rent.ppm && base.ppm ? rent.ppm / base.ppm * 100 : null;
  const interactive = `/areas.html?a=${encodeURIComponent(a.key)}`;

  // فقرة افتتاحية مكتوبة من الأرقام (هذا ما يقرؤه Google)
  const lead = [
    sale && sale.ppm ? `بلغ وسيط سعر البيع في ${name} خلال آخر 12 شهرًا ${num(sale.ppm)} درهم للمتر المربع (نحو ${num(sale.ppm / 10.7639)} درهم للقدم المربع)، عبر ${num(sale.deals)} صفقة بيع مسجلة لدى دائرة الأراضي والأملاك.` : '',
    ready && ready.ppm && off && off.ppm ? `وسعر المتر في العقارات الجاهزة ${num(ready.ppm)} درهم، مقابل ${num(off.ppm)} درهم للبيع على الخارطة.` : '',
    rent && rent.price ? `أما وسيط الإيجار السنوي فبلغ ${num(rent.price)} درهم من ${num(rent.deals)} عقد إيجار${yieldPct ? `، أي عائد إيجاري إجمالي يقارب ${yieldPct.toFixed(1)}%` : ''}.` : '',
    fh ? `${fh.label === 'منطقة تملّك حر' ? `${name} منطقة تملّك حر يحق فيها لغير المواطنين تملّك العقارات` : `${name}: ${fh.label}`} (${Math.round(fh.pct)}% من أراضيها السكنية والتجارية).` : '',
    prj.length ? `وعدد المشاريع الجديدة المسجلة فيها لدى الدائرة: ${num(prj.length)}.` : ''
  ].filter(Boolean).join(' ');
  const title = `أسعار العقارات في ${name} ${YEAR}: سعر المتر والإيجارات والصفقات | أنا عقار`;
  const desc = (lead || `أسعار البيع والإيجار والمشاريع والعقارات المتاحة في ${name}.`).slice(0, 158);

  const faq = [
    sale && sale.ppm ? [`كم سعر المتر المربع في ${name}؟`, `وسيط سعر البيع المسجل خلال آخر 12 شهرًا ${num(sale.ppm)} درهم للمتر المربع، أي نحو ${num(sale.ppm / 10.7639)} درهم للقدم المربع، حسب صفقات دائرة الأراضي والأملاك.`] : null,
    rent && rent.price ? [`كم متوسط الإيجار في ${name}؟`, `وسيط الإيجار السنوي ${num(rent.price)} درهم حسب عقود الإيجار المسجلة${yieldPct ? `، والعائد الإيجاري الإجمالي نحو ${yieldPct.toFixed(1)}%` : ''}.`] : null,
    sch.length ? [`كم مدرسة في ${name}؟`, `في ${name} وحولها ${num(sch.length)} مدرسة خاصة مسجلة لدى هيئة المعرفة والتنمية البشرية، منها ${num(sch.filter((x) => (RANK[lc(x.rating_en)] || 9) <= 2).length)} بتقييم متميز أو جيد جدًا.`] : null,
    fh ? [`هل يستطيع الأجنبي التملّك في ${name}؟`, fh.cls === 'ok' ? `نعم، ${name} منطقة تملّك حر؛ ${Math.round(fh.pct)}% من أراضيها السكنية والتجارية مسجلة تملّكًا حرًا. ويُؤكَّد وضع كل عقار من سند ملكيته.` : `${fh.label}: ${Math.round(fh.pct)}% فقط من أراضيها السكنية والتجارية تملّك حر، فتأكد من وضع العقار نفسه قبل الشراء.`] : null
  ].filter(Boolean);

  const body = `
    <p class="lead">${esc(lead)}</p>
    ${sale || rent ? `<div class="kpis">${kpi(sale ? num(sale.ppm) : '—', 'وسيط سعر البيع (درهم/م²)')}${kpi(sale ? num(sale.deals) : '—', 'صفقات بيع مسجلة (12 شهرًا)')}${kpi(rent ? num(rent.price) : '—', 'وسيط الإيجار السنوي (درهم)')}${kpi(yieldPct ? yieldPct.toFixed(1) + '%' : '—', 'العائد الإيجاري الإجمالي')}</div>` : ''}
    ${sale && sale.series.length > 1 ? `<div class="box"><h2>سعر المتر شهريًا في ${esc(name)}</h2><div style="overflow:auto"><table><tr><th>الشهر</th><th>وسيط سعر المتر (درهم)</th><th>عدد الصفقات</th></tr>${sale.series.slice(-12).reverse().map((r) => `<tr><td>${esc(r.m.slice(0, 7))}</td><td>${num(r.ppm)}</td><td>${num(r.deals)}</td></tr>`).join('')}</table></div></div>` : ''}
    ${fh ? `<div class="box"><h2>الأراضي والتملّك الحر</h2><p>${esc(fh.label)} — ${Math.round(fh.pct)}% من الأراضي السكنية والتجارية. عدد القطع المسجلة ${num(land.plots)}، منها ${num(land.offplan)} عليها مشاريع على الخارطة.</p><p>${Object.entries(land.land_types || {}).filter(([k]) => k !== 'Unspecified').sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, v]) => `${esc(A.landAr(k))} ${Math.round(v / land.plots * 100)}%`).join(' · ')}</p></div>` : ''}
    ${bTot ? `<div class="box"><h2>المباني في ${esc(name)}</h2><p>عدد المباني المسجلة لدى دائرة الأراضي والأملاك ${num(bTot)} مبنى${bFl ? `، أعلاها ${num(bFl)} طابقًا` : ''}${bld[0] && bld[0].floors_avg ? `، ومتوسط الارتفاع ${bld[0].floors_avg} طوابق` : ''}${bld[0] && bld[0].median_year ? `، ونصفها تقريبًا بُني قبل ${bld[0].median_year}` : ''}.</p></div>` : ''}
    ${sch.length ? `<div class="box"><h2>مدارس في ${esc(name)} وحولها</h2><table><tr><th>المدرسة</th><th>المنهج</th><th>تقييم KHDA</th></tr>${sch.slice(0, 12).map((x) => `<tr><td>${esc(x.name_ar || x.name_en)}</td><td>${esc(x.curriculum_ar || x.curriculum_en || '')}</td><td>${esc(x.rating_ar || x.rating_en || '—')}</td></tr>`).join('')}</table><p style="margin-top:8px"><a href="/schools.html?area=${encodeURIComponent(sch[0].area_en || '')}">كل المدارس ←</a></p></div>` : ''}
    ${prj.length ? `<div class="box"><h2>مشاريع جديدة في ${esc(name)}</h2><table><tr><th>المشروع</th><th>المطوّر</th><th>الإنجاز</th><th>التسليم المتوقع</th><th>الوحدات</th></tr>${prj.slice(0, 15).map((p) => `<tr><td>${esc(A.title(p.name_en))}</td><td>${esc(A.title(p.developer_en))}</td><td>${Number(p.percent_completed) || 0}%</td><td>${esc((p.end_date || '').slice(0, 7))}</td><td>${num(p.cnt_unit)}</td></tr>`).join('')}</table></div>` : ''}
    ${listings.length ? `<div class="box"><h2>عقارات متاحة في ${esc(name)}</h2><div class="links">${listings.slice(0, 12).map((p) => `<a href="/property/sb-${esc(p.id)}.html">${esc(p.title)}<small>${num(p.price_aed)} درهم</small></a>`).join('')}</div></div>` : ''}
    ${faq.length ? `<div class="box faq"><h2>أسئلة شائعة عن ${esc(name)}</h2>${faq.map(([q, ans]) => `<details open><summary>${esc(q)}</summary><p>${esc(ans)}</p></details>`).join('')}</div>` : ''}
    <div class="acts" style="margin:0 0 14px"><a class="btn btn-teal" href="${interactive}"><i class="fas fa-chart-line"></i> الرسم البياني والعقارات المتاحة</a><a class="btn btn-soft" href="/listings.html?q=${encodeURIComponent(a.ar || a.en)}">كل العقارات في ${esc(name)}</a><a class="btn btn-ghost" href="/lands.html">دليل التملّك الحر</a></div>
    <p class="src">المصادر: البيانات المفتوحة لدائرة الأراضي والأملاك في دبي (صفقات البيع وعقود الإيجار وسجل الأراضي والمشاريع والمباني)${sch.length ? '، وهيئة المعرفة والتنمية البشرية (المدارس)' : ''}، محدّثة في ${today}. الأرقام للاسترشاد ولا تغني عن تقييم معتمد.</p>`;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'أنا عقار', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: 'دليل المناطق', item: SITE + '/area/' }, { '@type': 'ListItem', position: 3, name, item: `${SITE}/area/${slug}.html` }] },
    faq.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, ans]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: ans } })) } : null
  ].filter(Boolean);
  wr('area', slug + '.html', page({ title, desc, canonical: `${SITE}/area/${slug}.html`, h1: `أسعار العقارات في ${nameFull}`, sub: `الأسعار والإيجارات والصفقات المسجلة والتملّك الحر والمشاريع في ${name}${a.city ? '، ' + a.city : ''}.`, body, jsonld, crumbs: [['أنا عقار', '/index.html'], ['دليل المناطق', '/area/'], [name]] }));
  areaIndex.push({ slug, name, en: a.en, deals: sale ? sale.deals : 0, ppm: sale ? sale.ppm : null, fh });
}
areaIndex.sort((x, y) => y.deals - x.deals);
wr('area', 'index.html', page({
  title: `دليل مناطق دبي ${YEAR}: أسعار المتر والإيجارات لكل منطقة | أنا عقار`, desc: `أسعار البيع لكل متر ووسيط الإيجارات وعدد الصفقات والتملّك الحر في ${areaIndex.length} منطقة بدبي والإمارات، من بيانات دائرة الأراضي والأملاك.`,
  canonical: `${SITE}/area/`, h1: 'دليل المناطق: الأسعار والإيجارات', sub: 'اختر منطقة لتعرف سعر المتر والإيجارات والصفقات المسجلة والتملّك الحر فيها.',
  body: `<div class="box"><table><tr><th>المنطقة</th><th>وسيط سعر المتر</th><th>صفقات 12 شهرًا</th><th>التملّك الحر</th></tr>${areaIndex.map((x) => `<tr><td><a href="/area/${x.slug}.html">${esc(x.name)}</a>${x.name !== x.en ? ` <small style="color:var(--muted)">${esc(x.en)}</small>` : ''}</td><td>${num(x.ppm)}</td><td>${num(x.deals)}</td><td>${x.fh ? Math.round(x.fh.pct) + '%' : '—'}</td></tr>`).join('')}</table></div><p class="src">المصدر: البيانات المفتوحة لدائرة الأراضي والأملاك، محدّثة في ${today}.</p>`,
  crumbs: [['أنا عقار', '/index.html'], ['دليل المناطق']]
}));
console.log('area pages:', areaIndex.length);

// ---------- صفحة لكل إعلان حقيقي معتمد ----------
fs.rmSync(path.join(ROOT, 'property'), { recursive: true, force: true });
const propUrls = [];
const FURN = { furnished: 'مفروش', unfurnished: 'غير مفروش', partly: 'مفروش جزئيًا' };
for (const p of props) {
  const id = 'sb-' + p.id, daily = p.rent_period === 'daily';
  const price = daily ? `${num(p.nightly_price || p.price_aed)} درهم / الليلة` : `${num(p.price_aed)} درهم${p.deal_type === 'rent' ? (p.rent_period === 'monthly' ? ' / شهريًا' : ' / سنويًا') : ''}`;
  const facts = [p.bedrooms === 0 ? 'استوديو' : p.bedrooms ? `${p.bedrooms} غرف نوم` : '', p.bathrooms ? `${p.bathrooms} حمام` : '', p.area_m2 ? `${num(p.area_m2)} م²` : '', FURN[p.furnishing] || '', p.city || ''].filter(Boolean);
  const imgs = (p.image_urls || []).slice(0, 6);
  const target = (daily ? '/stay.html?id=' : '/property-details.html?id=') + encodeURIComponent(id);
  const deal = daily ? 'إقامة قصيرة' : p.deal_type === 'rent' ? 'للإيجار' : 'للبيع';
  const body = `
    ${imgs.length ? `<div class="gal">${imgs.map((u, i) => `<img src="${esc(u)}" alt="${esc(p.title)} — صورة ${i + 1}" loading="${i ? 'lazy' : 'eager'}">`).join('')}</div>` : ''}
    <div class="kpis">${kpi(esc(price), deal)}${facts.slice(0, 3).map((f) => kpi(esc(f), '')).join('')}</div>
    <div class="box"><h2>تفاصيل العقار</h2><p>${esc(p.description || '')}</p><p>${esc(facts.join(' · '))}${p.permit_number ? ` · رقم التصريح ${esc(p.permit_number)}` : ''}</p></div>
    <div class="acts" style="margin:0 0 14px"><a class="btn btn-teal" href="${target}"><i class="fas fa-phone"></i> تواصل مع المعلن واعرض كل الصور</a><a class="btn btn-soft" href="/areas.html?a=${encodeURIComponent(p.city || '')}">أسعار المنطقة</a></div>`;
  const jsonld = { '@context': 'https://schema.org', '@type': 'RealEstateListing', name: p.title, description: p.description || '', url: `${SITE}/property/${id}.html`, datePosted: (p.created_at || '').slice(0, 10) || undefined, image: imgs,
    offers: { '@type': 'Offer', price: Number(daily ? (p.nightly_price || p.price_aed) : p.price_aed) || undefined, priceCurrency: 'AED', businessFunction: p.deal_type === 'rent' ? 'https://schema.org/LeaseOut' : 'https://schema.org/Sell' } };
  wr('property', id + '.html', page({ title: `${p.title} — ${price} | أنا عقار`, desc: `${deal}: ${facts.join(' · ')}. ${String(p.description || '').slice(0, 100)}`, canonical: `${SITE}/property/${id}.html`, h1: p.title, sub: `${deal} · ${price}`, body, jsonld, crumbs: [['أنا عقار', '/index.html'], [p.deal_type === 'rent' ? 'عقارات للإيجار' : 'عقارات للبيع', '/listings.html'], [p.title]] }));
  propUrls.push(`${SITE}/property/${id}.html`);
}
console.log('property pages:', propUrls.length);

// ---------- خريطة الموقع ----------
const STATIC = [
  ['', 'daily', '1.0'], ['listings.html', 'daily', '0.9'], ['stays.html', 'daily', '0.9'], ['cars.html', 'daily', '0.8'], ['projects.html', 'daily', '0.8'],
  ['area/', 'weekly', '0.8'], ['areas.html', 'weekly', '0.6'], ['lands.html', 'weekly', '0.7'], ['valuation.html', 'monthly', '0.7'], ['map.html', 'daily', '0.6'], ['offers.html', 'weekly', '0.6'],
  ['brokers-directory.html', 'weekly', '0.7'], ['top-brokers.html', 'weekly', '0.6'], ['join.html', 'monthly', '0.6'], ['schools.html', 'weekly', '0.7'], ['transport.html', 'monthly', '0.6'], ['services-directory.html', 'weekly', '0.7'], ['sell-or-rent.html', 'monthly', '0.6'], ['request.html', 'monthly', '0.5'],
  ['calculator.html', 'monthly', '0.5'], ['broker-registration.html', 'monthly', '0.4'], ['about.html', 'yearly', '0.4'], ['ad-rules.html', 'yearly', '0.3'], ['privacy-policy.html', 'yearly', '0.2'], ['terms-of-service.html', 'yearly', '0.2'], ['account-deletion.html', 'yearly', '0.2']
];
const urls = STATIC.map(([u, f, p]) => ({ loc: `${SITE}/${u}`, f, p }));
areaIndex.forEach((x) => urls.push({ loc: `${SITE}/area/${x.slug}.html`, f: 'weekly', p: '0.7' }));
propUrls.forEach((u) => urls.push({ loc: u, f: 'weekly', p: '0.6' }));
// المركبات والمشاريع الحقيقية من صفحات المشاركة
try {
  for (const k of JSON.parse(fs.readFileSync(path.join(ROOT, 's/index.json'), 'utf8'))) {
    if (/^c-(?!demo)/.test(k)) urls.push({ loc: `${SITE}/car.html?id=${encodeURIComponent(k.slice(2))}`, f: 'weekly', p: '0.5' });
    else if (k.startsWith('pr-')) urls.push({ loc: `${SITE}/project.html?id=${encodeURIComponent(k.slice(3))}`, f: 'weekly', p: '0.6' });
  }
} catch (e) {}
const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const seen = new Set();
const body = urls.filter((u) => !seen.has(u.loc) && seen.add(u.loc)).slice(0, 49000)
  .map((u) => `  <url><loc>${xmlEsc(u.loc)}</loc><lastmod>${today}</lastmod><changefreq>${u.f}</changefreq><priority>${u.p}</priority></url>`).join('\n');
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
console.log('sitemap urls:', seen.size, 'db ok:', dbOk);
