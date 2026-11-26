// ⚠️ ملف مُولَّد من core.mjs و io.ts — عدّل المصدر ثم شغّل node scripts/build-feed-function.mjs
// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
import { XMLParser } from 'npm:fast-xml-parser@4';

// قلب استيراد ملفات التغذية: قراءة XML (صيغة Property Finder وصيغ Bayut/dubizzle الشائعة)
// وتحويل كل إعلان إلى صف عقار بعنوان ووصف عربيين. لا يتصل بالشبكة ولا بقاعدة البيانات (قابل للاختبار).

const MAX_ITEMS = 2000;
const MAX_IMAGES = 10;

// ---------- أدوات عامة ----------
const normKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
function txt(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return txt(v[0]);
  if (typeof v === 'object') return txt(v['#text'] ?? v.url ?? v.value ?? '');
  return String(v).trim();
}
const num = (v) => { const n = parseFloat(String(txt(v)).replace(/[, ]/g, '')); return isFinite(n) ? n : null; };
const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
function flat(obj) { // مفاتيح موحّدة (بلا شرطات ولا حالة أحرف) لكل عنصر
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) { if (k.startsWith('@')) continue; out[normKey(k)] = v; }
  return out;
}
const pick = (f, keys) => { for (const k of keys) if (f[k] != null && txt(f[k]) !== '' ) return f[k]; for (const k of keys) if (f[k] != null) return f[k]; return null; };

// جمل التواصل (هاتف، بريد، رابط، «اتصل/واتساب») تُحذف كاملة: التواصل يمر عبر المنصة فقط
const CONTACT_RE = /https?:\/\/|www\.|[\w.+-]+@[\w-]+\.[a-z]{2,}|\b(call|contact|whats\s?app|email|e-mail|viewing|dm)\b|اتصل|تواصل|واتس|للاستفسار|للتواصل/i;
const hasPhone = (seg) => /(\+|00)?\d[\d\s().-]{7,}\d/.test(seg) && (seg.match(/(\+|00)?\d[\d\s().-]{7,}\d/g) || []).some((m) => m.replace(/\D/g, '').length >= 9);
// نص نظيف: بلا وسوم ولا روابط ولا أرقام هواتف ولا بريد (التواصل يمر عبر المنصة فقط)
function cleanText(s, max = 3000) {
  let t = String(s || '')
    .replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;|&gt;/g, ' ')
    .split(/\n/).map((line) => line.split(/(?<=[.!?؟])\s+/).filter((seg) => !CONTACT_RE.test(seg) && !hasPhone(seg)).join(' ')).join('\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return t;
}

// ---------- قراءة الملف ----------
const REF_KEYS = ['referencenumber', 'propertyrefno', 'refno', 'reference', 'propertyreferencenumber', 'listingreference', 'listingid', 'propertyid'];
function findListings(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 4) return null;
  let best = null;
  for (const v of Object.values(node)) {
    const arr = list(v).filter((x) => x && typeof x === 'object' && !Array.isArray(x));
    if (arr.length && arr.some((x) => REF_KEYS.some((k) => k in flat(x)))) {
      if (!best || arr.length > best.length) best = arr;
    }
    const deeper = findListings(v, depth + 1);
    if (deeper && (!best || deeper.length > best.length)) best = deeper;
  }
  return best;
}

function parseFeed(xml, XMLParser) {
  const s = String(xml || '');
  if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<[A-Za-z]/.test(s)) throw new Error('not_xml');
  if (/<!DOCTYPE|<!ENTITY/i.test(s.slice(0, 4000))) throw new Error('doctype_not_allowed');
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', parseTagValue: false, trimValues: true, processEntities: true, htmlEntities: false });
  const doc = parser.parse(s);
  const raw = findListings(doc) || [];
  const rootName = normKey(Object.keys(doc).find((k) => !k.startsWith('?')) || '');
  const format = rootName === 'list' ? 'propertyfinder' : /dubizzle/.test(rootName) ? 'dubizzle' : /propert/.test(rootName) ? 'bayut' : 'generic';
  const items = [];
  const seen = new Set();
  for (const r of raw.slice(0, MAX_ITEMS * 2)) {
    const it = normalizeItem(r);
    if (!it || seen.has(it.ref)) continue;
    seen.add(it.ref); items.push(it);
    if (items.length >= MAX_ITEMS) break;
  }
  return { format, items, found: raw.length };
}

