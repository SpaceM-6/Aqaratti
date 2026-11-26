// قلب استيراد ملفات التغذية: قراءة XML (صيغة Property Finder وصيغ Bayut/dubizzle الشائعة)
// وتحويل كل إعلان إلى صف عقار بعنوان ووصف عربيين. لا يتصل بالشبكة ولا بقاعدة البيانات (قابل للاختبار).

export const MAX_ITEMS = 2000;
export const MAX_IMAGES = 10;

// ---------- أدوات عامة ----------
const normKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
export function txt(v) {
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
export function cleanText(s, max = 3000) {
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

export function parseFeed(xml, XMLParser) {
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
export const CITY_AR = { 'dubai': 'دبي', 'abu dhabi': 'أبوظبي', 'abudhabi': 'أبوظبي', 'sharjah': 'الشارقة', 'ajman': 'عجمان', 'ras al khaimah': 'رأس الخيمة', 'ras al-khaimah': 'رأس الخيمة', 'rak': 'رأس الخيمة', 'fujairah': 'الفجيرة', 'umm al quwain': 'أم القيوين', 'umm al-quwain': 'أم القيوين', 'al ain': 'العين' };
const UNIT_AR = { apartment: 'شقة', studio: 'شقة استوديو', villa: 'فيلا', townhouse: 'تاون هاوس', penthouse: 'بنتهاوس', duplex: 'دوبلكس', hotel_apt: 'شقة فندقية', office: 'مكتب', shop: 'محل تجاري', showroom: 'صالة عرض', warehouse: 'مستودع', land: 'أرض', building: 'مبنى' };
const AMEN_AR = { balcony: 'شرفة', pool: 'مسبح', gym: 'نادٍ رياضي', parking: 'موقف سيارات', security: 'حراسة أمنية', maid: 'غرفة خادمة', pets: 'يُسمح بالحيوانات الأليفة', garden: 'حديقة خاصة', kitchen: 'مطبخ مجهّز', central_ac: 'تكييف مركزي', kids: 'منطقة ألعاب للأطفال', bbq: 'منطقة شواء' };
const FEM = new Set(['apartment', 'studio', 'villa', 'hotel_apt', 'land']);
const money = (n) => Math.round(n).toLocaleString('en-US');
const bedsAr = (b) => b === 1 ? 'بغرفة نوم واحدة' : b === 2 ? 'بغرفتي نوم' : b >= 3 && b <= 10 ? `بـ${b} غرف نوم` : b > 10 ? `بـ${b} غرفة نوم` : '';

export function areaAr(it, areas) {
  const hay = [it.community, it.sub, it.building].join(' | ').toLowerCase();
  for (const a of areas || []) {
    const keys = [a.en, ...(a.dld || []), ...(a.words || []).filter((w) => /[a-z]/i.test(w))].map((x) => String(x).toLowerCase()).filter((x) => x.length >= 3);
    if (keys.some((k) => hay.includes(k))) return a.ar;
  }
  return '';
}

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function buildRow(it, { areas = [], agencyName = '' } = {}) {
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
export function validate(it) {
  if (!it.price || it.price < 1000 || it.price > 2e9) return 'price';
  if (!CITY_AR[(it.city || '').toLowerCase().trim()]) return 'city';
  if (it.photos.length < 3) return 'photos';
  return null;
}

export function itemHash(it) { return hashStr(JSON.stringify(it)).toString(36) + ':' + it.photos.length; }
