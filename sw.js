/* ==================== Service Worker - عقاراتي | Aqaratti ====================
   تخزين مؤقت ذكي لواجهة التطبيق (App Shell) ودعم العمل دون اتصال بالإنترنت.
*/

const CACHE_VERSION = 'v9';
const CACHE_NAME = `aqaratti-cache-${CACHE_VERSION}`;

// 🧱 واجهة التطبيق الأساسية التي تُخزَّن فور تثبيت الـ Service Worker
const APP_SHELL = [
  './',
  './index.html',
  './search.html',
  './dashboard.html',
  './add-property.html',
  './broker-profile.html',
  './property-details.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon-app-192.png',
  './icons/icon-app-512.png',
  './icons/icon-app-1024.png',
  './icons/icon-app-maskable-512.png'
];

// 📥 التثبيت: تخزين ملفات واجهة التطبيق فوراً
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// 🧹 التفعيل: حذف أي نسخ كاش قديمة من إصدارات سابقة
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// 🌐 اعتراض الطلبات وتوزيعها على الاستراتيجية المناسبة
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // تجاهل أي طلب ليس GET (مثل POST لإضافة/حذف العقارات) وتركه يمر مباشرة للشبكة
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // بيانات العقارات الحيّة (API / properties.json): الشبكة أولاً مع نسخة احتياطية من الكاش عند انقطاع الاتصال
  if (url.pathname.endsWith('properties.json') || url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // صفحات وملفات الموقع من نفس النطاق: كاش أولاً لأعلى سرعة تحميل
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // موارد خارجية (خطوط، أيقونات Font Awesome، صور Unsplash): كاش مع تحديث بالخلفية
  event.respondWith(staleWhileRevalidate(request));
});

// ⚡ استراتيجية Cache First: مثالية لملفات واجهة الموقع الثابتة
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // عند انقطاع الإنترنت وعدم وجود الصفحة في الكاش، أعد الصفحة الرئيسية كتجربة احتياطية
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('تعذر تحميل المحتوى، تحقق من اتصالك بالإنترنت.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// 🔄 استراتيجية Network First: مثالية للبيانات المتغيّرة كقوائم العقارات
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}

// 🕓 استراتيجية Stale While Revalidate: مثالية للموارد الخارجية
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || networkFetch;
}