const PF_TYPES = { AP: 'apartment', ST: 'studio', VH: 'villa', BW: 'villa', CD: 'villa', TH: 'townhouse', PH: 'penthouse', DX: 'duplex', HA: 'hotel_apt', OF: 'office', FF: 'office', HF: 'office', BC: 'office', CW: 'office', SH: 'shop', RE: 'shop', RT: 'shop', SR: 'showroom', WH: 'warehouse', FA: 'warehouse', LC: 'warehouse', SA: 'building', LP: 'land', WB: 'building', BU: 'building', FM: 'land' };
const COMMERCIAL = new Set(['office', 'shop', 'showroom', 'warehouse']);
function unitFrom(v) {
  const t = txt(v); if (!t) return null;
  const up = t.toUpperCase(); if (PF_TYPES[up]) return PF_TYPES[up];
  const l = t.toLowerCase();
  const rules = [[/hotel/, 'hotel_apt'], [/pent/, 'penthouse'], [/town/, 'townhouse'], [/duplex/, 'duplex'], [/studio/, 'studio'], [/villa|bungalow|compound/, 'villa'], [/apartment|flat/, 'apartment'],
    [/office|business cent|co-?work|floor/, 'office'], [/shop|retail|restaurant/, 'shop'], [/show ?room/, 'showroom'], [/warehouse|factory|labou?r camp|industrial/, 'warehouse'], [/land|plot|farm/, 'land'], [/building|bulk/, 'building']];
  for (const [re, u] of rules) if (re.test(l)) return u;
  return null;
}

const AMEN_CODES = { AC: 'central_ac', BA: 'balcony', CP: 'parking', MR: 'maid', PA: 'pets', PG: 'garden', PP: 'pool', SP: 'pool', PY: 'gym', SY: 'gym', SE: 'security', BK: 'kitchen' };
const AMEN_WORDS = [[/balcon/, 'balcony'], [/pool/, 'pool'], [/gym|fitness/, 'gym'], [/parking|garage/, 'parking'], [/security|concierge/, 'security'], [/maid/, 'maid'], [/pet/, 'pets'],
  [/garden/, 'garden'], [/kitchen appliance|built.?in kitchen|equipped kitchen/, 'kitchen'], [/central a\/?c|central air|a\/c/, 'central_ac'], [/play ?area|kids|children/, 'kids'], [/barbe|bbq/, 'bbq']];
function amenitiesFrom(f) {
  const out = new Set();
  const codes = txt(pick(f, ['privateamenities', 'commercialamenities']));
  codes.split(/[,;|\s]+/).forEach((c) => { const a = AMEN_CODES[c.trim().toUpperCase()]; if (a) out.add(a); });
  const words = [];
  for (const k of ['features', 'amenities', 'facilities']) {
    const v = f[k]; if (v == null) continue;
    if (typeof v === 'object' && !Array.isArray(v)) for (const vv of Object.values(v)) list(vv).forEach((x) => words.push(txt(x)));
    else list(v).forEach((x) => words.push(txt(x)));
  }
  words.join(',').toLowerCase().split(/[,;|\n]+/).forEach((w) => { for (const [re, a] of AMEN_WORDS) if (re.test(w)) out.add(a); });
  return [...out].sort();
}

