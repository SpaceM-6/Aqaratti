/* قسم السيارات في «أنا عقار»: البيانات المشتركة بين صفحات العرض والتفاصيل والإضافة */
(function () {
  'use strict';
  if (window.AQCars) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n || 0).toLocaleString('en-US');
  const MAKES = [
    ['Toyota', 'تويوتا'], ['Nissan', 'نيسان'], ['Lexus', 'لكزس'], ['Mercedes-Benz', 'مرسيدس بنز'], ['BMW', 'بي إم دبليو'], ['Audi', 'أودي'],
    ['Land Rover', 'لاند روفر'], ['Porsche', 'بورش'], ['Ford', 'فورد'], ['Chevrolet', 'شيفروليه'], ['GMC', 'جي إم سي'], ['Cadillac', 'كاديلاك'],
    ['Hyundai', 'هيونداي'], ['Kia', 'كيا'], ['Mitsubishi', 'ميتسوبيشي'], ['Honda', 'هوندا'], ['Mazda', 'مازدا'], ['Volkswagen', 'فولكس فاجن'],
    ['Jeep', 'جيب'], ['Dodge', 'دودج'], ['Tesla', 'تسلا'], ['BYD', 'بي واي دي'], ['Geely', 'جيلي'], ['Chery', 'شيري'], ['MG', 'إم جي'],
    ['Changan', 'شانجان'], ['Haval', 'هافال'], ['Infiniti', 'إنفينيتي'], ['Rolls-Royce', 'رولز رويس'], ['Bentley', 'بنتلي'], ['Ferrari', 'فيراري'],
    ['Lamborghini', 'لامبورغيني'], ['Maserati', 'مازيراتي'], ['Jaguar', 'جاكوار'], ['Volvo', 'فولفو'], ['Peugeot', 'بيجو'], ['Renault', 'رينو'],
    ['Suzuki', 'سوزوكي'], ['Subaru', 'سوبارو'], ['Other', 'أخرى']
  ];
  const MAKE_AR = Object.fromEntries(MAKES);
  const BODY = [['sedan', 'سيدان', 'fa-car'], ['suv', 'دفع رباعي SUV', 'fa-truck-monster'], ['hatchback', 'هاتشباك', 'fa-car-side'], ['coupe', 'كوبيه', 'fa-car-rear'], ['pickup', 'بيك أب', 'fa-truck-pickup'], ['van', 'فان / باص', 'fa-van-shuttle'], ['convertible', 'مكشوفة', 'fa-wind'], ['sports', 'رياضية', 'fa-flag-checkered']];
  const FUEL = [['petrol', 'بنزين'], ['diesel', 'ديزل'], ['hybrid', 'هايبرد'], ['electric', 'كهربائية']];
  const TRANS = [['automatic', 'أوتوماتيك'], ['manual', 'يدوي']];
  const SPECS = [['gcc', 'مواصفات خليجية'], ['american', 'أمريكية'], ['european', 'أوروبية'], ['japanese', 'يابانية'], ['other', 'أخرى']];
  const SELLER = [['owner', 'مالك'], ['dealer', 'معرض سيارات'], ['rental_company', 'شركة تأجير']];
  const PERIOD = { daily: 'يوم', weekly: 'أسبوع', monthly: 'شهر' };
  const FEATURES = [['sunroof', 'فتحة سقف', 'fa-sun'], ['leather', 'مقاعد جلد', 'fa-couch'], ['camera', 'كاميرا خلفية', 'fa-camera'], ['sensors', 'حساسات ركن', 'fa-satellite-dish'], ['navigation', 'نظام ملاحة', 'fa-map'], ['carplay', 'Apple CarPlay / Android Auto', 'fa-mobile-screen'], ['cruise', 'مثبت سرعة', 'fa-gauge'], ['keyless', 'تشغيل بدون مفتاح', 'fa-key'], ['bluetooth', 'بلوتوث', 'fa-bluetooth-b'], ['warranty', 'تحت الضمان', 'fa-shield'], ['service_history', 'سجل صيانة كامل', 'fa-clipboard-check'], ['seven_seats', '7 مقاعد', 'fa-people-group']];
  const L = (list) => Object.fromEntries(list.map((x) => [x[0], x[1]]));
  const AR = { body: L(BODY), fuel: L(FUEL), trans: L(TRANS), specs: L(SPECS), seller: L(SELLER), feat: Object.fromEntries(FEATURES.map((f) => [f[0], f])) };
  const name = (c) => c.title || [MAKE_AR[c.make] || c.make, c.model, c.year].filter(Boolean).join(' ');
  const price = (c) => num(c.price) + ' درهم' + (c.deal === 'rent' ? ' / ' + (PERIOD[c.rent_period] || 'يوم') : '');
  const specLine = (c) => [c.year, c.mileage_km != null ? num(c.mileage_km) + ' كم' : '', AR.trans[c.transmission], AR.fuel[c.fuel]].filter(Boolean).join(' · ');
  const img = (c) => (c.images || [])[0] || '';

  async function load(filter) {
    let out = [];
    if (typeof supabaseClient !== 'undefined') {
      try {
        let q = supabaseClient.from('cars').select('*').eq('status', 'approved').order('created_at', { ascending: false }).limit(500);
        if (filter && filter.deal) q = q.eq('deal', filter.deal);
        const r = await q; if (!r.error && r.data) out = r.data;
      } catch (e) {}
    }
    if (out.length < 6) {
      try { const d = await fetch('cars.json?v=1').then((r) => r.json()); out = out.concat(d.filter((c) => !filter || !filter.deal || c.deal === filter.deal).map((c) => Object.assign({ demo: true }, c))); } catch (e) {}
    }
    return out;
  }
  async function one(id) {
    if (/^demo-/.test(id)) { try { const d = await fetch('cars.json?v=1').then((r) => r.json()); const c = d.find((x) => x.id === id); return c ? Object.assign({ demo: true }, c) : null; } catch (e) { return null; } }
    try { const r = await supabaseClient.from('cars').select('*').eq('id', id).maybeSingle(); return r.data || null; } catch (e) { return null; }
  }
  function card(c) {
    const u = 'car.html?id=' + encodeURIComponent(c.id);
    return `<article class="card"><a class="img" href="${u}" style="display:block;background:linear-gradient(135deg,#1e293b,#475569)"><i class="fas fa-car-side" style="position:absolute;inset:0;display:grid;place-items:center;font-size:56px;color:rgba(255,255,255,.35)"></i>${img(c) ? `<img src="${esc(img(c))}" alt="" loading="lazy" onerror="this.remove()" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block">` : ''}
      <div style="position:absolute;top:10px;right:10px;display:flex;gap:6px;flex-wrap:wrap">${c.deal === 'rent' ? '<span class="cb t">للإيجار</span>' : '<span class="cb">للبيع</span>'}${c.condition === 'new' ? '<span class="cb g">جديدة</span>' : ''}${c.demo ? '<span class="cb">عرض توضيحي</span>' : ''}</div></a>
      <div class="in"><div class="price" style="color:#e11d48">${price(c)}</div><h3><a href="${u}" style="text-decoration:none">${esc(name(c))}</a></h3>
      <div class="meta">${esc(specLine(c))}</div><div class="meta"><i class="fas fa-location-dot"></i> ${esc(c.city || '')}${c.regional_specs ? ' · ' + esc(AR.specs[c.regional_specs] || '') : ''}${c.seller_type ? ' · ' + esc(AR.seller[c.seller_type] || '') : ''}</div></div></article>`;
  }
  const CSS = '.cb{background:rgba(25,32,56,.85);color:#fff;font-size:11.5px;font-weight:900;padding:4px 9px;border-radius:999px}.cb.t{background:#00a896}.cb.g{background:#16a34a}';
  window.AQCars = { esc, num, MAKES, MAKE_AR, BODY, FUEL, TRANS, SPECS, SELLER, PERIOD, FEATURES, AR, name, price, specLine, img, load, one, card, CSS };
})();
