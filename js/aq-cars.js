/* قسم المركبات في «أنا عقار»: السيارات، الدراجات النارية، اليخوت والقوارب.
   لكل قسم أربعة أبواب: بيع، إيجار، قطع غيار، صيانة وخدمات. البيانات المشتركة بين صفحات العرض والتفاصيل والإضافة. */
(function () {
  'use strict';
  if (window.AQCars) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n || 0).toLocaleString('en-US');

  const CAR_MAKES = [
    ['Toyota', 'تويوتا'], ['Nissan', 'نيسان'], ['Lexus', 'لكزس'], ['Mercedes-Benz', 'مرسيدس بنز'], ['BMW', 'بي إم دبليو'], ['Audi', 'أودي'],
    ['Land Rover', 'لاند روفر'], ['Porsche', 'بورش'], ['Ford', 'فورد'], ['Chevrolet', 'شيفروليه'], ['GMC', 'جي إم سي'], ['Cadillac', 'كاديلاك'],
    ['Hyundai', 'هيونداي'], ['Kia', 'كيا'], ['Mitsubishi', 'ميتسوبيشي'], ['Honda', 'هوندا'], ['Mazda', 'مازدا'], ['Volkswagen', 'فولكس فاجن'],
    ['Jeep', 'جيب'], ['Dodge', 'دودج'], ['Tesla', 'تسلا'], ['BYD', 'بي واي دي'], ['Geely', 'جيلي'], ['Chery', 'شيري'], ['MG', 'إم جي'],
    ['Changan', 'شانجان'], ['Haval', 'هافال'], ['Infiniti', 'إنفينيتي'], ['Rolls-Royce', 'رولز رويس'], ['Bentley', 'بنتلي'], ['Ferrari', 'فيراري'],
    ['Lamborghini', 'لامبورغيني'], ['Maserati', 'مازيراتي'], ['Jaguar', 'جاكوار'], ['Volvo', 'فولفو'], ['Peugeot', 'بيجو'], ['Renault', 'رينو'],
    ['Suzuki', 'سوزوكي'], ['Subaru', 'سوبارو'], ['Other', 'أخرى']
  ];
  const MOTO_MAKES = [['Honda', 'هوندا'], ['Yamaha', 'ياماها'], ['Kawasaki', 'كاواساكي'], ['Suzuki', 'سوزوكي'], ['BMW Motorrad', 'بي إم دبليو موتوراد'], ['Ducati', 'دوكاتي'],
    ['Harley-Davidson', 'هارلي ديفيدسون'], ['KTM', 'كي تي إم'], ['Triumph', 'ترايمف'], ['Royal Enfield', 'رويال إنفيلد'], ['Aprilia', 'أبريليا'], ['Vespa', 'فيسبا'],
    ['Polaris', 'بولاريس'], ['Can-Am', 'كان آم'], ['CFMoto', 'سي إف موتو'], ['Other', 'أخرى']];
  const YACHT_MAKES = [['Azimut', 'أزيموت'], ['Sunseeker', 'صن سيكر'], ['Ferretti', 'فيريتي'], ['Princess', 'برنسس'], ['Riva', 'ريفا'], ['Gulf Craft', 'جلف كرافت'],
    ['Majesty', 'ماجيستي'], ['Beneteau', 'بينيتو'], ['Lagoon', 'لاجون'], ['Sea Ray', 'سي راي'], ['Yamaha', 'ياماها'], ['Sea-Doo', 'سي دو'], ['Other', 'أخرى']];

  // كل قسم: الاسم، الأيقونة، الأبواب الأربعة، الأنواع، فئات القطع، أنواع الخدمات، مدد الإيجار
  const KINDS = {
    car: {
      name: 'السيارات', one: 'سيارة', icon: 'fa-car-side', makes: CAR_MAKES, unit: 'كم',
      deals: { sale: ['شراء', 'fa-key', 'سيارات جديدة ومستعملة للبيع'], rent: ['إيجار', 'fa-calendar-day', 'باليوم أو الأسبوع أو الشهر'], parts: ['قطع غيار', 'fa-gears', 'جديدة ومستعملة وأصلية'], service: ['صيانة', 'fa-screwdriver-wrench', 'ورش ومراكز خدمة'] },
      body: [['sedan', 'سيدان', 'fa-car'], ['suv', 'دفع رباعي SUV', 'fa-truck-monster'], ['hatchback', 'هاتشباك', 'fa-car-side'], ['coupe', 'كوبيه', 'fa-car-rear'], ['pickup', 'بيك أب', 'fa-truck-pickup'], ['van', 'فان / باص', 'fa-van-shuttle'], ['convertible', 'مكشوفة', 'fa-wind'], ['sports', 'رياضية', 'fa-flag-checkered']],
      parts: [['engine', 'محرك وناقل حركة', 'fa-gears'], ['body', 'هيكل وصدامات', 'fa-car-burst'], ['lights', 'إضاءة', 'fa-lightbulb'], ['tires', 'إطارات وجنوط', 'fa-circle-dot'], ['electrical', 'كهرباء وبطاريات', 'fa-car-battery'], ['brakes', 'فرامل وتعليق', 'fa-circle-stop'], ['interior', 'داخلية ومقاعد', 'fa-couch'], ['audio', 'صوتيات وشاشات', 'fa-music'], ['oils', 'زيوت وفلاتر', 'fa-oil-can'], ['accessories', 'إكسسوارات', 'fa-star']],
      services: [['mechanic', 'ميكانيكا', 'fa-wrench'], ['electric', 'كهرباء سيارات', 'fa-bolt'], ['body_paint', 'سمكرة ودهان', 'fa-spray-can'], ['ac', 'تكييف', 'fa-snowflake'], ['tires', 'إطارات وميزان', 'fa-circle-dot'], ['periodic', 'صيانة دورية وتغيير زيت', 'fa-oil-can'], ['inspection', 'فحص قبل الشراء', 'fa-magnifying-glass'], ['wash', 'غسيل وتلميع', 'fa-soap'], ['tint', 'تظليل وحماية طلاء', 'fa-shield'], ['tow', 'سطحة ونقل', 'fa-truck-ramp-box']],
      periods: [['daily', 'يوم'], ['weekly', 'أسبوع'], ['monthly', 'شهر']]
    },
    moto: {
      name: 'الدراجات النارية', one: 'دراجة نارية', icon: 'fa-motorcycle', makes: MOTO_MAKES, unit: 'كم',
      deals: { sale: ['شراء', 'fa-key', 'دراجات جديدة ومستعملة'], rent: ['إيجار', 'fa-calendar-day', 'دراجات ودبابات للإيجار'], parts: ['قطع وإكسسوارات', 'fa-gears', 'قطع وخوذ وملابس حماية'], service: ['صيانة', 'fa-screwdriver-wrench', 'ورش الدراجات'] },
      body: [['sport', 'رياضية', 'fa-motorcycle'], ['cruiser', 'كروزر', 'fa-road'], ['touring', 'سياحية', 'fa-route'], ['naked', 'نيكد', 'fa-bolt'], ['adventure', 'أدفنشر', 'fa-mountain'], ['offroad', 'طرق وعرة', 'fa-person-biking'], ['scooter', 'سكوتر', 'fa-motorcycle'], ['atv', 'دباب / ATV', 'fa-truck-monster']],
      parts: [['engine', 'قطع المحرك', 'fa-gears'], ['tires', 'إطارات وجنوط', 'fa-circle-dot'], ['electrical', 'كهرباء وإضاءة', 'fa-bolt'], ['exhaust', 'عوادم', 'fa-wind'], ['helmets', 'خوذ وملابس حماية', 'fa-helmet-safety'], ['accessories', 'إكسسوارات', 'fa-star']],
      services: [['general', 'صيانة عامة', 'fa-wrench'], ['engine', 'محركات', 'fa-gears'], ['tires', 'إطارات', 'fa-circle-dot'], ['electrical', 'كهرباء', 'fa-bolt'], ['custom', 'دهان وتعديل', 'fa-spray-can'], ['tow', 'نقل وسحب', 'fa-truck-ramp-box']],
      periods: [['daily', 'يوم'], ['weekly', 'أسبوع'], ['monthly', 'شهر']]
    },
    yacht: {
      name: 'اليخوت والقوارب', one: 'يخت', icon: 'fa-ship', makes: YACHT_MAKES, unit: 'ساعة تشغيل',
      deals: { sale: ['شراء', 'fa-key', 'يخوت وقوارب للبيع'], rent: ['إيجار ورحلات', 'fa-calendar-day', 'بالساعة أو اليوم مع كابتن'], parts: ['قطع ومعدات بحرية', 'fa-gears', 'محركات وإلكترونيات ومعدات'], service: ['صيانة وخدمات بحرية', 'fa-screwdriver-wrench', 'صيانة ومراسٍ وطاقم'] },
      body: [['motor', 'يخت بمحرك', 'fa-ship'], ['sailing', 'يخت شراعي', 'fa-sailboat'], ['catamaran', 'كاتاماران', 'fa-sailboat'], ['speedboat', 'قارب سريع', 'fa-ship'], ['fishing', 'قارب صيد', 'fa-fish'], ['jetski', 'جت سكي', 'fa-water'], ['superyacht', 'يخت فاخر', 'fa-gem']],
      parts: [['engine', 'محركات بحرية', 'fa-gears'], ['electronics', 'إلكترونيات وملاحة', 'fa-compass'], ['safety', 'معدات سلامة', 'fa-life-ring'], ['fishing', 'معدات صيد', 'fa-fish'], ['water_sports', 'ألعاب مائية', 'fa-person-swimming'], ['accessories', 'إكسسوارات', 'fa-star']],
      services: [['maintenance', 'صيانة وإصلاح', 'fa-wrench'], ['cleaning', 'تنظيف وتلميع', 'fa-soap'], ['berth', 'مراسٍ وتخزين', 'fa-anchor'], ['captain', 'كابتن وطاقم', 'fa-user-tie'], ['license', 'رخص وتسجيل', 'fa-id-card'], ['transport', 'نقل وسحب', 'fa-truck-ramp-box']],
      periods: [['hourly', 'ساعة'], ['daily', 'يوم'], ['weekly', 'أسبوع']]
    }
  };
  const kindOf = (c) => KINDS[(c && c.kind) || 'car'] || KINDS.car;
  const FUEL = [['petrol', 'بنزين'], ['diesel', 'ديزل'], ['hybrid', 'هايبرد'], ['electric', 'كهرباء']];
  const TRANS = [['automatic', 'أوتوماتيك'], ['manual', 'يدوي']];
  const SPECS = [['gcc', 'مواصفات خليجية'], ['american', 'أمريكية'], ['european', 'أوروبية'], ['japanese', 'يابانية'], ['other', 'أخرى']];
  const SELLER = [['owner', 'مالك'], ['dealer', 'معرض / وكيل'], ['rental_company', 'شركة تأجير'], ['workshop', 'ورشة / مركز صيانة'], ['parts_shop', 'محل قطع غيار']];
  const PERIOD = { hourly: 'ساعة', daily: 'يوم', weekly: 'أسبوع', monthly: 'شهر' };
  const FEATURES = [['sunroof', 'فتحة سقف', 'fa-sun'], ['leather', 'مقاعد جلد', 'fa-couch'], ['camera', 'كاميرا خلفية', 'fa-camera'], ['sensors', 'حساسات ركن', 'fa-satellite-dish'], ['navigation', 'نظام ملاحة', 'fa-map'], ['carplay', 'Apple CarPlay / Android Auto', 'fa-mobile-screen'], ['cruise', 'مثبت سرعة', 'fa-gauge'], ['keyless', 'تشغيل بدون مفتاح', 'fa-key'], ['bluetooth', 'بلوتوث', 'fa-bluetooth-b'], ['warranty', 'تحت الضمان', 'fa-shield'], ['service_history', 'سجل صيانة كامل', 'fa-clipboard-check'], ['seven_seats', '7 مقاعد', 'fa-people-group'],
    ['abs', 'فرامل ABS', 'fa-circle-stop'], ['quickshifter', 'ناقل سريع', 'fa-gauge-high'], ['luggage', 'حقائب جانبية', 'fa-suitcase'],
    ['flybridge', 'فلاي بريدج', 'fa-stairs'], ['kitchen', 'مطبخ', 'fa-kitchen-set'], ['ac', 'تكييف', 'fa-snowflake'], ['sound', 'نظام صوت', 'fa-music'], ['fishing_gear', 'معدات صيد', 'fa-fish'], ['water_toys', 'ألعاب مائية', 'fa-person-swimming'], ['bbq', 'شواية', 'fa-fire-burner'], ['crew', 'طاقم', 'fa-people-group']];
  const FEAT_BY_KIND = { car: FEATURES.slice(0, 12).map((f) => f[0]), moto: ['abs', 'quickshifter', 'luggage', 'bluetooth', 'warranty', 'service_history', 'keyless', 'navigation'], yacht: ['flybridge', 'kitchen', 'ac', 'sound', 'fishing_gear', 'water_toys', 'bbq', 'crew', 'navigation', 'warranty', 'service_history'] };
  const L = (list) => Object.fromEntries(list.map((x) => [x[0], x[1]]));
  const AR = { fuel: L(FUEL), trans: L(TRANS), specs: L(SPECS), seller: L(SELLER), feat: Object.fromEntries(FEATURES.map((f) => [f[0], f])) };
  const makeAr = (c) => (L(kindOf(c).makes)[c.make]) || c.make;
  const subLabel = (c) => { const k = kindOf(c); return c.deal === 'parts' ? L(k.parts)[c.part_category] : c.deal === 'service' ? L(k.services)[c.service_type] : L(k.body)[c.body_type]; };

  const name = (c) => c.title || [makeAr(c), c.model, c.year].filter(Boolean).join(' ');
  const price = (c) => c.deal === 'service' ? (c.price ? 'يبدأ من ' + num(c.price) + ' درهم' : 'السعر عند التواصل') : num(c.price) + ' درهم' + (c.deal === 'rent' ? ' / ' + (PERIOD[c.rent_period] || 'يوم') : '');
  const specLine = (c) => {
    if (c.deal === 'parts') return [subLabel(c), c.condition === 'new' ? 'جديدة' : c.condition === 'used' ? 'مستعملة' : '', c.fits ? 'تناسب ' + c.fits : ''].filter(Boolean).join(' · ');
    if (c.deal === 'service') return [subLabel(c), c.city].filter(Boolean).join(' · ');
    if (c.kind === 'yacht') return [c.year, c.length_ft ? c.length_ft + ' قدم' : '', c.seats ? 'حتى ' + c.seats + ' شخص' : '', c.cabins ? c.cabins + ' كبائن' : '', c.rent_period && c.captain_included ? 'مع كابتن' : ''].filter(Boolean).join(' · ');
    if (c.kind === 'moto') return [c.year, c.engine_cc ? c.engine_cc + ' سي سي' : '', c.mileage_km != null ? num(c.mileage_km) + ' كم' : '', AR.trans[c.transmission]].filter(Boolean).join(' · ');
    return [c.year, c.mileage_km != null ? num(c.mileage_km) + ' كم' : '', AR.trans[c.transmission], AR.fuel[c.fuel]].filter(Boolean).join(' · ');
  };
  const img = (c) => (c.images || [])[0] || '';
  const dealBadge = (c) => ({ sale: 'للبيع', rent: 'للإيجار', parts: 'قطع غيار', service: 'صيانة' })[c.deal] || '';

  async function load(filter) {
    filter = filter || {};
    let out = [];
    if (typeof supabaseClient !== 'undefined') {
      try {
        let q = supabaseClient.from('cars').select('*').eq('status', 'approved').order('created_at', { ascending: false }).limit(800);
        if (filter.deal) q = q.eq('deal', filter.deal);
        if (filter.kind) q = q.eq('kind', filter.kind);
        const r = await q; if (!r.error && r.data) out = r.data.filter((c) => (!filter.kind || (c.kind || 'car') === filter.kind));
      } catch (e) {}
    }
    if (out.length < 6) {
      try {
        const d = await fetch('cars.json?v=2').then((r) => r.json());
        out = out.concat(d.filter((c) => (!filter.deal || c.deal === filter.deal) && (!filter.kind || (c.kind || 'car') === filter.kind)).map((c) => Object.assign({ demo: true }, c)));
      } catch (e) {}
    }
    return out;
  }
  async function one(id) {
    if (/^demo-/.test(id)) { try { const d = await fetch('cars.json?v=2').then((r) => r.json()); const c = d.find((x) => x.id === id); return c ? Object.assign({ demo: true }, c) : null; } catch (e) { return null; } }
    try { const r = await supabaseClient.from('cars').select('*').eq('id', id).maybeSingle(); return r.data || null; } catch (e) { return null; }
  }
  function card(c) {
    const u = 'car.html?id=' + encodeURIComponent(c.id), k = kindOf(c);
    const ic = c.deal === 'parts' ? 'fa-gears' : c.deal === 'service' ? 'fa-screwdriver-wrench' : k.icon;
    return `<article class="card"><a class="img" href="${u}" style="display:block;background:linear-gradient(135deg,#1e293b,#475569)"><i class="fas ${ic}" style="position:absolute;inset:0;display:grid;place-items:center;font-size:56px;color:rgba(255,255,255,.35)"></i>${img(c) ? `<img src="${esc(img(c))}" alt="" loading="lazy" onerror="this.remove()" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block">` : ''}
      <div style="position:absolute;top:10px;right:10px;display:flex;gap:6px;flex-wrap:wrap"><span class="cb ${c.deal === 'rent' ? 't' : c.deal === 'service' ? 's' : c.deal === 'parts' ? 'p' : ''}">${dealBadge(c)}</span>${c.condition === 'new' && c.deal === 'sale' ? '<span class="cb g">جديدة</span>' : ''}${c.demo ? '<span class="cb">عرض توضيحي</span>' : ''}</div></a>
      <div class="in"><div class="price" style="color:#e11d48">${price(c)}</div><h3><a href="${u}" style="text-decoration:none">${esc(name(c))}</a></h3>
      <div class="meta">${esc(specLine(c))}</div><div class="meta"><i class="fas fa-location-dot"></i> ${esc(c.city || '')}${c.regional_specs && c.kind !== 'yacht' && ['sale', 'rent'].includes(c.deal) ? ' · ' + esc(AR.specs[c.regional_specs] || '') : ''}${c.seller_type ? ' · ' + esc(AR.seller[c.seller_type] || '') : ''}</div></div></article>`;
  }
  const CSS = '.cb{background:rgba(25,32,56,.85);color:#fff;font-size:11.5px;font-weight:900;padding:4px 9px;border-radius:999px}.cb.t{background:#00a896}.cb.g{background:#16a34a}.cb.s{background:#7c3aed}.cb.p{background:#ea580c}';
  // للتوافق مع الصفحات القديمة
  const MAKES = CAR_MAKES, MAKE_AR = L(CAR_MAKES), BODY = KINDS.car.body;
  window.AQCars = { esc, num, KINDS, kindOf, MAKES, MAKE_AR, BODY, FUEL, TRANS, SPECS, SELLER, PERIOD, FEATURES, FEAT_BY_KIND, AR, L, makeAr, subLabel, name, price, specLine, img, dealBadge, load, one, card, CSS };
})();