function photosFrom(f) {
  const urls = [];
  const add = (v) => { const u = txt(v); if (/^https:\/\/[^\s<>"']+$/i.test(u) && u.length <= 800) urls.push(u); };
  for (const k of ['photo', 'photos', 'images', 'image', 'pictures', 'picture', 'gallery']) {
    const v = f[k]; if (v == null) continue;
    list(v).forEach((x) => {
      if (x && typeof x === 'object' && !x['#text']) { for (const [kk, vv] of Object.entries(x)) if (!kk.startsWith('@')) list(vv).forEach(add); }
      else add(x);
    });
  }
  return [...new Set(urls)].slice(0, MAX_IMAGES);
}

function priceFrom(f, deal) {
  const p = pick(f, ['price', 'propertyprice', 'askingprice', 'rent']);
  if (p && typeof p === 'object' && !Array.isArray(p) && !p['#text']) {
    const q = flat(p);
    if (num(q.yearly)) return { price: num(q.yearly), period: 'yearly' };
    if (num(q.monthly)) return { price: num(q.monthly), period: 'monthly' };
    return { price: null, period: null };              // الأسبوعي واليومي: إقامات قصيرة لا تُستورد هنا
  }
  const n = num(p);
  if (deal !== 'rent') return { price: n, period: null };
  const fr = txt(pick(f, ['rentfrequency', 'frequency', 'rentperiod', 'pricefrequency'])).toLowerCase();
  if (/month/.test(fr)) return { price: n, period: 'monthly' };
  if (/day|week/.test(fr)) return { price: null, period: null };
  return { price: n, period: 'yearly' };
}

function normalizeItem(r) {
  const f = flat(r);
  if (/delet|inactive|archiv|off.?market/i.test(txt(f.status))) return null;
  const ref = txt(pick(f, REF_KEYS)).replace(/\s+/g, '').slice(0, 100);
  if (!ref) return null;
  const off = txt(pick(f, ['offeringtype', 'propertypurpose', 'purpose', 'listingtype', 'offertype', 'category'])).toLowerCase();
  const deal = /^(rr|cr)$|rent|let|lease/.test(off) ? 'rent' : 'sale';
  let unit = unitFrom(pick(f, ['propertytype', 'subtype', 'propertysubtype', 'unittype', 'type']));
  const bedRaw = txt(pick(f, ['bedroom', 'bedrooms', 'beds', 'noofbedrooms']));
  let beds = /studio/i.test(bedRaw) ? 0 : (num(bedRaw) == null ? null : Math.min(20, Math.max(0, Math.round(num(bedRaw)))));
  if (unit === 'studio') beds = 0;
  if (unit === 'apartment' && beds === 0) unit = 'studio';
  const commercial = /^c[rs]$|commercial/.test(off) || COMMERCIAL.has(unit);
  const { price, period } = priceFrom(f, deal);
  const sizeRaw = num(pick(f, ['size', 'propertysize', 'builtuparea', 'bua', 'area', 'plotsize']));
  const unitSize = txt(pick(f, ['propertysizeunit', 'sizeunit', 'areaunit'])).toLowerCase();
  const m2 = sizeRaw ? Math.round(/sqm|m2|meter|metre/.test(unitSize) ? sizeRaw : sizeRaw / 10.7639) : null;
  let lat = num(pick(f, ['latitude', 'lat'])), lng = num(pick(f, ['longitude', 'lng', 'lon']));
  const gp = txt(f.geopoints || f.geopoint || f.coordinates);
  if ((lat == null || lng == null) && gp) { const [a, b] = gp.split(',').map((x) => parseFloat(x)); if (isFinite(a) && isFinite(b)) { lng = a; lat = b; if (lat > 40) [lat, lng] = [lng, lat]; } }
  if (!(lat >= 22 && lat <= 26.5 && lng >= 51 && lng <= 56.6)) { lat = null; lng = null; }
  const agent = f.agent && typeof f.agent === 'object' ? flat(f.agent) : {};
  const comp = txt(pick(f, ['completionstatus', 'propertystatus', 'offplan', 'readiness'])).toLowerCase();
  const furn = txt(pick(f, ['furnished', 'furnishing', 'furnishingstatus'])).toLowerCase();
  return {
    ref, deal, unit, commercial, beds,
    baths: num(pick(f, ['bathroom', 'bathrooms', 'noofbathroom', 'noofbathrooms', 'baths'])),
    price, period, m2,
    city: txt(pick(f, ['city', 'emirate', 'region'])),
    community: txt(pick(f, ['community', 'locality', 'location', 'district'])),
    sub: txt(pick(f, ['subcommunity', 'sublocality'])),
    building: txt(pick(f, ['propertyname', 'towername', 'building', 'buildingname', 'projectname'])),
    titleEn: cleanText(txt(pick(f, ['titleen', 'propertytitle', 'title', 'name'])), 200),
    titleAr: cleanText(txt(pick(f, ['titlear', 'propertytitlear'])), 200),
    descEn: cleanText(txt(pick(f, ['descriptionen', 'propertydescription', 'description', 'webremarks'])), 3500),
    descAr: cleanText(txt(pick(f, ['descriptionar', 'propertydescriptionar'])), 3500),
    furnishing: /^yes$|^furnished$|fully/.test(furn) ? 'furnished' : /part|semi/.test(furn) ? 'partly' : /^no$|unfurnished/.test(furn) ? 'unfurnished' : null,
    completion: /off.?plan|under|^yes$/.test(comp) ? 'off_plan' : /complet|ready|^no$/.test(comp) ? 'ready' : null,
    permit: txt(pick(f, ['permitnumber', 'dtcmpermit', 'permit', 'trakheesipermit', 'madhmounpermit', 'rerapermit'])).replace(/[^\w/-]/g, '').slice(0, 60),
    developer: cleanText(txt(pick(f, ['developer', 'developername'])), 120),
    agentName: cleanText(txt(agent.name || pick(f, ['listingagent', 'agentname', 'contactname'])), 80),
    agentPhone: txt(agent.phone || pick(f, ['listingagentphone', 'agentphone', 'contactnumber', 'contactphone'])).replace(/[^\d+]/g, '').slice(0, 20),
    lat, lng,
    amenities: amenitiesFrom(f),
    photos: photosFrom(f),
  };
}

// ---------- الصياغة العربية ----------
const CITY_AR = { 'dubai': 'دبي', 'abu dhabi': 'أبوظبي', 'abudhabi': 'أبوظبي', 'sharjah': 'الشارقة', 'ajman': 'عجمان', 'ras al khaimah': 'رأس الخيمة', 'ras al-khaimah': 'رأس الخيمة', 'rak': 'رأس الخيمة', 'fujairah': 'الفجيرة', 'umm al quwain': 'أم القيوين', 'umm al-quwain': 'أم القيوين', 'al ain': 'العين' };
const UNIT_AR = { apartment: 'شقة', studio: 'شقة استوديو', villa: 'فيلا', townhouse: 'تاون هاوس', penthouse: 'بنتهاوس', duplex: 'دوبلكس', hotel_apt: 'شقة فندقية', office: 'مكتب', shop: 'محل تجاري', showroom: 'صالة عرض', warehouse: 'مستودع', land: 'أرض', building: 'مبنى' };
const AMEN_AR = { balcony: 'شرفة', pool: 'مسبح', gym: 'نادٍ رياضي', parking: 'موقف سيارات', security: 'حراسة أمنية', maid: 'غرفة خادمة', pets: 'يُسمح بالحيوانات الأليفة', garden: 'حديقة خاصة', kitchen: 'مطبخ مجهّز', central_ac: 'تكييف مركزي', kids: 'منطقة ألعاب للأطفال', bbq: 'منطقة شواء' };
const FEM = new Set(['apartment', 'studio', 'villa', 'hotel_apt', 'land']);
const money = (n) => Math.round(n).toLocaleString('en-US');
const bedsAr = (b) => b === 1 ? 'بغرفة نوم واحدة' : b === 2 ? 'بغرفتي نوم' : b >= 3 && b <= 10 ? `بـ${b} غرف نوم` : b > 10 ? `بـ${b} غرفة نوم` : '';

function areaAr(it, areas) {
  const hay = [it.community, it.sub, it.building].join(' | ').toLowerCase();
  for (const a of areas || []) {
    const keys = [a.en, ...(a.dld || []), ...(a.words || []).filter((w) => /[a-z]/i.test(w))].map((x) => String(x).toLowerCase()).filter((x) => x.length >= 3);
    if (keys.some((k) => hay.includes(k))) return a.ar;
  }
  return '';
}

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function buildRow(it, { areas = [], agencyName = '' } = {}) {
  const city = CITY_AR[(it.city || '').toLowerCase().trim()] || '';
  const area = (areaAr(it, areas) || it.community || it.sub || '').slice(0, 120);
  const unitAr = UNIT_AR[it.unit] || (it.commercial ? 'عقار تجاري' : 'عقار سكني');
  const fem = FEM.has(it.unit);
  const v = hashStr(it.ref);
  const dealAr = it.deal === 'rent' ? 'للإيجار' : 'للبيع';
  const bedPart = (it.unit === 'apartment' || it.unit === 'villa' || it.unit === 'townhouse' || it.unit === 'penthouse' || it.unit === 'duplex' || it.unit === 'hotel_apt') && it.beds ? ' ' + bedsAr(it.beds) : '';
  const extras = [];
  if (it.furnishing === 'furnished') extras.push(fem ? 'مفروشة' : 'مفروش');
  if (it.completion === 'off_plan') extras.push('على الخارطة');
  const placeParts = [it.building && !/^\d+$/.test(it.building) && it.building.length <= 40 ? it.building : '', area, city].filter(Boolean);
  const place = [...new Set(placeParts)].join('، ');
  const title = `${unitAr}${bedPart}${extras.length ? ' ' + extras.join(' ') : ''} ${dealAr}${place ? ' في ' + place : ''}`.replace(/\s+/g, ' ').trim().slice(0, 200);

  const s = [];
  const intro = [
    `${fem ? 'تُعرض' : 'يُعرض'} ${unitAr}${bedPart} ${dealAr}${place ? ' في ' + place : ''}.`,
    `${unitAr}${bedPart} ${dealAr}${place ? ' في موقع مميز في ' + place : ''}.`,
    `فرصة ${it.deal === 'rent' ? 'سكن' : 'تملّك'}: ${unitAr}${bedPart} ${dealAr}${place ? ' في ' + place : ''}.`,
  ];
  s.push(it.commercial ? `${fem ? 'تُعرض' : 'يُعرض'} ${unitAr} ${dealAr}${place ? ' في ' + place : ''}.` : intro[v % intro.length]);
  const specs = [];
  if (it.m2) specs.push(`المساحة نحو ${money(it.m2)} م²`);
  if (bedPart && !it.commercial) specs.push(`${it.beds === 1 ? 'غرفة نوم واحدة' : it.beds === 2 ? 'غرفتا نوم' : it.beds + ' غرف نوم'}`);
  if (it.baths) specs.push(`${it.baths === 1 ? 'حمّام واحد' : it.baths === 2 ? 'حمّامان' : it.baths + ' حمّامات'}`);
  if (specs.length) s.push(specs.join('، ') + '.');
  if (it.completion === 'ready') s.push(it.commercial ? 'العقار جاهز للاستخدام.' : (fem ? 'جاهزة للسكن.' : 'جاهز للسكن.'));
  if (it.completion === 'off_plan') s.push('العقار على الخارطة' + (it.developer ? ` من تطوير ${it.developer}` : '') + '.');
  else if (it.developer) s.push(`المطوّر: ${it.developer}.`);
  if (it.furnishing === 'furnished') s.push(fem ? 'مفروشة بالكامل.' : 'مفروش بالكامل.');
  else if (it.furnishing === 'partly') s.push(fem ? 'مفروشة جزئيًا.' : 'مفروش جزئيًا.');
  else if (it.furnishing === 'unfurnished' && !it.commercial) s.push(fem ? 'غير مفروشة.' : 'غير مفروش.');
  const am = it.amenities.map((a) => AMEN_AR[a]).filter(Boolean);
  if (am.length) s.push(`من المزايا: ${am.join('، ')}.`);
  if (it.price) s.push(it.deal === 'rent' ? `الإيجار ${it.period === 'monthly' ? 'الشهري' : 'السنوي'} ${money(it.price)} درهم.` : `السعر ${money(it.price)} درهم.`);
  if (it.permit) s.push(`رقم تصريح الإعلان: ${it.permit}.`);
  if (agencyName) s.push(`يعرضه ${agencyName}.`);
  const own = it.descAr || it.descEn;
  const description = (s.join(' ') + (own ? '\n\n' + (it.descAr ? 'تفاصيل من المعلن:\n' : 'Details from the advertiser:\n') + own : '')).slice(0, 5000);

  return {
    title, description,
    price_aed: it.price,
    deal_type: it.deal,
    rent_period: it.deal === 'rent' ? (it.period || 'yearly') : null,
    property_type: it.commercial ? 'تجاري' : 'سكني',
    unit_type: it.unit,
    bedrooms: it.commercial ? 0 : (it.beds ?? 0),
    bathrooms: it.baths != null ? Math.min(20, Math.max(0, Math.round(it.baths))) : (it.commercial ? 0 : 1),
    area_m2: it.m2,
    city: city || null,
    area: area || null,
    lat: it.lat, lng: it.lng,
    amenities: it.amenities,
    furnishing: it.furnishing,
    completion_status: it.completion === 'off_plan' ? 'off_plan' : (it.completion === 'ready' ? 'ready' : null),
    permit_number: it.permit || null,
    developer_name: it.developer || null,
    is_golden: it.deal === 'sale' && (it.price || 0) >= 2000000,
  };
}

// صلاحية الإعلان للنشر (ما لا يصلح يُتجاوز مع ذكر السبب للوسيط)
function validate(it) {
  if (!it.price || it.price < 1000 || it.price > 2e9) return 'price';
  if (!CITY_AR[(it.city || '').toLowerCase().trim()]) return 'city';
  if (it.photos.length < 3) return 'photos';
  return null;
}

function itemHash(it) { return hashStr(JSON.stringify(it)).toString(36) + ':' + it.photos.length; }

const AREAS = [{"ar":"دبي مارينا","en":"Dubai Marina","dld":["Marsa Dubai","Dubai Marina"],"words":["دبي مارينا","مارينا","marina"]},{"ar":"وسط مدينة دبي","en":"Downtown Dubai","dld":["Burj Khalifa"],"words":["وسط مدينة دبي","داون تاون","downtown","برج خليفة"]},{"ar":"الخليج التجاري","en":"Business Bay","dld":["Business Bay"],"words":["الخليج التجاري","بيزنس باي","business bay"]},{"ar":"نخلة جميرا","en":"Palm Jumeirah","dld":["Palm Jumeirah"],"words":["نخلة جميرا","النخلة","palm jumeirah"]},{"ar":"أبراج بحيرات جميرا","en":"JLT","dld":["Al Thanyah Fifth","Jumeirah Lakes Towers"],"words":["أبراج بحيرات جميرا","بحيرات جميرا","jlt"]},{"ar":"قرية جميرا الدائرية","en":"JVC","dld":["Al Barsha South Fourth","Jumeirah Village Circle"],"words":["قرية جميرا الدائرية","jvc"]},{"ar":"مثلث قرية جميرا","en":"JVT","dld":["Jumeirah Village Triangle"],"words":["مثلث قرية جميرا","jvt"]},{"ar":"دبي هيلز","en":"Dubai Hills Estate","dld":["Hadaeq Sheikh Mohammed Bin Rashid","Dubai Hills"],"words":["دبي هيلز","dubai hills"]},{"ar":"جميرا بيتش ريزيدنس","en":"JBR","dld":["Jumeirah Beach Residence"],"words":["جميرا بيتش","jbr"]},{"ar":"المرابع العربية","en":"Arabian Ranches","dld":["Arabian Ranches"],"words":["المرابع العربية","arabian ranches"]},{"ar":"دبي الجنوب","en":"Dubai South","dld":["Dubai South","Madinat Al Mataar"],"words":["دبي الجنوب","dubai south"]},{"ar":"الفرجان","en":"Al Furjan","dld":["Al Furjan"],"words":["الفرجان","al furjan"]},{"ar":"موتور سيتي","en":"Motor City","dld":["Motor City"],"words":["موتور سيتي","motor city"]},{"ar":"المدينة الرياضية","en":"Dubai Sports City","dld":["Dubai Sports City"],"words":["المدينة الرياضية","sports city"]},{"ar":"ديرة","en":"Deira","dld":["Deira"],"words":["ديرة","deira"]},{"ar":"البرشاء","en":"Al Barsha","dld":["Al Barsha"],"words":["البرشاء","al barsha"]},{"ar":"واحة دبي للسيليكون","en":"Dubai Silicon Oasis","dld":["Dubai Silicon Oasis"],"words":["السيليكون","silicon oasis"]},{"ar":"المدينة العالمية","en":"International City","dld":["International City Ph 1","International City"],"words":["المدينة العالمية","international city"]},{"ar":"أرجان","en":"Arjan","dld":["Arjan"],"words":["أرجان","arjan"]},{"ar":"ديسكفري جاردنز","en":"Discovery Gardens","dld":["Discovery Gardens"],"words":["ديسكفري جاردنز","discovery gardens"]},{"ar":"دبي كريك هاربر","en":"Dubai Creek Harbour","dld":["Dubai Creek Harbour"],"words":["دبي كريك هاربر","خور دبي","creek harbour"]},{"ar":"جزيرة الريم","en":"Al Reem Island","dld":[],"words":["جزيرة الريم","reem island"]},{"ar":"جزيرة ياس","en":"Yas Island","dld":[],"words":["جزيرة ياس","yas island"]},{"ar":"جزيرة السعديات","en":"Saadiyat Island","dld":[],"words":["السعديات","saadiyat"]},{"ar":"جزيرة المرجان","en":"Al Marjan Island","dld":[],"words":["جزيرة المرجان","marjan"]}];

// ===== التشغيل: تُستدعى كل 10 دقائق من pg_cron (بلا مفتاح)، وتعمل فقط على ما هو مستحق =====
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const sb = createClient(SB_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const BUCKET = 'property-images';
const BUDGET_MS = 105_000;
const FEED_MAX_BYTES = 30 * 1024 * 1024;
const IMG_MAX_BYTES = 12 * 1024 * 1024;

// لا نقرأ إلا عناوين https عامة (لا عناوين داخلية ولا أرقام IP)
function safeUrl(u: string): URL | null {
  try {
    const x = new URL(u);
    if (x.protocol !== 'https:' || x.username || x.password) return null;
    const h = x.hostname.toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)) return null;
    if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|supabase\.co|supabase\.in)$/.test(h)) return null;
    return x;
  } catch { return null; }
}

