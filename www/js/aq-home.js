/* أقسام الصفحة الرئيسية الجديدة: شريط الإعلانات، شارة التوثيق، شاهدته مؤخرًا، عمليات البحث الأخيرة،
   الأكثر طلبًا للإيجار، الإقامات القصيرة، السيارات، عقارات النخبة، البحث حسب الميزانية، وشريط التنقل السفلي */
(function () {
  'use strict';
  if (!window.AQAds) return;
  const A = window.AQAds, $ = (id) => document.getElementById(id);
  const money = (n) => (n == null || isNaN(n)) ? '' : Number(n).toLocaleString('en-US') + ' درهم';
  const pUrl = (p) => 'property-details.html?id=' + encodeURIComponent(p.id);
  const pItem = (p, tag) => ({ url: pUrl(p), img: p.image || (p.imagesList || [])[0], price: money(p.priceAED) + (p.dealType === 'rent' ? (p.rentPeriod === 'monthly' ? ' / شهريًا' : ' / سنويًا') : ''), t1: p.title, t2: [p.bedrooms === 0 ? 'استوديو' : p.bedrooms ? p.bedrooms + ' غرف' : '', p.bathrooms ? p.bathrooms + ' حمام' : '', p.city].filter(Boolean).join(' · '), tag });

  function recentRails() {
    const rv = A.recent().slice(0, 12);
    A.rail($('aqhRecent'), 'تابع ما شاهدته', rv.map((x) => ({ url: x.url, img: x.img, price: x.price, t1: x.title, t2: x.sub, tag: x.tag })));
    let rs = []; try { rs = JSON.parse(localStorage.getItem('aq_recent_searches') || '[]'); } catch (e) {}
    A.rail($('aqhSearches'), 'عمليات بحثك الأخيرة', rs, { kind: 'search' });
  }

  function budgetRail() {
    const B = [[0, 500000, 'أقل من 500 ألف'], [500000, 1000000, '500 ألف – مليون'], [1000000, 2000000, '1 – 2 مليون'], [2000000, 5000000, '2 – 5 ملايين'], [5000000, 0, 'أكثر من 5 ملايين']];
    const R = [[0, 50000, 'أقل من 50 ألف سنويًا'], [50000, 100000, '50 – 100 ألف سنويًا'], [100000, 200000, '100 – 200 ألف سنويًا'], [200000, 0, 'أكثر من 200 ألف']];
    A.rail($('aqhBudget'), 'ابحث حسب الميزانية',
      B.map(([a, b, l]) => ({ url: `listings.html?cat=sale${a ? '&min=' + a : ''}${b ? '&max=' + b : ''}`, t1: l, t2: 'للشراء' }))
        .concat(R.map(([a, b, l]) => ({ url: `listings.html?cat=rent${a ? '&min=' + a : ''}${b ? '&max=' + b : ''}`, t1: l, t2: 'للإيجار' }))), { kind: 'budget' });
  }

  function propertyRails(all) {
    const list = all.filter((p) => p && p.rentPeriod !== 'daily');
    const rent = list.filter((p) => p.dealType === 'rent').sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)).slice(0, 12);
    A.rail($('aqhRent'), 'الأكثر طلبًا للإيجار', rent.map((p) => pItem(p, p.rentPeriod === 'monthly' ? 'شهري' : 'سنوي')), { more: 'listings.html?cat=rent' });
    const lux = list.filter((p) => p.dealType !== 'rent' && ((window.AQAI && AQAI.attrs && AQAI.attrs(p).luxury) || p.isLuxury || Number(p.priceAED) >= 5000000))
      .sort((a, b) => Number(b.priceAED) - Number(a.priceAED)).slice(0, 12);
    A.rail($('aqhElite'), 'عقارات النخبة', lux.map((p) => pItem(p)), { dark: true, more: 'listings.html?cat=luxury' });
  }

  function staysCars() {
    if (window.AQStay) AQStay.load().then((l) => A.rail($('aqhStays'), 'شورت تيرم: إيجار يومي وشهري', l.slice(0, 12).map((p) => ({ url: 'stay.html?id=' + encodeURIComponent(p.id), img: p.image || (p.imagesList || [])[0], price: money(AQStay.nightly(p)) + ' / الليلة', t1: p.title, t2: [AQStay.guestsTxt(p.maxGuests || 2, 0), p.area || p.city].filter(Boolean).join(' · '), tag: p.instantBook ? '⚡ حجز فوري' : '' })), { more: 'stays.html' }));
    if (window.AQCars) AQCars.load().then((l) => A.rail($('aqhCars'), 'موتورات: سيارات ودراجات ويخوت', l.filter((c) => ['sale', 'rent'].includes(c.deal)).slice(0, 12).map((c) => ({ url: 'car.html?id=' + encodeURIComponent(c.id), img: AQCars.img(c), price: AQCars.price(c), t1: AQCars.name(c), t2: AQCars.specLine(c), tag: c.deal === 'rent' ? 'للإيجار' : 'للبيع' })), { more: 'cars.html' }));
  }

  // تسجيل عمليات البحث الأخيرة من مربع البحث الرئيسي
  function hookSearch() {
    const orig = window.executeSearch;
    if (typeof orig !== 'function' || orig.__aq) return;
    const TAB = { sale: 'شراء', rent: 'إيجار', residential: 'سكني', commercial: 'تجاري', golden: 'الإقامة الذهبية', roi: 'استثمار' };
    const w = function () {
      try {
        const tab = (document.querySelector('.royal-tab.active') || {}).dataset?.type || 'sale';
        const city = ($('citySelector') || {}).value || '', q = (($('searchInput') || {}).value || '').trim(), mn = ($('minPriceInput') || {}).value, mx = ($('maxPriceInput') || {}).value;
        if (city || q || mn || mx) {
          const u = new URLSearchParams(); u.set('tab', tab); if (city) u.set('city', city); if (q) u.set('q', q); if (mx) u.set('max', mx);
          A.trackSearch({ url: 'index.html?' + u + '#search', title: [TAB[tab] || 'عقارات', q || city].filter(Boolean).join(' في '), sub: [city && q ? city : '', mn ? 'من ' + Number(mn).toLocaleString('en-US') : '', mx ? 'حتى ' + Number(mx).toLocaleString('en-US') : ''].filter(Boolean).join(' · ') || 'كل الأسعار', icon: tab === 'rent' ? 'fa-building' : 'fa-key' });
        }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    w.__aq = true; window.executeSearch = w;
  }

  function boot() {
    A.logos($('aqhLogos'), 'شركاء مميزون');
    recentRails(); budgetRail(); staysCars(); hookSearch();
    A.bottomNav('home');
    // ننتظر تحميل العقارات في الصفحة الرئيسية
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      let all = [];
      try { all = typeof window.getAllProperties === 'function' ? window.getAllProperties() || [] : []; } catch (e) {}
      if (all.length || tries > 40) { clearInterval(t); propertyRails(all); }
    }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
