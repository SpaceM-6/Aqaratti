/* ==================== إعداد الاتصال بـ Supabase لموقع عقاراتي | Aqaratti ====================
   يُستخدم عبر anon key فقط، وهو آمن للعمل داخل المتصفح لأنه لا يملك صلاحيات إلا ما تسمح
   به سياسات RLS في Postgres. جدول brokers (راجع supabase/schema.sql) للقراءة العامة فقط -
   لا توجد سياسة INSERT/UPDATE/DELETE له، فحتى لو سُرِّب هذا المفتاح لا يمكن الكتابة فيه.
   الكتابة في brokers تتم حصراً عبر مفتاح service_role السرّي من scripts/import-to-supabase.py،
   الذي لا يجب أبداً وضعه في أي ملف يعمل داخل المتصفح مثل هذا الملف. */

const SUPABASE_URL = 'https://mejkpckkdbmczzypzkkr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lamtwY2trZGJtY3p6eXB6a2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3ODMxNzUsImV4cCI6MjEwMzM1OTE3NX0.e9DqA9JRjhH-scSYwNue6XqowK0u1bMHEOcrcJjZwjo';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 👤 يرجع بيانات المستخدم المسجّل دخوله حالياً (أو null إن لم يكن مسجلاً)
async function getCurrentAqarattiUser() {
  const { data } = await supabaseClient.auth.getUser();
  return data && data.user ? data.user : null;
}

// 📇 يرجع صف الوسيط (profiles) الخاص بالمستخدم الحالي
async function getCurrentAqarattiProfile() {
  const user = await getCurrentAqarattiUser();
  if (!user) return null;
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) return null;
  return data;
}

async function aqarattiSignOut() {
  await supabaseClient.auth.signOut();
  // يُقرأ في index.html بعد التوجيه لعرض إشعار عصري بدل alert() (الصفحة نفسها هي وجهة إعادة التوجيه دائماً)
  sessionStorage.setItem('aqaratti_just_signed_out', '1');
  window.location.href = '/index.html';
}

// 🔄 يحوّل صف عقار قادم من Supabase لنفس شكل بيانات properties.json المستخدم بكل الموقع
function mapSupabasePropertyToAqaratti(row) {
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
    broker: {
      brokerId: row.broker_id,
      name: p.full_name || 'وسيط عقاراتي',
      agency: p.agency || 'عقاراتي',
      phone: p.phone || '971500000000',
      whatsapp: p.whatsapp || p.phone || '971500000000',
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
    return data.map(mapSupabasePropertyToAqaratti);
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
    return mapSupabasePropertyToAqaratti(data);
  } catch (e) {
    return null;
  }
}