async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  const len = Number(res.headers.get('content-length') || 0);
  if (len > max) throw new Error('too_large');
  const reader = res.body!.getReader(); const parts: Uint8Array[] = []; let n = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    n += value.length; if (n > max) { try { await reader.cancel(); } catch { /* */ } throw new Error('too_large'); }
    parts.push(value);
  }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}

async function safeGet(u: string, timeoutMs: number, max: number): Promise<{ bytes: Uint8Array; type: string }> {
  let url = safeUrl(u); if (!url) throw new Error('bad_url');
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'AnaAqar-FeedImporter/1.0 (+https://anaaqar.com)', Accept: '*/*' } });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location'); try { await res.body?.cancel(); } catch { /* */ }
      url = next ? safeUrl(new URL(next, url).toString()) : null; if (!url) throw new Error('bad_redirect'); continue;
    }
    if (!res.ok) { try { await res.body?.cancel(); } catch { /* */ } throw new Error('http_' + res.status); }
    return { bytes: await readCapped(res, max), type: res.headers.get('content-type') || '' };
  }
  throw new Error('too_many_redirects');
}

// ---------- الصور: نتحقق من نوعها الحقيقي ونحذف بيانات EXIF (ومنها الموقع الجغرافي) ----------
function sniff(b: Uint8Array): 'jpg' | 'png' | 'webp' | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  return null;
}
function stripJpeg(b: Uint8Array): Uint8Array {
  const out: number[] = [0xff, 0xd8]; let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return b;                       // بنية غير متوقعة: نُبقي الملف كما هو
    const m = b[i + 1];
    if (m === 0xda) { for (let k = i; k < b.length; k++) out.push(b[k]); return new Uint8Array(out); }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) return b;
    const drop = m === 0xe1 || m === 0xed || m === 0xfe; // EXIF/XMP و Photoshop والتعليقات
    if (!drop) for (let k = i; k < i + 2 + len; k++) out.push(b[k]);
    i += 2 + len;
  }
  return b;
}
async function copyImage(src: string, path: string): Promise<string> {
  const { bytes } = await safeGet(src, 20_000, IMG_MAX_BYTES);
  const kind = sniff(bytes); if (!kind) throw new Error('not_image');
  if (bytes.length < 8_000) throw new Error('image_too_small');
  const body = kind === 'jpg' ? stripJpeg(bytes) : bytes;
  const type = kind === 'jpg' ? 'image/jpeg' : kind === 'png' ? 'image/png' : 'image/webp';
  const { error } = await sb.storage.from(BUCKET).upload(`${path}.${kind}`, body, { contentType: type, upsert: true, cacheControl: '31536000' });
  if (error) throw new Error('upload: ' + error.message);
  return sb.storage.from(BUCKET).getPublicUrl(`${path}.${kind}`).data.publicUrl;
}

