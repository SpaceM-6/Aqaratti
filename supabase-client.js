/* ==================== إعداد الاتصال بـ Supabase لموقع AnaAqar ====================
   يُستخدم عبر anon key فقط، وهو آمن للعمل داخل المتصفح لأنه لا يملك صلاحيات إلا ما تسمح
   به سياسات RLS في Postgres. جدول brokers (راجع supabase/schema.sql) للقراءة العامة فقط -
   لا توجد سياسة INSERT/UPDATE/DELETE له، فحتى لو سُرِّب هذا المفتاح لا يمكن الكتابة فيه.
   الكتابة في brokers تتم حصراً عبر مفتاح service_role السرّي من scripts/import-to-supabase.py،
   الذي لا يجب أبداً وضعه في أي ملف يعمل داخل المتصفح مثل هذا الملف. */

const SUPABASE_URL = 'https://mejkpckkdbmczzypzkkr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lamtwY2trZGJtY3p6eXB6a2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3ODMxNzUsImV4cCI6MjEwMzM1OTE3NX0.e9DqA9JRjhH-scSYwNue6XqowK0u1bMHEOcrcJjZwjo';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== 🔒 بيانات الوسطاء: أعمدة عامة + بيانات تواصل عبر دوال محمية ====================
// أعمدة phone/email/mobile محجوبة عن القراءة المباشرة (supabase/lock_broker_contacts.sql)، فنقرأ الأعمدة
// العامة فقط، ثم نجلب بيانات التواصل عبر دالة تتحقق داخل قاعدة البيانات (مفعّل/موافق، أو مدير).
const AQ_BROKER_COLUMNS = {
  individual_brokers: ['id', 'dld_broker_number', 'name_ar', 'name_en', 'office_name', 'office_name_en', 'office_number',
    'office_rank', 'office_logo_url', 'photo_url', 'is_active', 'activated_at', 'country', 'card_rating',
    'license_issue_date', 'license_expiry_date', 'claimed_by', 'public_contact_consent', 'created_at'],
  brokers: ['id', 'name_ar', 'name_en', 'license', 'classification', 'website', 'manager', 'activities',
    'is_active', 'activated_at', 'logo_url', 'country', 'created_at']
};
const _aqColsCache = {};
async function aqBrokerColumns(table) {
  if (_aqColsCache[table]) return _aqColsCache[table];
  let cols = [...(AQ_BROKER_COLUMNS[table] || ['id'])];
  for (let i = 0; i < 12; i++) {
    const { error } = await supabaseClient.from(table).select(cols.join(',')).limit(1);
    if (!error) break;
    const m = /column\s+\S*?\.?"?([a-z_]+)"?\s+does not exist/i.exec(error.message || '');
    if (!m || !cols.includes(m[1])) break;
    cols = cols.filter(c => c !== m[1]);
  }
  _aqColsCache[table] = cols.join(',');
  return _aqColsCache[table];
}
async function aqAttachBrokerContacts(table, rows) {
  const list = Array.isArray(rows) ? rows : (rows ? [rows] : []);
  const ids = list.map(r => r && r.id).filter(v => v != null);
  if (!ids.length) return rows;
  const fn = table === 'brokers' ? 'get_office_broker_contacts' : 'get_individual_broker_contacts';
  let contacts = null;
  const { data, error } = await supabaseClient.rpc(fn, { p_ids: ids });
  if (!error) contacts = data || [];
  else {
    // قبل تشغيل ملف القفل: الأعمدة ما زالت مقروءة مباشرة (والواجهة تطبّق نفس شرط الإظهار)
    const extra = table === 'brokers' ? 'id,phone,email' : 'id,phone,email,mobile';
    const res = await supabaseClient.from(table).select(extra).in('id', ids);
    contacts = res.error ? [] : (res.data || []);
  }
  const byId = new Map(contacts.map(c => [c.id, c]));
  list.forEach(r => { const c = byId.get(r.id); if (c) Object.assign(r, { phone: c.phone || null, email: c.email || null, mobile: c.mobile || null }); });
  return rows;
}

// ==================== 🧪 العقارات التجريبية: تختفي تلقائياً عند وصول 50 عقاراً حقيقياً معتمداً ====================
const AQ_DEMO_HIDE_AT = 50;
async function aqDemoListingsVisible() {
  try {
    const cached = sessionStorage.getItem('aq_demo_visible');
    if (cached) { const c = JSON.parse(cached); if (Date.now() - c.t < 10 * 60 * 1000) return c.v; }
  } catch (e) {}
  let visible = true;
  try {
    const { count, error } = await supabaseClient.from('properties')
      .select('id', { count: 'exact', head: true }).eq('status', 'approved');
    if (!error) visible = (count || 0) < AQ_DEMO_HIDE_AT;
  } catch (e) {}
  try { sessionStorage.setItem('aq_demo_visible', JSON.stringify({ v: visible, t: Date.now() })); } catch (e) {}
  return visible;
}