// ---------- قراءة ملف مستحق ----------
async function fetchFeed(feed: any) {
  try {
    const { bytes } = await safeGet(feed.url, 45_000, FEED_MAX_BYTES);
    const xml = new TextDecoder('utf-8').decode(bytes);
    const { format, items, found } = parseFeed(xml, XMLParser);
    if (!items.length) throw new Error(found ? 'no_valid_listings' : 'no_listings_found');
    const payload = items.map((it: any) => ({ ref: it.ref, hash: itemHash(it), data: it }));
    const { data, error } = await sb.rpc('feed_sync_items', { p_feed: feed.id, p_items: payload, p_format: format });
    if (error) throw new Error('sync: ' + error.message);
    return { feed: feed.id, format, ...(data as any) };
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 300);
    await sb.from('listing_feeds').update({ last_error: msg, next_fetch_at: new Date(Date.now() + 6 * 3600e3).toISOString(), last_fetch_at: new Date().toISOString() }).eq('id', feed.id);
    return { feed: feed.id, error: msg };
  }
}

// ---------- معالجة إعلان واحد ----------
const owners = new Map<string, string>();
async function ownerOf(feedId: string): Promise<string> {
  if (!owners.has(feedId)) { const { data } = await sb.from('listing_feeds').select('owner_id').eq('id', feedId).single(); owners.set(feedId, data!.owner_id); }
  return owners.get(feedId)!;
}
const safeSeg = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60) || 'x';

async function processItem(row: any) {
  const it = row.data; const owner = await ownerOf(row.feed_id);
  const finish = (patch: Record<string, unknown>) => sb.from('listing_feed_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('feed_id', row.feed_id).eq('ref', row.ref);
  try {
    const bad = validate(it);
    if (bad) {
      if (row.property_id) await sb.from('properties').update({ status: 'paused' }).eq('id', row.property_id).in('status', ['approved', 'expired']);
      await finish({ state: 'skipped', last_error: bad }); return 'skipped';
    }
    // الصور: تُنسخ إلى تخزين المنصة فقط إن تغيّرت
    const key = it.photos.join('|');
    let urls: string[] = row.img_key === key && (row.img_urls || []).length >= 3 ? row.img_urls : [];
    if (!urls.length) {
      const tag = itemHash({ p: it.photos }).split(':')[0];
      const base = `${owner}/feeds/${String(row.feed_id).slice(0, 8)}/${safeSeg(row.ref)}`;
      const got = await Promise.all(it.photos.map((u: string, i: number) => copyImage(u, `${base}/${i + 1}-${tag}`).catch(() => null)));
      urls = got.filter(Boolean) as string[];
      if (urls.length < 3) { await finish({ state: 'skipped', last_error: 'photos_unreachable' }); return 'skipped'; }
    }
    const fields: Record<string, unknown> = { ...buildRow(it, { areas: AREAS }), image_urls: urls, feed_id: row.feed_id };
    for (const k of Object.keys(fields)) if (fields[k] === null && ['bedrooms', 'bathrooms'].includes(k)) delete fields[k];
    let pid = row.property_id as string | null;
    if (pid) {
      const { data: cur } = await sb.from('properties').select('status').eq('id', pid).maybeSingle();
      if (!cur) pid = null;
      else {
        if (['approved', 'expired', 'paused', 'pending'].includes(cur.status)) fields.status = 'approved'; // المباع/المؤجر يبقى كما حدده الوسيط
        const { error } = await sb.from('properties').update(fields).eq('id', pid);
        if (error) throw new Error('update: ' + error.message);
      }
    }
    if (!pid) {
      pid = crypto.randomUUID();
      const { error } = await sb.from('properties').insert({
        ...fields, id: pid, broker_id: owner, status: 'approved', reviewed_at: new Date().toISOString(),
        commission: '2%', broker_role: 'وسيط معتمد', nearby: [], floor_plan_urls: [], no_commission: false, has_offer: false, is_luxury: false,
      });
      if (error) throw new Error('insert: ' + error.message);
    }
    await finish({ state: 'done', property_id: pid, img_key: key, img_urls: urls, last_error: null });
    return 'done';
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 300);
    await finish({ state: row.attempts >= 3 ? 'error' : 'pending', last_error: msg });
    return 'error';
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const t0 = Date.now();
  const out: Record<string, unknown> = { feeds: [], done: 0, skipped: 0, error: 0 };
  const touched = new Set<string>();
  try {
    for (let k = 0; k < 2 && Date.now() - t0 < 40_000; k++) {        // حتى ملفين مستحقين في كل تشغيل
      const { data: due, error } = await sb.rpc('feed_claim_due');
      if (error || !due || !due.length) break;
      const r = await fetchFeed(due[0]); (out.feeds as unknown[]).push(r); touched.add(due[0].id);
    }
    while (Date.now() - t0 < BUDGET_MS) {
      const { data: batch, error } = await sb.rpc('feed_claim_items', { p_limit: 4 });
      if (error || !batch || !batch.length) break;
      const res = await Promise.all(batch.map((r: any) => { touched.add(r.feed_id); return processItem(r); }));
      for (const r of res) (out as any)[r] = ((out as any)[r] || 0) + 1;
    }
    if (touched.size) await sb.rpc('feed_refresh_counts', { p_feeds: [...touched] });
  } catch (e) {
    out.fatal = String((e as Error).message || e).slice(0, 200);
  }
  out.ms = Date.now() - t0;
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
});