// ==================== 📊 قياس الزوار (Google Analytics 4) ====================
// ضعي هنا معرّف القياس من Google Analytics (يبدأ بـ G-) ليبدأ القياس في كل صفحات الموقع.
// يبقى فارغاً = لا يُحمَّل أي كود قياس. لا يُقاس الزوار في صفحات الإدارة admin/.
const ANAAQAR_GA4_ID = 'G-5B1K0BZWLY';
(function loadAnalytics() {
  if (!/^G-[A-Z0-9]+$/.test(ANAAQAR_GA4_ID)) return;
  if (location.pathname.indexOf('/admin/') !== -1) return;
  if (!/(^|\.)anaaqar\.com$/.test(location.hostname)) return; // لا قياس أثناء التجربة المحلية
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ANAAQAR_GA4_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', ANAAQAR_GA4_ID);
})();

// ==================== 📲 Service Worker: تسجيل + تحديث تلقائي ====================
// هذا الملف يُحمَّل في كل صفحة بالموقع (خلافاً لتسجيل sw.js السابق الذي كان
// فقط داخل index.html) - كانت أي صفحة أخرى غير index.html، بمافيها صفحات
// الإدارة admin/*.html، تُفتح مباشرة بدون المرور بـ index.html أولاً تبقى
// بدون أي منطق تحديث إطلاقاً، فتستمر بعرض نسخة كاش قديمة للأبد حتى لو
// صدر تحديث جديد على الموقع. المسار '/sw.js' (لا '/.sw.js') مطلق من جذر
// الموقع عمداً حتى يعمل بشكل صحيح من الصفحات الفرعية مثل admin/ أيضاً.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .catch((err) => console.warn('⚠️ تعذر تسجيل Service Worker:', err));
  });

  let reloadedAfterSwUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedAfterSwUpdate) return;
    reloadedAfterSwUpdate = true;
    window.location.reload();
  });
}

// 👤 يرجع بيانات المستخدم المسجّل دخوله حالياً (أو null إن لم يكن مسجلاً)
async function getCurrentAnaAqarUser() {
  const { data } = await supabaseClient.auth.getUser();
  return data && data.user ? data.user : null;
}

// 📇 يرجع صف الوسيط (profiles) الخاص بالمستخدم الحالي
async function getCurrentAnaAqarProfile() {
  const user = await getCurrentAnaAqarUser();
  if (!user) return null;
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) return null;
  return data;
}

async function anaaqarSignOut() {
  await supabaseClient.auth.signOut();
  // يُقرأ في index.html بعد التوجيه لعرض إشعار عصري بدل alert() (الصفحة نفسها هي وجهة إعادة التوجيه دائماً)
  sessionStorage.setItem('anaaqar_just_signed_out', '1');
  window.location.href = '/index.html';
}

// 🔄 يحوّل صف عقار قادم من Supabase لنفس شكل بيانات properties.json المستخدم بكل الموقع
function mapSupabasePropertyToAnaAqar(row) {
  const p = row.profiles || {};
  const images = row.image_urls && row.image_urls.length > 0 ? row.image_urls : [];
  return {
    id: 'sb-' + row.id,
    title: row.title,
    priceAED: row.price_aed,
    dealType: row.deal_type,
    isGolden: row.is_golden,
    roiPercent: row.roi_percent,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    area_m2: row.area_m2,
    propertyType: row.property_type,
    city: row.city,
    commission: row.commission,
    image: images[0] || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=800',
    imagesList: images,
    totalImagesCount: images.length,
    description: row.description,
    isVerified: !!row.license_number,
    permitNumber: row.permit_number || null,
    completionStatus: row.completion_status || null,
    noCommission: row.no_commission === true,
    hasOffer: row.has_offer === true,
    offerText: row.offer_text || null,
    brokerRole: row.broker_role || null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    broker: {
      brokerId: row.broker_id,
      name: p.full_name || 'وسيط AnaAqar',
      agency: p.agency || 'AnaAqar',
      phone: p.phone || null,
      whatsapp: p.whatsapp || p.phone || null,
      avatar: p.avatar_url || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200'
    },
    featured: false
  };
}

// 📡 يجلب عقارات الوسطاء الحقيقيين المعتمدة فقط (status = approved) من Supabase
async function fetchApprovedSupabaseProperties() {
  try {
    const { data, error } = await supabaseClient
      .from('properties')
      .select('*, profiles(full_name, agency, phone, whatsapp, avatar_url)')
      .eq('status', 'approved');
    if (error || !data) return [];
    return data.map(mapSupabasePropertyToAnaAqar);
  } catch (e) {
    return [];
  }
}

// 🔎 يجلب عقار واحد محدد من Supabase عبر رقمه (لدعم روابط المشاركة المباشرة لعقارات الوسطاء الحقيقيين)
async function fetchOneApprovedSupabaseProperty(rawId) {
  try {
    const { data, error } = await supabaseClient
      .from('properties')
      .select('*, profiles(full_name, agency, phone, whatsapp, avatar_url)')
      .eq('id', rawId)
      .eq('status', 'approved')
      .single();
    if (error || !data) return null;
    return mapSupabasePropertyToAnaAqar(data);
  } catch (e) {
    return null;
  }
}

// ==================== 📍 عقارات قريبة مني (PostGIS) ====================
// يعمل فقط على عقارات الوسطاء الحقيقيين اللي أدخلوا إحداثيات (lat/lng) - العقارات
// التجريبية الثابتة من properties.json ما تظهر هنا لعدم وجود إحداثيات لها.
async function fetchNearbyProperties(lat, lng, radiusKm = 15) {
  try {
    const { data, error } = await supabaseClient.rpc('nearby_properties', {
      search_lat: lat, search_lng: lng, radius_km: radiusKm
    });
    if (error || !data) return [];
    return data.map(mapSupabasePropertyToAnaAqar);
  } catch (e) {
    return [];
  }
}

// ==================== ❤️ المفضلة: مزامنة Supabase للمستخدمين المسجّلين دخولهم ====================
// غير المسجّلين دخولهم يستمرون يستخدمون localStorage وحده (anaaqar_favorites) كالسابق.

async function fetchSupabaseFavoriteIds() {
  const user = await getCurrentAnaAqarUser();
  if (!user) return null; // null = غير مسجل دخول، الصفحة ترجع لـ localStorage
  const { data, error } = await supabaseClient.from('favorites').select('property_id').eq('user_id', user.id);
  if (error || !data) return [];
  return data.map(r => r.property_id);
}

async function addSupabaseFavorite(propertyId) {
  const user = await getCurrentAnaAqarUser();
  if (!user) return false;
  const { error } = await supabaseClient.from('favorites').insert({ user_id: user.id, property_id: propertyId.toString() });
  return !error;
}

async function removeSupabaseFavorite(propertyId) {
  const user = await getCurrentAnaAqarUser();
  if (!user) return false;
  const { error } = await supabaseClient.from('favorites').delete().eq('user_id', user.id).eq('property_id', propertyId.toString());
  return !error;
}

// ==================== ⭐ تقييمات العقارات ====================

async function fetchPropertyReviews(propertyId) {
  const { data, error } = await supabaseClient
    .from('property_reviews')
    .select('*, profiles(full_name)')
    .eq('property_id', propertyId.toString())
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data;
}

async function submitPropertyReview(propertyId, rating, comment) {
  const user = await getCurrentAnaAqarUser();
  if (!user) return { error: 'not_logged_in' };
  const { error } = await supabaseClient.from('property_reviews').upsert({
    user_id: user.id,
    property_id: propertyId.toString(),
    rating,
    comment: (comment || '').trim() || null
  }, { onConflict: 'user_id,property_id' });
  return { error: error ? error.message : null };
}

// ==================== 🔔 تنبيهات الأسعار ====================

async function createPriceAlert(propertyId, targetPrice, currentPrice) {
  const user = await getCurrentAnaAqarUser();
  if (!user) return { error: 'not_logged_in' };
  const { error } = await supabaseClient.from('price_alerts').upsert({
    user_id: user.id,
    property_id: propertyId.toString(),
    target_price: targetPrice,
    price_at_creation: currentPrice || null,
    notified: false
  }, { onConflict: 'user_id,property_id' });
  return { error: error ? error.message : null };
}

async function fetchMyPriceAlerts() {
  const user = await getCurrentAnaAqarUser();
  if (!user) return [];
  const { data, error } = await supabaseClient.from('price_alerts').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  return (error || !data) ? [] : data;
}

async function deletePriceAlert(propertyId) {
  const user = await getCurrentAnaAqarUser();
  if (!user) return false;
  const { error } = await supabaseClient.from('price_alerts').delete().eq('user_id', user.id).eq('property_id', propertyId.toString());
  return !error;
}
